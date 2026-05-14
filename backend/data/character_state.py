# backend/data/character_state.py

from __future__ import annotations

from copy import deepcopy
from typing import Any


DEFAULT_CHARACTER_STATE: dict[str, Any] = {
    "character": {
        "id": "hero_001",
        "name": "Ari",
        "characterClass": "warrior",
        "level": 1,
        "experiencePoints": 0,
    },
    "resources": {
        "healthPoints": {
            "current": 30,
            "max": 30,
        },
        "skillPoints": {
            "current": 10,
            "max": 10,
        },
    },
    "stats": {
        "strength": 8,
        "defense": 6,
        "intelligence": 4,
        "resistance": 5,
        "speed": 7,
        "dexterity": 6,
    },
    "status": {
        "buffs": [],
        "ailments": [],
    },
    "unlockedSkillIds": [
        "heavyStrike",
    ],
}


_character_state: dict[str, Any] = deepcopy(DEFAULT_CHARACTER_STATE)


def get_character_state() -> dict[str, Any]:
    return deepcopy(_character_state)


def reset_character_state() -> dict[str, Any]:
    global _character_state

    _character_state = deepcopy(DEFAULT_CHARACTER_STATE)

    return get_character_state()


def train_stat(stat_name: str | None, amount: int = 1) -> dict[str, Any]:
    if not stat_name:
        return get_character_state()

    stats = _character_state.setdefault("stats", {})

    if stat_name not in stats:
        return get_character_state()

    stats[stat_name] += amount

    return get_character_state()


def unlock_skill(skill_id: str | None) -> dict[str, Any]:
    if not skill_id:
        return get_character_state()

    unlocked_skill_ids = _character_state.setdefault("unlockedSkillIds", [])

    if skill_id not in unlocked_skill_ids:
        unlocked_skill_ids.append(skill_id)

    return get_character_state()


def spend_skill_points(amount: int) -> dict[str, Any]:
    resources = _character_state.setdefault("resources", {})
    skill_points = resources.setdefault("skillPoints", {"current": 0, "max": 0})

    skill_points["current"] = max(0, int(skill_points.get("current", 0)) - amount)

    return get_character_state()


def spend_health_points(amount: int) -> dict[str, Any]:
    resources = _character_state.setdefault("resources", {})
    health_points = resources.setdefault("healthPoints", {"current": 0, "max": 0})

    health_points["current"] = max(0, int(health_points.get("current", 0)) - amount)

    return get_character_state()


def gain_experience_points(amount: int) -> dict[str, Any]:
    character = _character_state.setdefault("character", {})
    character["experiencePoints"] = int(character.get("experiencePoints", 0)) + amount

    return get_character_state()


def add_buff(buff_id: str | None) -> dict[str, Any]:
    if not buff_id:
        return get_character_state()

    status = _character_state.setdefault("status", {})
    buffs = status.setdefault("buffs", [])

    if buff_id not in buffs:
        buffs.append(buff_id)

    return get_character_state()


def add_ailment(ailment_id: str | None) -> dict[str, Any]:
    if not ailment_id:
        return get_character_state()

    status = _character_state.setdefault("status", {})
    ailments = status.setdefault("ailments", [])

    if ailment_id not in ailments:
        ailments.append(ailment_id)

    return get_character_state()