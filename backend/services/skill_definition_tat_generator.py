# backend/services/skill_definition_tat_generator.py

from __future__ import annotations

from pathlib import Path
from typing import Any

from data.skill_definitions import get_skill_definitions


PROJECT_ROOT = Path(__file__).resolve().parents[2]
GENERATED_SKILL_DEFINITIONS_PATH = (
    PROJECT_ROOT / "tat/runtime/skill-definitions.generated.tat"
)


def write_skill_definitions_tat_instance() -> Path:
    """
    Generate user-created skill definitions as a TAT graph-flow fragment.

    Python owns raw stored skill definition values.
    TAT owns semantic interpretation of requirements, costs, and effects.
    """

    GENERATED_SKILL_DEFINITIONS_PATH.parent.mkdir(parents=True, exist_ok=True)

    skill_definitions = get_skill_definitions()
    GENERATED_SKILL_DEFINITIONS_PATH.write_text(
        build_skill_definitions_tat_source(skill_definitions),
        encoding="utf-8",
    )

    return GENERATED_SKILL_DEFINITIONS_PATH


def build_skill_definitions_tat_source(
    skill_definitions: list[dict[str, Any]],
) -> str:
    node_chunks: list[str] = []
    edge_chunks: list[str] = []
    meta_chunks: list[str] = []

    for sort_order, skill in enumerate(skill_definitions, start=1):
        skill_id = _safe_id(skill.get("id") or skill.get("name") or f"skill{sort_order}")

        node_chunks.extend(_build_skill_nodes(skill_id, skill, sort_order))
        edge_chunks.extend(_build_skill_edges(skill_id, skill))

    if not node_chunks:
        node_chunks.append(
            """userSkillDefinitionsEmpty: <node {
  id: userSkillDefinitionsEmpty,
  label: "No User Skills",
  kind: emptySkillDefinitionSet,
  source: python,
  description: "No user-created skills have been defined yet.",
}>"""
        )

        edge_chunks.append(
            """userSkillDefinitionsRootHasEmptyState: {
  userSkillDefinitionsRoot : hasSkillDefinitionState : userSkillDefinitionsEmpty
}"""
        )

    meta_chunks.extend(
        [
            'userSkillDefinitionsRoot.generatedBy: "python"',
            'userSkillDefinitionsRoot.boundary: "Python supplies raw user-authored skill definitions. TAT owns interpretation."',
            f"userSkillDefinitionsRoot.skillCount: {len(skill_definitions)}",
        ]
    )

    return f"""// -----------------------------------------------------------------------------
// skill-definitions.generated.tat
// AUTO-GENERATED FILE. Do not edit by hand.
//
// This is a graph-flow fragment for @inject.
// It must not contain imports, exports, @seed, or top-level bindings.
//
// Python owns raw user-created skill definition values.
// TAT owns semantic interpretation of those values.
// -----------------------------------------------------------------------------

-> @graft(node) {{
{_indent(_comma_join(node_chunks), 2)}
}}

-> @graft(edge) {{
{_indent(_comma_join(edge_chunks), 2)}
}}

-> @graft(meta) {{
{_indent(_comma_join(meta_chunks), 2)}
}}
"""


def _build_skill_nodes(
    skill_id: str,
    skill: dict[str, Any],
    sort_order: int,
) -> list[str]:
    name = _tat_string(skill.get("name") or _label_case(skill_id))
    description = _tat_string(skill.get("description") or "")

    requirements = skill.get("requirements") or {}
    cost = skill.get("cost") or {}
    effects = skill.get("effects") or {}

    chunks = [
        f"""{skill_id}: <node {{
  id: {skill_id},
  label: "{name}",
  kind: userSkill,
  source: python,
  sortOrder: {sort_order},
  description: "{description}",
}}>""",
        f"""{skill_id}Definition: <node {{
  id: {skill_id}Definition,
  label: "{name} Definition",
  kind: userSkillDefinition,
  source: python,
  targetSkill: {skill_id},
  description: "{description}",
}}>""",
        f"""{skill_id}SkillPointCost: <node {{
  id: {skill_id}SkillPointCost,
  label: "Skill Point Cost",
  kind: skillPointCost,
  targetSkill: {skill_id},
  value: {_number(cost.get("skillPoints", 0))},
  source: python,
}}>""",
        f"""{skill_id}HealthPointCost: <node {{
  id: {skill_id}HealthPointCost,
  label: "Health Point Cost",
  kind: healthPointCost,
  targetSkill: {skill_id},
  value: {_number(cost.get("healthPoints", 0))},
  source: python,
}}>""",
    ]

    chunks.extend(_build_requirement_nodes(skill_id, requirements))
    chunks.extend(_build_effect_nodes(skill_id, effects))

    return chunks


def _build_requirement_nodes(
    skill_id: str,
    requirements: dict[str, Any],
) -> list[str]:
    chunks: list[str] = []

    for index, requirement in enumerate(requirements.get("stats", []), start=1):
        stat = _safe_id(requirement.get("stat") or "strength")
        operator = _tat_string(requirement.get("operator") or ">=")
        value = _number(requirement.get("value", 0))
        node_id = f"{skill_id}{_pascal_case(stat)}Requirement{index}"

        chunks.append(
            f"""{node_id}: <node {{
  id: {node_id},
  label: "{_label_case(stat)} Requirement",
  kind: statRequirement,
  targetSkill: {skill_id},
  stat: {stat},
  operator: "{operator}",
  requiredValue: {value},
  source: python,
}}>"""
        )

    for index, requirement in enumerate(requirements.get("skills", []), start=1):
        required_skill_id = _safe_id(requirement.get("skillId") or requirement.get("id") or "")
        required_status = _safe_id(requirement.get("status") or "learned")
        node_id = f"{skill_id}{_pascal_case(required_skill_id)}SkillRequirement{index}"

        chunks.append(
            f"""{node_id}: <node {{
  id: {node_id},
  label: "{_label_case(required_skill_id)} Requirement",
  kind: skillRequirement,
  targetSkill: {skill_id},
  requiredSkill: {required_skill_id},
  requiredStatus: {required_status},
  source: python,
}}>"""
        )

    level_requirement = requirements.get("level")

    if level_requirement:
        if isinstance(level_requirement, dict):
            operator = _tat_string(level_requirement.get("operator") or ">=")
            value = _number(level_requirement.get("value", 0))
        else:
            operator = ">="
            value = _number(level_requirement)

        chunks.append(
            f"""{skill_id}LevelRequirement: <node {{
  id: {skill_id}LevelRequirement,
  label: "Level Requirement",
  kind: levelRequirement,
  targetSkill: {skill_id},
  operator: "{operator}",
  requiredValue: {value},
  source: python,
}}>"""
        )

    character_class = requirements.get("characterClass")

    if character_class:
        required_class = _safe_id(character_class)

        chunks.append(
            f"""{skill_id}ClassRequirement: <node {{
  id: {skill_id}ClassRequirement,
  label: "{_label_case(required_class)} Class Requirement",
  kind: classRequirement,
  targetSkill: {skill_id},
  requiredClass: {required_class},
  source: python,
}}>"""
        )

    return chunks


def _build_effect_nodes(
    skill_id: str,
    effects: dict[str, Any],
) -> list[str]:
    chunks: list[str] = []

    base_damage = _number(effects.get("baseDamage", 0))
    base_heal_amount = _number(effects.get("baseHealAmount", 0))
    damage_type = _safe_id(effects.get("damageType") or "physical")
    target = _safe_id(effects.get("target") or "enemy")

    if base_damage > 0:
        chunks.append(
            f"""{skill_id}DamageEffect: <node {{
  id: {skill_id}DamageEffect,
  label: "Damage Effect",
  kind: damageEffect,
  targetSkill: {skill_id},
  baseDamage: {base_damage},
  damageType: {damage_type},
  target: {target},
  source: python,
}}>"""
        )

    if base_heal_amount > 0:
        chunks.append(
            f"""{skill_id}HealEffect: <node {{
  id: {skill_id}HealEffect,
  label: "Heal Effect",
  kind: healEffect,
  targetSkill: {skill_id},
  baseHealAmount: {base_heal_amount},
  target: {target},
  source: python,
}}>"""
        )

    for buff_id in effects.get("buffs", []):
        buff = _safe_id(buff_id)

        if not buff:
            continue

        chunks.append(
            f"""{skill_id}{_pascal_case(buff)}BuffEffect: <node {{
  id: {skill_id}{_pascal_case(buff)}BuffEffect,
  label: "{_label_case(buff)} Buff",
  kind: buffEffect,
  targetSkill: {skill_id},
  buff: {buff},
  target: {target},
  source: python,
}}>"""
        )

    for ailment_id in effects.get("statusAilments", []):
        ailment = _safe_id(ailment_id)

        if not ailment:
            continue

        chunks.append(
            f"""{skill_id}{_pascal_case(ailment)}AilmentEffect: <node {{
  id: {skill_id}{_pascal_case(ailment)}AilmentEffect,
  label: "{_label_case(ailment)} Ailment",
  kind: statusAilmentEffect,
  targetSkill: {skill_id},
  ailment: {ailment},
  target: {target},
  source: python,
}}>"""
        )

    return chunks


def _build_skill_edges(
    skill_id: str,
    skill: dict[str, Any],
) -> list[str]:
    requirements = skill.get("requirements") or {}
    effects = skill.get("effects") or {}

    chunks = [
        f"""{skill_id}RootIncludesSkill: {{
  userSkillDefinitionsRoot : includesUserSkill : {skill_id}
}}""",
        f"""{skill_id}HasDefinition: {{
  {skill_id} : hasDefinition : {skill_id}Definition
}}""",
        f"""{skill_id}HasSkillPointCost: {{
  {skill_id} : hasCost : {skill_id}SkillPointCost
}}""",
        f"""{skill_id}HasHealthPointCost: {{
  {skill_id} : hasCost : {skill_id}HealthPointCost
}}""",
    ]

    chunks.extend(_build_requirement_edges(skill_id, requirements))
    chunks.extend(_build_effect_edges(skill_id, effects))

    return chunks


def _build_requirement_edges(
    skill_id: str,
    requirements: dict[str, Any],
) -> list[str]:
    chunks: list[str] = []

    for index, requirement in enumerate(requirements.get("stats", []), start=1):
        stat = _safe_id(requirement.get("stat") or "strength")
        node_id = f"{skill_id}{_pascal_case(stat)}Requirement{index}"

        chunks.append(
            f"""{skill_id}Has{_pascal_case(stat)}Requirement{index}: {{
  {skill_id} : hasRequirement : {node_id}
}}"""
        )

    for index, requirement in enumerate(requirements.get("skills", []), start=1):
        required_skill_id = _safe_id(requirement.get("skillId") or requirement.get("id") or "")
        node_id = f"{skill_id}{_pascal_case(required_skill_id)}SkillRequirement{index}"

        chunks.append(
            f"""{skill_id}Has{_pascal_case(required_skill_id)}SkillRequirement{index}: {{
  {skill_id} : hasRequirement : {node_id}
}}"""
        )

    if requirements.get("level"):
        chunks.append(
            f"""{skill_id}HasLevelRequirement: {{
  {skill_id} : hasRequirement : {skill_id}LevelRequirement
}}"""
        )

    if requirements.get("characterClass"):
        chunks.append(
            f"""{skill_id}HasClassRequirement: {{
  {skill_id} : hasRequirement : {skill_id}ClassRequirement
}}"""
        )

    return chunks


def _build_effect_edges(
    skill_id: str,
    effects: dict[str, Any],
) -> list[str]:
    chunks: list[str] = []

    if _number(effects.get("baseDamage", 0)) > 0:
        chunks.append(
            f"""{skill_id}HasDamageEffect: {{
  {skill_id} : hasEffect : {skill_id}DamageEffect
}}"""
        )

    if _number(effects.get("baseHealAmount", 0)) > 0:
        chunks.append(
            f"""{skill_id}HasHealEffect: {{
  {skill_id} : hasEffect : {skill_id}HealEffect
}}"""
        )

    for buff_id in effects.get("buffs", []):
        buff = _safe_id(buff_id)

        if not buff:
            continue

        chunks.append(
            f"""{skill_id}Has{_pascal_case(buff)}BuffEffect: {{
  {skill_id} : hasEffect : {skill_id}{_pascal_case(buff)}BuffEffect
}}"""
        )

    for ailment_id in effects.get("statusAilments", []):
        ailment = _safe_id(ailment_id)

        if not ailment:
            continue

        chunks.append(
            f"""{skill_id}Has{_pascal_case(ailment)}AilmentEffect: {{
  {skill_id} : hasEffect : {skill_id}{_pascal_case(ailment)}AilmentEffect
}}"""
        )

    return chunks


def _safe_id(value: Any) -> str:
    text = str(value or "").strip()

    if not text:
        return ""

    parts: list[str] = []
    capitalize_next = False

    for char in text:
        if char.isalnum():
            if not parts:
                parts.append(char.lower())
            elif capitalize_next:
                parts.append(char.upper())
                capitalize_next = False
            else:
                parts.append(char)
        else:
            capitalize_next = True

    return "".join(parts)


def _pascal_case(value: str) -> str:
    safe = _safe_id(value)

    if not safe:
        return ""

    return safe[:1].upper() + safe[1:]


def _label_case(value: str) -> str:
    safe = _safe_id(value)

    if not safe:
        return "Unknown"

    output = ""

    for index, char in enumerate(safe):
        if index > 0 and char.isupper():
            output += " "

        output += char

    return output[:1].upper() + output[1:]


def _number(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _tat_string(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


def _comma_join(chunks: list[str]) -> str:
    return ",\n\n".join(chunk for chunk in chunks if chunk.strip())


def _indent(value: str, spaces: int) -> str:
    if not value.strip():
        return ""

    prefix = " " * spaces

    return "\n".join(
        f"{prefix}{line}" if line.strip() else line
        for line in value.splitlines()
    )