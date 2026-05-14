# backend/data/skill_definitions.py

from __future__ import annotations

from copy import deepcopy
from typing import Any
from uuid import uuid4


DEFAULT_SKILL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "id": "heavyStrike",
        "name": "Heavy Strike",
        "description": "A powerful weapon attack.",
        "requirements": {
            "stats": [
                {
                    "stat": "strength",
                    "operator": ">=",
                    "value": 8,
                }
            ],
            "skills": [],
            "level": None,
            "characterClass": None,
        },
        "cost": {
            "skillPoints": 2,
            "healthPoints": 0,
        },
        "effects": {
            "baseDamage": 10,
            "baseHealAmount": 0,
            "damageType": "physical",
            "buffs": [],
            "statusAilments": [],
            "target": "enemy",
        },
    },
]


_skill_definitions: list[dict[str, Any]] = deepcopy(DEFAULT_SKILL_DEFINITIONS)


def get_skill_definitions() -> list[dict[str, Any]]:
    return deepcopy(_skill_definitions)


def reset_skill_definitions() -> list[dict[str, Any]]:
    global _skill_definitions

    _skill_definitions = deepcopy(DEFAULT_SKILL_DEFINITIONS)

    return get_skill_definitions()


def create_skill_definition(payload: dict[str, Any]) -> dict[str, Any]:
    skill = normalize_skill_definition(payload)

    _skill_definitions.append(skill)

    return deepcopy(skill)


def normalize_skill_definition(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize raw user form input into the stored skill-definition shape.

    This does not decide whether the skill is usable, unlocked, valid, ready,
    balanced, affordable, or semantically meaningful. TAT owns those meanings.
    """

    skill_id = _safe_id(payload.get("id") or payload.get("name") or f"skill_{uuid4().hex[:8]}")

    return {
        "id": skill_id,
        "name": str(payload.get("name") or "Untitled Skill").strip() or "Untitled Skill",
        "description": str(payload.get("description") or "").strip(),
        "requirements": _normalize_requirements(payload.get("requirements") or {}),
        "cost": _normalize_cost(payload.get("cost") or {}),
        "effects": _normalize_effects(payload.get("effects") or {}),
    }


def _normalize_requirements(requirements: dict[str, Any]) -> dict[str, Any]:
    return {
        "stats": [
            _normalize_stat_requirement(requirement)
            for requirement in requirements.get("stats", [])
            if isinstance(requirement, dict)
        ],
        "skills": [
            _normalize_skill_requirement(requirement)
            for requirement in requirements.get("skills", [])
            if isinstance(requirement, dict)
        ],
        "level": _normalize_level_requirement(requirements.get("level")),
        "characterClass": _optional_string(requirements.get("characterClass")),
    }


def _normalize_stat_requirement(requirement: dict[str, Any]) -> dict[str, Any]:
    return {
        "stat": _safe_id(requirement.get("stat") or "strength"),
        "operator": _normalize_operator(requirement.get("operator")),
        "value": _int_or_zero(requirement.get("value")),
    }


def _normalize_skill_requirement(requirement: dict[str, Any]) -> dict[str, Any]:
    return {
        "skillId": _safe_id(requirement.get("skillId") or requirement.get("id") or ""),
        "status": _safe_id(requirement.get("status") or "learned"),
    }


def _normalize_level_requirement(level: Any) -> dict[str, Any] | None:
    if level is None:
        return None

    if isinstance(level, dict):
        return {
            "operator": _normalize_operator(level.get("operator")),
            "value": _int_or_zero(level.get("value")),
        }

    return {
        "operator": ">=",
        "value": _int_or_zero(level),
    }


def _normalize_cost(cost: dict[str, Any]) -> dict[str, int]:
    return {
        "skillPoints": max(0, _int_or_zero(cost.get("skillPoints"))),
        "healthPoints": max(0, _int_or_zero(cost.get("healthPoints"))),
    }


def _normalize_effects(effects: dict[str, Any]) -> dict[str, Any]:
    return {
        "baseDamage": max(0, _int_or_zero(effects.get("baseDamage"))),
        "baseHealAmount": max(0, _int_or_zero(effects.get("baseHealAmount"))),
        "damageType": _safe_id(effects.get("damageType") or "physical"),
        "buffs": [_safe_id(value) for value in effects.get("buffs", []) if value],
        "statusAilments": [
            _safe_id(value)
            for value in effects.get("statusAilments", [])
            if value
        ],
        "target": _normalize_target(effects.get("target")),
    }


def _normalize_operator(value: Any) -> str:
    operator = str(value or ">=").strip()

    if operator in {">=", ">", "<=", "<", "==", "!="}:
        return operator

    return ">="


def _normalize_target(value: Any) -> str:
    target = _safe_id(value or "enemy")

    if target in {"self", "ally", "enemy"}:
        return target

    return "enemy"


def _optional_string(value: Any) -> str | None:
    if value is None:
        return None

    text = str(value).strip()

    return text or None


def _safe_id(value: Any) -> str:
    text = str(value or "").strip()

    if not text:
        return ""

    parts = []
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


def _int_or_zero(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0