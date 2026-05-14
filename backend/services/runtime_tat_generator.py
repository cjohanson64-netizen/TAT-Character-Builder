# backend/services/runtime_tat_generator.py

from __future__ import annotations

from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
GENERATED_RUNTIME_PATH = PROJECT_ROOT / "tat/runtime/character-builder-runtime.generated.tat"

RESOURCE_NODE_NAMES = {
    "healthPoints": "healthPoints",
    "skillPoints": "skillPoints",
}

STAT_NODE_NAMES = {
    "strength": "sampleStrengthValue",
    "defense": "sampleDefenseValue",
    "intelligence": "sampleIntelligenceValue",
    "resistance": "sampleResistanceValue",
    "speed": "sampleSpeedValue",
    "dexterity": "sampleDexterityValue",
}

SKILL_IDS = [
    "heavyStrike",
    "powerSwing",
    "shieldGuard",
    "ironWall",
    "arcaneBolt",
    "spellSurge",
    "wardingMind",
    "spellGuard",
    "quickStep",
    "initiative",
    "preciseShot",
    "weaponMastery",
]


def write_runtime_tat_instance(state: dict[str, Any]) -> Path:
    """
    Generate the current Python-owned runtime state as a TAT graph-flow fragment.

    This file is intended to be consumed by:

      <- @inject(character_runtime_facts, ".tat")

    Python owns values.
    TAT owns interpretation.
    """

    GENERATED_RUNTIME_PATH.parent.mkdir(parents=True, exist_ok=True)
    GENERATED_RUNTIME_PATH.write_text(build_runtime_tat_source(state), encoding="utf-8")

    return GENERATED_RUNTIME_PATH


def build_runtime_tat_source(state: dict[str, Any]) -> str:
    character = state.get("character", {})
    stats = state.get("stats", {})
    unlocked_skill_ids = state.get("unlockedSkillIds", [])
    resources = state.get("resources", {})
    status = state.get("status", {})

    node_chunks = [
    f"""sampleCharacter: <node {{
  id: sampleCharacter,
  label: "{_tat_string(character.get("name", "Ari"))}",
  kind: runtimeCharacter,
  characterId: "{_tat_string(character.get("id", "hero_001"))}",
  name: "{_tat_string(character.get("name", "Ari"))}",
  level: {_number(character.get("level", 1))},
  xp: {_number(character.get("xp", 0))},
  source: python,
  description: "Runtime character supplied by Python state.",
}}>""",
    """sampleCharacterDataFact: <node {
  id: sampleCharacterDataFact,
  label: "Character Data",
  kind: runtimeFact,
  source: python,
  description: "Runtime character identity and progression values.",
}>""",
    """sampleStatValuesFact: <node {
  id: sampleStatValuesFact,
  label: "Stat Values",
  kind: runtimeFact,
  source: python,
  description: "Current stat values supplied by Python state.",
}>""",
    """sampleUnlockedSkillsFact: <node {
  id: sampleUnlockedSkillsFact,
  label: "Learned Skills",
  kind: runtimeFact,
  source: python,
  description: "Current learned skill ids supplied by Python state.",
}>""",
    *[
        _build_stat_node(stat_name, stats.get(stat_name, 0))
        for stat_name in STAT_NODE_NAMES
    ],
    *[
        _build_unlocked_skill_node(skill_id)
        for skill_id in unlocked_skill_ids
    ],
    *[
        _build_resource_node(resource_name, resources.get(resource_name, {}))
        for resource_name in RESOURCE_NODE_NAMES
    ],
    *_build_status_nodes(status),
]

    edge_chunks = [
        """runtimeFactsIncludesCharacterData: {
  runtimeFactsRoot : includesRuntimeFact : sampleCharacterDataFact
}""",
        """runtimeFactsIncludesStatValues: {
  runtimeFactsRoot : includesRuntimeFact : sampleStatValuesFact
}""",
        """runtimeFactsIncludesUnlockedSkills: {
  runtimeFactsRoot : includesRuntimeFact : sampleUnlockedSkillsFact
}""",
        """sampleCharacterDataDescribesCharacter: {
  sampleCharacterDataFact : describes : sampleCharacter
}""",
        """sampleCharacterHasStatValues: {
  sampleCharacter : hasRuntimeFact : sampleStatValuesFact
}""",
        """sampleCharacterHasUnlockedSkills: {
  sampleCharacter : hasRuntimeFact : sampleUnlockedSkillsFact
}""",
        *[
            _build_stat_edges(stat_name)
            for stat_name in STAT_NODE_NAMES
        ],
        *[
            _build_unlocked_skill_edges(skill_id)
            for skill_id in unlocked_skill_ids
        ],
        *[
            _build_resource_edges(resource_name)
            for resource_name in RESOURCE_NODE_NAMES
        ],
        *_build_status_edges(status),
    ]

    node_entries = _indent(_comma_join(node_chunks), 2)
    edge_entries = _indent(_comma_join(edge_chunks), 2)
    state_entries = _indent(
        _comma_join(
            _build_state_entries(
                character=character,
                resources=resources,
                stats=stats,
                status=status,
                unlocked_skill_ids=unlocked_skill_ids,
            )
        ),
        2,
    )

    return f"""// -----------------------------------------------------------------------------
// character-builder-runtime.generated.tat
// AUTO-GENERATED FILE. Do not edit by hand.
//
// This is a graph-flow fragment for @inject.
// It must not contain imports, exports, @seed, or top-level bindings.
//
// Python owns these runtime values.
// TAT owns the semantic interpretation of these values.
// -----------------------------------------------------------------------------

-> @graft(node) {{
{node_entries}
}}

-> @graft(edge) {{
{edge_entries}
}}

-> @graft(state) {{
{state_entries}
}}

-> @graft(meta) {{
  runtimeFactsRoot.generatedBy: "python",
  runtimeFactsRoot.boundary: "Python supplies values only. TAT owns interpretation.",
}}
"""


def _build_stat_node(stat_name: str, value: Any) -> str:
    node_name = STAT_NODE_NAMES[stat_name]
    label = _label_case(stat_name)

    return f"""{node_name}: <node {{
  id: {node_name},
  label: "{label} Value",
  kind: runtimeStatValue,
  stat: {stat_name},
  value: {_number(value)},
  source: python,
  description: "Current {label} value.",
}}>"""


def _build_stat_edges(stat_name: str) -> str:
    node_name = STAT_NODE_NAMES[stat_name]
    pascal = _pascal_case(stat_name)

    return f"""sampleStatValuesIncludes{pascal}: {{
  sampleStatValuesFact : includesStatValue : {node_name}
}},

{node_name}AppliesTo{pascal}: {{
  {node_name} : appliesToStat : {stat_name}
}}"""


def _build_unlocked_skill_node(skill_id: str) -> str:
    pascal = _pascal_case(skill_id)
    label = _label_case(skill_id)

    return f"""sampleUnlocked{pascal}: <node {{
  id: sampleUnlocked{pascal},
  label: "Learned {label}",
  kind: runtimeUnlockedSkill,
  skill: {skill_id},
  skillId: {skill_id},
  source: python,
  description: "{label} has been learned.",
}}>"""


def _build_unlocked_skill_edges(skill_id: str) -> str:
    pascal = _pascal_case(skill_id)

    return f"""sampleUnlockedSkillsIncludes{pascal}: {{
  sampleUnlockedSkillsFact : includesUnlockedSkill : sampleUnlocked{pascal}
}},

sampleUnlocked{pascal}AppliesTo{pascal}: {{
  sampleUnlocked{pascal} : appliesToSkill : {skill_id}
}}"""

def _build_state_entries(
    character: dict[str, Any],
    resources: dict[str, Any],
    stats: dict[str, Any],
    status: dict[str, Any],
    unlocked_skill_ids: list[str],
) -> list[str]:
    unlocked = set(unlocked_skill_ids)

    stat_entries = [
        f"{stat_name}.current: {_number(stats.get(stat_name, 0))}"
        for stat_name in STAT_NODE_NAMES
    ]

    learned_entries = [
        f"{skill_id}.learned: {'true' if skill_id in unlocked else 'false'}"
        for skill_id in SKILL_IDS
    ]
    
    character_entries = [
    f'hero.characterClass: {_tat_symbol_or_string(character.get("characterClass", "warrior"))}',
    f"hero.level: {_number(character.get('level', 1))}",
    f"hero.experiencePoints: {_number(character.get('experiencePoints', 0))}",
    ]

    resource_entries = [
        f"healthPoints.current: {_number(resources.get('healthPoints', {}).get('current', 0))}",
        f"healthPoints.max: {_number(resources.get('healthPoints', {}).get('max', 0))}",
        f"skillPoints.current: {_number(resources.get('skillPoints', {}).get('current', 0))}",
        f"skillPoints.max: {_number(resources.get('skillPoints', {}).get('max', 0))}",
    ]

    status_entries = [
        f"hero.buffs: [{', '.join(status.get('buffs', []))}]",
        f"hero.ailments: [{', '.join(status.get('ailments', []))}]",
    ]

    return [
        *character_entries,
        *resource_entries,
        *stat_entries,
        *status_entries,
        *learned_entries,
    ]
    
def _build_resource_node(resource_name: str, resource: dict[str, Any]) -> str:
    label = _label_case(resource_name)

    return f"""{resource_name}: <node {{
  id: {resource_name},
  label: "{label}",
  kind: runtimeResource,
  current: {_number(resource.get("current", 0))},
  max: {_number(resource.get("max", 0))},
  source: python,
  description: "Current {label} resource values.",
}}>"""


def _build_resource_edges(resource_name: str) -> str:
    pascal = _pascal_case(resource_name)

    return f"""sampleCharacterHas{pascal}: {{
  sampleCharacter : hasRuntimeResource : {resource_name}
}}"""


def _build_status_nodes(status: dict[str, Any]) -> list[str]:
    chunks = [
        """heroStatus: <node {
  id: heroStatus,
  label: "Hero Status",
  kind: runtimeStatus,
  source: python,
  description: "Current buffs and ailments affecting the hero.",
}>"""
    ]

    for buff_id in status.get("buffs", []):
        chunks.append(
            f"""heroBuff{_pascal_case(buff_id)}: <node {{
  id: heroBuff{_pascal_case(buff_id)},
  label: "{_label_case(buff_id)}",
  kind: runtimeBuff,
  buff: {buff_id},
  source: python,
}}>"""
        )

    for ailment_id in status.get("ailments", []):
        chunks.append(
            f"""heroAilment{_pascal_case(ailment_id)}: <node {{
  id: heroAilment{_pascal_case(ailment_id)},
  label: "{_label_case(ailment_id)}",
  kind: runtimeAilment,
  ailment: {ailment_id},
  source: python,
}}>"""
        )

    return chunks


def _build_status_edges(status: dict[str, Any]) -> list[str]:
    chunks = [
        """sampleCharacterHasStatus: {
  sampleCharacter : hasRuntimeStatus : heroStatus
}"""
    ]

    for buff_id in status.get("buffs", []):
        chunks.append(
            f"""heroStatusHasBuff{_pascal_case(buff_id)}: {{
  heroStatus : hasBuff : heroBuff{_pascal_case(buff_id)}
}}"""
        )

    for ailment_id in status.get("ailments", []):
        chunks.append(
            f"""heroStatusHasAilment{_pascal_case(ailment_id)}: {{
  heroStatus : hasAilment : heroAilment{_pascal_case(ailment_id)}
}}"""
        )

    return chunks


def _tat_symbol_or_string(value: Any) -> str:
    text = str(value)

    if text.replace("_", "").replace("-", "").isalnum():
        return text

    return f'"{_tat_string(text)}"'

def _pascal_case(value: str) -> str:
    parts = value.replace("-", "_").split("_")

    if len(parts) > 1:
        return "".join(part[:1].upper() + part[1:] for part in parts if part)

    return value[:1].upper() + value[1:]


def _label_case(value: str) -> str:
    normalized = value.replace("-", " ").replace("_", " ")
    output = ""

    for index, char in enumerate(normalized):
        if index > 0 and char.isupper() and normalized[index - 1] != " ":
            output += " "

        output += char

    return " ".join(output.split()).title()


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