# backend/app.py

from __future__ import annotations

from time import perf_counter

from flask import Flask, jsonify, request
from flask_cors import CORS

from data.character_state import (
    add_ailment,
    add_buff,
    gain_experience_points,
    get_character_state as read_character_state,
    reset_character_state,
    spend_health_points,
    spend_skill_points,
    train_stat,
    unlock_skill,
)
from data.skill_definitions import (
    create_skill_definition,
    get_skill_definitions as read_skill_definitions,
    reset_skill_definitions,
)
from services.skill_status_mapper import map_skill_status_response
from services.tat_runner import run_tat_module


app = Flask(__name__)
CORS(app)


@app.get("/api/health")
def health_check():
    return jsonify(
        {
            "ok": True,
            "service": "character-builder-backend",
            "architecture": {
                "python": "data and API orchestration",
                "tat": "semantics and relationships",
                "react": "rendering",
            },
        }
    )


@app.get("/api/character-builder/state")
def get_character_state():
    return jsonify(
        {
            "success": True,
            "state": read_character_state(),
        }
    )


@app.post("/api/character-builder/action")
def apply_character_builder_action():
    request_started_at = perf_counter()

    try:
        payload = request.get_json(silent=True) or {}

        action_type = payload.get("actionType")
        target = payload.get("target")
        amount = int(payload.get("amount", 1))

        if action_type == "trainStat":
            updated_state = train_stat(target, amount)

            return jsonify(
                {
                    "success": True,
                    "action": {
                        "actionType": action_type,
                        "target": target,
                        "amount": amount,
                    },
                    "state": updated_state,
                    "debug": {
                        "timings": {
                            "totalRequestMs": _elapsed_ms(request_started_at),
                        },
                    },
                }
            )

        if action_type == "unlockSkill":
            updated_state = unlock_skill(target)

            return jsonify(
                {
                    "success": True,
                    "action": {
                        "actionType": action_type,
                        "target": target,
                    },
                    "state": updated_state,
                    "debug": {
                        "timings": {
                            "totalRequestMs": _elapsed_ms(request_started_at),
                        },
                    },
                }
            )

        if action_type == "resetCharacter":
            updated_state = reset_character_state()

            return jsonify(
                {
                    "success": True,
                    "action": {
                        "actionType": action_type,
                    },
                    "state": updated_state,
                    "debug": {
                        "timings": {
                            "totalRequestMs": _elapsed_ms(request_started_at),
                        },
                    },
                }
            )

        return (
            jsonify(
                {
                    "success": False,
                    "error": f"Unsupported actionType: {action_type}",
                    "debug": {
                        "timings": {
                            "totalRequestMs": _elapsed_ms(request_started_at),
                        },
                    },
                }
            ),
            400,
        )

    except Exception as error:
        return (
            jsonify(
                {
                    "success": False,
                    "error": str(error),
                    "debug": {
                        "errorType": type(error).__name__,
                        "timings": {
                            "totalRequestMs": _elapsed_ms(request_started_at),
                        },
                    },
                }
            ),
            400,
        )


@app.get("/api/character-builder/skill-status")
def get_skill_status():
    request_started_at = perf_counter()

    try:
        tat_started_at = perf_counter()
        tat_result = run_tat_module("tat/runtime/skill-status.pipeline.tat")
        run_tat_module_ms = _elapsed_ms(tat_started_at)

        map_started_at = perf_counter()
        mapped_skill_status = map_skill_status_response(tat_result)
        map_skill_status_ms = _elapsed_ms(map_started_at)

        runner_timings = tat_result.get("timings", {})

        return jsonify(
            {
                "success": tat_result.get("success", False)
                and mapped_skill_status.get("success", False),
                "tatStatus": tat_result.get("status"),
                "state": read_character_state(),
                "skillStatus": mapped_skill_status,
                "debug": {
                    "modulePath": tat_result.get("modulePath"),
                    "diagnostics": tat_result.get("diagnostics", []),
                    "events": tat_result.get("events", []),
                    "tatResultKeys": list(tat_result.keys()),
                    "graphKeys": list(tat_result.get("graphs", {}).keys()),
                    "stdoutPreview": tat_result.get("stdout", "")[:1000],
                    "stderrPreview": tat_result.get("stderr", "")[:1000],
                    "returnCode": tat_result.get("returnCode"),
                    "timings": {
                        **runner_timings,
                        "runTatModuleWrapperMs": run_tat_module_ms,
                        "mapSkillStatusMs": map_skill_status_ms,
                        "totalRequestMs": _elapsed_ms(request_started_at),
                    },
                },
            }
        )

    except Exception as error:
        return (
            jsonify(
                {
                    "success": False,
                    "tatStatus": "backend_error",
                    "skillStatus": {
                        "success": False,
                        "cards": [],
                        "error": "Backend failed while building skill status response.",
                    },
                    "debug": {
                        "errorType": type(error).__name__,
                        "error": str(error),
                        "timings": {
                            "totalRequestMs": _elapsed_ms(request_started_at),
                        },
                    },
                }
            ),
            500,
        )

@app.get("/api/character-builder/skills")
def get_character_builder_skills():
    return jsonify(
        {
            "success": True,
            "skills": read_skill_definitions(),
        }
    )


@app.post("/api/character-builder/skills")
def create_character_builder_skill():
    try:
        payload = request.get_json(silent=True) or {}
        created_skill = create_skill_definition(payload)

        return jsonify(
            {
                "success": True,
                "skill": created_skill,
                "skills": read_skill_definitions(),
            }
        )

    except Exception as error:
        return (
            jsonify(
                {
                    "success": False,
                    "error": str(error),
                }
            ),
            400,
        )


@app.post("/api/character-builder/skills/reset")
def reset_character_builder_skills():
    return jsonify(
        {
            "success": True,
            "skills": reset_skill_definitions(),
        }
    )

def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 2)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)