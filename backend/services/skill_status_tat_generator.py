# backend/services/skill_status_tat_generator.py

from __future__ import annotations

from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
GENERATED_SKILL_STATUS_PATH = PROJECT_ROOT / "tat/runtime/skill-status.generated.tat"


SKILL_RULES: list[dict[str, Any]] = [
    {
        "skill": "heavyStrike",
        "label": "Heavy Strike",
        "stat": "strength",
        "required": 8,
        "dependency": None,
        "sortOrder": 1,
    },
    {
        "skill": "powerSwing",
        "label": "Power Swing",
        "stat": "strength",
        "required": 12,
        "dependency": "heavyStrike",
        "sortOrder": 2,
    },
    {
        "skill": "shieldGuard",
        "label": "Shield Guard",
        "stat": "defense",
        "required": 8,
        "dependency": None,
        "sortOrder": 3,
    },
    {
        "skill": "ironWall",
        "label": "Iron Wall",
        "stat": "defense",
        "required": 12,
        "dependency": "shieldGuard",
        "sortOrder": 4,
    },
    {
        "skill": "arcaneBolt",
        "label": "Arcane Bolt",
        "stat": "intelligence",
        "required": 8,
        "dependency": None,
        "sortOrder": 5,
    },
    {
        "skill": "spellSurge",
        "label": "Spell Surge",
        "stat": "intelligence",
        "required": 12,
        "dependency": "arcaneBolt",
        "sortOrder": 6,
    },
    {
        "skill": "wardingMind",
        "label": "Warding Mind",
        "stat": "resistance",
        "required": 8,
        "dependency": None,
        "sortOrder": 7,
    },
    {
        "skill": "spellGuard",
        "label": "Spell Guard",
        "stat": "resistance",
        "required": 12,
        "dependency": "wardingMind",
        "sortOrder": 8,
    },
    {
        "skill": "quickStep",
        "label": "Quick Step",
        "stat": "speed",
        "required": 8,
        "dependency": None,
        "sortOrder": 9,
    },
    {
        "skill": "initiative",
        "label": "Initiative",
        "stat": "speed",
        "required": 12,
        "dependency": "quickStep",
        "sortOrder": 10,
    },
    {
        "skill": "preciseShot",
        "label": "Precise Shot",
        "stat": "dexterity",
        "required": 8,
        "dependency": None,
        "sortOrder": 11,
    },
    {
        "skill": "weaponMastery",
        "label": "Weapon Mastery",
        "stat": "dexterity",
        "required": 12,
        "dependency": "preciseShot",
        "sortOrder": 12,
    },
]


def write_skill_status_tat_instance(state: dict[str, Any]) -> Path:
    """
    Generate a TAT module containing dynamic skill-status interpretation.

    Bridge-pass rule:
    - Python reads current live values.
    - Generated TAT expresses the interpreted result using TAT semantic nodes.
    - Later, TAT's runtime can replace this with native dynamic derivation.
    """

    GENERATED_SKILL_STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    GENERATED_SKILL_STATUS_PATH.write_text(
        build_skill_status_tat_source(state),
        encoding="utf-8",
    )

    return GENERATED_SKILL_STATUS_PATH


def build_skill_status_tat_source(state: dict[str, Any]) -> str:
    stats = state.get("stats", {})
    unlocked_skill_ids = set(state.get("unlockedSkillIds", []))

    card_nodes = []
    requirement_nodes = []
    explanation_nodes = []

    card_edges = []
    requirement_edges = []
    explanation_edges = []

    node_names = [
        "skillStatusViewRoot",
        "skillStatusCardsSection",
        "skillRequirementSummarySection",
        "skillExplanationSection",
    ]

    edge_names = [
        "skillStatusViewIncludesCardsSection",
        "skillStatusViewIncludesRequirementSummarySection",
        "skillStatusViewIncludesExplanationSection",
    ]

    for rule in SKILL_RULES:
        interpretation = _interpret_skill(rule, stats, unlocked_skill_ids)
        names = _names_for_skill(rule["skill"])

        card_nodes.append(_build_card_node(rule, interpretation, names))
        requirement_nodes.extend(_build_requirement_nodes(rule, interpretation, names))
        explanation_nodes.append(_build_explanation_node(rule, interpretation, names))

        card_edges.extend(_build_card_edges(rule, interpretation, names))
        requirement_edges.extend(_build_requirement_edges(rule, interpretation, names))
        explanation_edges.extend(_build_explanation_edges(names))

        node_names.extend(
            [
                names["card"],
                names["statRequirement"],
                names["explanation"],
            ]
        )

        edge_names.extend(
            [
                names["sectionIncludesCardEdge"],
                names["cardTargetsSkillEdge"],
                names["cardHasStatusEdge"],
                names["cardHasRequirementEdge"],
                names["requirementHasResultEdge"],
                names["sectionIncludesRequirementEdge"],
                names["cardHasExplanationEdge"],
                names["sectionIncludesExplanationEdge"],
            ]
        )

        if rule.get("dependency"):
            node_names.append(names["dependencyRequirement"])
            edge_names.extend(
                [
                    names["cardHasDependencyRequirementEdge"],
                    names["dependencyRequirementHasResultEdge"],
                    names["sectionIncludesDependencyRequirementEdge"],
                ]
            )

    return f"""// -----------------------------------------------------------------------------
// skill-status.generated.tat
// AUTO-GENERATED FILE. Do not edit by hand.
//
// Generated by backend/services/skill_status_tat_generator.py
//
// Python owns live values.
// This generated TAT file expresses current values as semantic status facts.
// -----------------------------------------------------------------------------

import {{
  heavyStrike,
  powerSwing,
  shieldGuard,
  ironWall,
  arcaneBolt,
  spellSurge,
  wardingMind,
  spellGuard,
  quickStep,
  initiative,
  preciseShot,
  weaponMastery,

  locked,
  unlockable,
  unlocked,

  requirementMet,
  requirementUnmet,
}} from "../character-builder.root.tat"

// -----------------------------------------------------------------------------
// Skill status view root
// -----------------------------------------------------------------------------

skillStatusViewRoot := <node {{
  id: skillStatusViewRoot,
  label: "Skill Status View",
  kind: reactFacingView,
  description: "Root node for dynamically generated React-facing skill status data.",
}}>

skillStatusCardsSection := <node {{
  id: skillStatusCardsSection,
  label: "Skill Status Cards",
  kind: viewSection,
  description: "Section containing one renderable card per interpreted skill status.",
}}>

skillRequirementSummarySection := <node {{
  id: skillRequirementSummarySection,
  label: "Skill Requirement Summary",
  kind: viewSection,
  description: "Section containing requirement summaries for interpreted skill statuses.",
}}>

skillExplanationSection := <node {{
  id: skillExplanationSection,
  label: "Skill Explanations",
  kind: viewSection,
  description: "Section containing explanation text for interpreted skill statuses.",
}}>

// -----------------------------------------------------------------------------
// Generated card nodes
// -----------------------------------------------------------------------------

{chr(10).join(card_nodes)}

// -----------------------------------------------------------------------------
// Generated requirement summary nodes
// -----------------------------------------------------------------------------

{chr(10).join(requirement_nodes)}

// -----------------------------------------------------------------------------
// Generated explanation nodes
// -----------------------------------------------------------------------------

{chr(10).join(explanation_nodes)}

// -----------------------------------------------------------------------------
// Root section edges
// -----------------------------------------------------------------------------

skillStatusViewIncludesCardsSection := {{
  skillStatusViewRoot : includesSection : skillStatusCardsSection
}}

skillStatusViewIncludesRequirementSummarySection := {{
  skillStatusViewRoot : includesSection : skillRequirementSummarySection
}}

skillStatusViewIncludesExplanationSection := {{
  skillStatusViewRoot : includesSection : skillExplanationSection
}}

// -----------------------------------------------------------------------------
// Generated card edges
// -----------------------------------------------------------------------------

{chr(10).join(card_edges)}

// -----------------------------------------------------------------------------
// Generated requirement edges
// -----------------------------------------------------------------------------

{chr(10).join(requirement_edges)}

// -----------------------------------------------------------------------------
// Generated explanation edges
// -----------------------------------------------------------------------------

{chr(10).join(explanation_edges)}

// -----------------------------------------------------------------------------
// Skill status view graph
// -----------------------------------------------------------------------------

skillStatusViewGraph := @seed(graph) {{
  node: [
    {", ".join(node_names)},
  ],

  edge: [
    {", ".join(edge_names)},
  ],

  meta: {{
    purpose: "Expose dynamically generated skill status cards, requirement summaries, and explanations.",
    owner: tat,
    targetConsumer: react,
    status: "pass_20_dynamic_skill_status_ready",
    bridgeNote: "Generated from Python-owned values while preserving TAT semantic status vocabulary.",
  }},

  root: skillStatusViewRoot,
}}

// -----------------------------------------------------------------------------
// Skill status view projection
// -----------------------------------------------------------------------------

skillStatusReactProjection := @project(graph) {{
  source: skillStatusViewGraph,
  format: tree,
  include: [
    nodes,
    edges,
    root,
    meta,
  ],
  purpose: "Expose React-facing dynamic skill status cards.",
}}

skillStatusReactProjectionView := skillStatusViewGraph <> skillStatusReactProjection(skillStatusViewGraph)

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {{
  skillStatusViewRoot,
  skillStatusViewGraph,
  skillStatusReactProjection,
  skillStatusReactProjectionView,

  {", ".join(name for name in node_names if name not in [
      "skillStatusViewRoot",
      "skillStatusCardsSection",
      "skillRequirementSummarySection",
      "skillExplanationSection",
  ])},
}}
"""


def _interpret_skill(
    rule: dict[str, Any],
    stats: dict[str, Any],
    unlocked_skill_ids: set[str],
) -> dict[str, Any]:
    skill = rule["skill"]
    stat = rule["stat"]
    required = int(rule["required"])
    actual = int(stats.get(stat, 0))
    dependency = rule.get("dependency")

    stat_met = actual >= required
    dependency_met = dependency is None or dependency in unlocked_skill_ids

    if skill in unlocked_skill_ids:
        status = "unlocked"
        display_status = "Unlocked"
    elif stat_met and dependency_met:
        status = "unlockable"
        display_status = "Unlockable"
    else:
        status = "locked"
        display_status = "Locked"

    stat_result = "requirementMet" if stat_met else "requirementUnmet"
    dependency_result = "requirementMet" if dependency_met else "requirementUnmet"

    if status == "unlocked":
        summary = f"{rule['label']} is already unlocked."
    elif status == "unlockable":
        summary = f"{rule['label']} is ready to unlock."
    elif not stat_met:
        summary = f"{rule['label']} is locked because {stat.title()} is too low."
    else:
        summary = f"{rule['label']} is locked because a dependency is missing."

    explanation = _build_explanation_text(
        rule=rule,
        actual=actual,
        stat_met=stat_met,
        dependency_met=dependency_met,
        status=status,
    )

    return {
        "actual": actual,
        "required": required,
        "status": status,
        "displayStatus": display_status,
        "summary": summary,
        "explanation": explanation,
        "statResult": stat_result,
        "dependencyResult": dependency_result,
        "statMet": stat_met,
        "dependencyMet": dependency_met,
    }


def _build_explanation_text(
    rule: dict[str, Any],
    actual: int,
    stat_met: bool,
    dependency_met: bool,
    status: str,
) -> str:
    label = rule["label"]
    stat_label = rule["stat"].title()
    required = rule["required"]
    dependency = rule.get("dependency")

    if status == "unlocked":
        return f"{label} is already unlocked because Python supplied it as an acquired skill."

    if status == "unlockable":
        if dependency:
            return (
                f"{label} is unlockable because {stat_label} {actual} meets "
                f"the required {stat_label} {required}, and {_label_case(dependency)} is unlocked."
            )

        return (
            f"{label} is unlockable because {stat_label} {actual} meets "
            f"the required {stat_label} {required}."
        )

    if not stat_met:
        return (
            f"{label} requires {stat_label} {required}, but the character has "
            f"{stat_label} {actual}."
        )

    if not dependency_met and dependency:
        return f"{label} requires {_label_case(dependency)} to be unlocked first."

    return f"{label} is currently locked."


def _build_card_node(
    rule: dict[str, Any],
    interpretation: dict[str, Any],
    names: dict[str, str],
) -> str:
    return f"""{names["card"]} := <node {{
  id: {names["card"]},
  label: "{rule["label"]} Status Card",
  kind: skillStatusCard,
  skill: {rule["skill"]},
  status: {interpretation["status"]},
  displayStatus: "{interpretation["displayStatus"]}",
  summary: "{_tat_string(interpretation["summary"])}",
  sortOrder: {rule["sortOrder"]},
  description: "React-facing card for {rule["label"]}'s dynamic unlock status.",
}}>"""


def _build_requirement_nodes(
    rule: dict[str, Any],
    interpretation: dict[str, Any],
    names: dict[str, str],
) -> list[str]:
    stat_label = rule["stat"].title()

    nodes = [
        f"""{names["statRequirement"]} := <node {{
  id: {names["statRequirement"]},
  label: "{rule["label"]} {stat_label} Requirement Summary",
  kind: requirementSummary,
  targetSkill: {rule["skill"]},
  result: {interpretation["statResult"]},
  displayResult: "{_result_label(interpretation["statResult"])}",
  actualValue: {interpretation["actual"]},
  requiredValue: {interpretation["required"]},
  summary: "{stat_label} {interpretation["actual"]} {_meets_phrase(interpretation["statMet"])} the required {stat_label} {interpretation["required"]}.",
  description: "React-facing stat requirement summary for {rule["label"]}.",
}}>"""
    ]

    if rule.get("dependency"):
        dependency = rule["dependency"]
        nodes.append(
            f"""{names["dependencyRequirement"]} := <node {{
  id: {names["dependencyRequirement"]},
  label: "{rule["label"]} Dependency Requirement Summary",
  kind: requirementSummary,
  targetSkill: {rule["skill"]},
  result: {interpretation["dependencyResult"]},
  displayResult: "{_result_label(interpretation["dependencyResult"])}",
  prerequisiteSkill: {dependency},
  summary: "{_label_case(dependency)} dependency {_is_met_phrase(interpretation["dependencyMet"])}.",
  description: "React-facing dependency requirement summary for {rule["label"]}.",
}}>"""
        )

    return nodes


def _build_explanation_node(
    rule: dict[str, Any],
    interpretation: dict[str, Any],
    names: dict[str, str],
) -> str:
    return f"""{names["explanation"]} := <node {{
  id: {names["explanation"]},
  label: "{rule["label"]} Renderable Explanation",
  kind: renderableExplanation,
  targetSkill: {rule["skill"]},
  text: "{_tat_string(interpretation["explanation"])}",
  description: "React-facing explanation text for {rule["label"]}.",
}}>"""


def _build_card_edges(
    rule: dict[str, Any],
    interpretation: dict[str, Any],
    names: dict[str, str],
) -> list[str]:
    return [
        f"""{names["sectionIncludesCardEdge"]} := {{
  skillStatusCardsSection : includesCard : {names["card"]}
}}""",
        f"""{names["cardTargetsSkillEdge"]} := {{
  {names["card"]} : targetsSkill : {rule["skill"]}
}}""",
        f"""{names["cardHasStatusEdge"]} := {{
  {names["card"]} : hasStatus : {interpretation["status"]}
}}""",
    ]


def _build_requirement_edges(
    rule: dict[str, Any],
    interpretation: dict[str, Any],
    names: dict[str, str],
) -> list[str]:
    edges = [
        f"""{names["cardHasRequirementEdge"]} := {{
  {names["card"]} : hasRequirementSummary : {names["statRequirement"]}
}}""",
        f"""{names["requirementHasResultEdge"]} := {{
  {names["statRequirement"]} : hasResult : {interpretation["statResult"]}
}}""",
        f"""{names["sectionIncludesRequirementEdge"]} := {{
  skillRequirementSummarySection : includesRequirementSummary : {names["statRequirement"]}
}}""",
    ]

    if rule.get("dependency"):
        edges.extend(
            [
                f"""{names["cardHasDependencyRequirementEdge"]} := {{
  {names["card"]} : hasRequirementSummary : {names["dependencyRequirement"]}
}}""",
                f"""{names["dependencyRequirementHasResultEdge"]} := {{
  {names["dependencyRequirement"]} : hasResult : {interpretation["dependencyResult"]}
}}""",
                f"""{names["sectionIncludesDependencyRequirementEdge"]} := {{
  skillRequirementSummarySection : includesRequirementSummary : {names["dependencyRequirement"]}
}}""",
            ]
        )

    return edges


def _build_explanation_edges(names: dict[str, str]) -> list[str]:
    return [
        f"""{names["cardHasExplanationEdge"]} := {{
  {names["card"]} : hasRenderableExplanation : {names["explanation"]}
}}""",
        f"""{names["sectionIncludesExplanationEdge"]} := {{
  skillExplanationSection : includesExplanation : {names["explanation"]}
}}""",
    ]


def _names_for_skill(skill_id: str) -> dict[str, str]:
    pascal = _pascal_case(skill_id)

    return {
        "card": f"{skill_id}StatusCard",
        "statRequirement": f"{skill_id}StatRequirementSummary",
        "dependencyRequirement": f"{skill_id}DependencyRequirementSummary",
        "explanation": f"{skill_id}RenderableExplanation",
        "sectionIncludesCardEdge": f"cardsSectionIncludes{pascal}Card",
        "cardTargetsSkillEdge": f"{skill_id}CardTargetsSkill",
        "cardHasStatusEdge": f"{skill_id}CardHasStatus",
        "cardHasRequirementEdge": f"{skill_id}CardHasRequirementSummary",
        "cardHasDependencyRequirementEdge": f"{skill_id}CardHasDependencyRequirementSummary",
        "requirementHasResultEdge": f"{skill_id}RequirementHasResult",
        "dependencyRequirementHasResultEdge": f"{skill_id}DependencyRequirementHasResult",
        "sectionIncludesRequirementEdge": f"requirementSectionIncludes{pascal}Summary",
        "sectionIncludesDependencyRequirementEdge": f"requirementSectionIncludes{pascal}DependencySummary",
        "cardHasExplanationEdge": f"{skill_id}CardHasRenderableExplanation",
        "sectionIncludesExplanationEdge": f"explanationSectionIncludes{pascal}Explanation",
    }


def _pascal_case(value: str) -> str:
    return value[:1].upper() + value[1:]


def _label_case(value: str) -> str:
    output = ""

    for index, char in enumerate(value):
        if index > 0 and char.isupper():
            output += " "

        output += char

    return output[:1].upper() + output[1:]


def _result_label(result: str) -> str:
    return "Met" if result == "requirementMet" else "Unmet"


def _meets_phrase(is_met: bool) -> str:
    return "meets" if is_met else "does not meet"


def _is_met_phrase(is_met: bool) -> str:
    return "is met" if is_met else "is not met"


def _tat_string(value: Any) -> str:
    return str(value).replace("\\", "\\\\").replace('"', '\\"')