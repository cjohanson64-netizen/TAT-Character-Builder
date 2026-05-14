# backend/services/skill_status_mapper.py

from __future__ import annotations

from typing import Any


def map_skill_status_response(tat_result: dict[str, Any]) -> dict[str, Any]:
    """
    Convert TAT's skillStatusViewGraph into clean React-ready skill card JSON.

    Python is not deciding skill status here.
    Python is only reshaping TAT's semantic graph/state for API delivery.
    """

    graphs = tat_result.get("graphs", {})
    graph = graphs.get("skillStatusViewGraph")

    if not graph:
        return {
            "success": False,
            "error": "skillStatusViewGraph was not found in TAT result.",
            "cards": [],
        }

    nodes = graph.get("nodes", {})
    edges = graph.get("edges", {})
    state = graph.get("state", {})

    cards = _extract_skill_cards(nodes, edges, state)
    user_skills = _extract_user_skills(nodes, edges, state)

    return {
        "success": True,
        "sourceGraph": "skillStatusViewGraph",
        "cards": cards,
        "userSkills": user_skills,
    }
    
def _extract_skill_cards(
    nodes: dict[str, dict[str, Any]],
    edges: dict[str, dict[str, Any]],
    state: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    card_nodes = [
        _node_with_state(node, state)
        for node in nodes.values()
        if _node_with_state(node, state).get("kind") == "skillStatusCard"
    ]

    cards = []

    for card_node in card_nodes:
        card_id = card_node.get("id")

        requirement_summaries = _get_connected_nodes(
            source_id=card_id,
            relation="hasRequirementSummary",
            nodes=nodes,
            edges=edges,
            state=state,
        )

        explanations = _get_connected_nodes(
            source_id=card_id,
            relation="hasRenderableExplanation",
            nodes=nodes,
            edges=edges,
            state=state,
        )

        cards.append(
            {
                "id": card_id,
                "label": card_node.get("label"),
                "skill": card_node.get("skill"),
                "status": card_node.get("status"),
                "displayStatus": card_node.get("displayStatus"),
                "summary": card_node.get("summary"),
                "sortOrder": card_node.get("sortOrder", 999),
                "requirements": [
                    _map_requirement_summary(summary)
                    for summary in requirement_summaries
                ],
                "explanations": [
                    _map_explanation(explanation)
                    for explanation in explanations
                ],
            }
        )

    return sorted(cards, key=lambda card: card["sortOrder"])

def _extract_user_skills(
    nodes: dict[str, dict[str, Any]],
    edges: dict[str, dict[str, Any]],
    state: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    user_skill_nodes = [
        _node_with_state(node, state)
        for node in nodes.values()
        if _node_with_state(node, state).get("kind") == "userSkill"
    ]

    user_skills = []

    for skill_node in user_skill_nodes:
        skill_id = skill_node.get("id")

        requirements = _get_connected_nodes(
            source_id=skill_id,
            relation="hasRequirement",
            nodes=nodes,
            edges=edges,
            state=state,
        )

        costs = _get_connected_nodes(
            source_id=skill_id,
            relation="hasCost",
            nodes=nodes,
            edges=edges,
            state=state,
        )

        effects = _get_connected_nodes(
            source_id=skill_id,
            relation="hasEffect",
            nodes=nodes,
            edges=edges,
            state=state,
        )

        user_skills.append(
            {
                "id": skill_id,
                "label": skill_node.get("label"),
                "description": skill_node.get("description"),
                "sortOrder": skill_node.get("sortOrder", 999),
                "requirements": [_map_user_skill_requirement(node) for node in requirements],
                "costs": [_map_user_skill_cost(node) for node in costs],
                "effects": [_map_user_skill_effect(node) for node in effects],
            }
        )

    return sorted(user_skills, key=lambda skill: skill["sortOrder"])


def _map_user_skill_requirement(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("id"),
        "label": node.get("label"),
        "kind": node.get("kind"),
        "targetSkill": node.get("targetSkill"),
        "stat": node.get("stat"),
        "operator": node.get("operator"),
        "requiredValue": node.get("requiredValue"),
        "requiredSkill": node.get("requiredSkill"),
        "requiredStatus": node.get("requiredStatus"),
        "requiredClass": node.get("requiredClass"),
    }


def _map_user_skill_cost(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("id"),
        "label": node.get("label"),
        "kind": node.get("kind"),
        "targetSkill": node.get("targetSkill"),
        "value": node.get("value"),
    }


def _map_user_skill_effect(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("id"),
        "label": node.get("label"),
        "kind": node.get("kind"),
        "targetSkill": node.get("targetSkill"),
        "baseDamage": node.get("baseDamage"),
        "baseHealAmount": node.get("baseHealAmount"),
        "damageType": node.get("damageType"),
        "buff": node.get("buff"),
        "ailment": node.get("ailment"),
        "target": node.get("target"),
    }

def _node_data(node: dict[str, Any]) -> dict[str, Any]:
    return node.get("data", node)

def _get_connected_nodes(
    source_id: str | None,
    relation: str,
    nodes: dict[str, dict[str, Any]],
    edges: dict[str, dict[str, Any]],
    state: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    if not source_id:
        return []

    connected = []

    for edge in edges.values():
        if edge.get("from") != source_id:
            continue

        if edge.get("relation") != relation:
            continue

        target_id = edge.get("to")
        target_node = nodes.get(target_id)

        if target_node:
            connected.append(_node_with_state(target_node, state))

    return connected

def _map_requirement_summary(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("id"),
        "label": node.get("label"),
        "targetSkill": node.get("targetSkill"),
        "result": node.get("result"),
        "displayResult": node.get("displayResult"),
        "actualValue": node.get("actualValue"),
        "requiredValue": node.get("requiredValue"),
        "prerequisiteSkill": node.get("prerequisiteSkill"),
        "summary": node.get("summary"),
    }


def _map_explanation(node: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": node.get("id"),
        "label": node.get("label"),
        "targetSkill": node.get("targetSkill"),
        "text": node.get("text"),
    }
    
def _node_with_state(
    node: dict[str, Any],
    state: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    data = _node_data(node)
    node_id = data.get("id") or node.get("id")

    if not node_id:
        return data

    return {
        **data,
        **state.get(node_id, {}),
    }