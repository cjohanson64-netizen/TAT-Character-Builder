# backend/services/tat_runner.py

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from time import perf_counter
from typing import Any

from data.character_state import get_character_state
from services.runtime_tat_generator import write_runtime_tat_instance
from services.skill_definition_tat_generator import write_skill_definitions_tat_instance


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def run_tat_module(relative_module_path: str) -> dict[str, Any]:
    """
    Run a TAT module through the JSON-focused TypeScript TAT runner.

    Python owns orchestration/data access here.
    TAT owns the semantics inside the .tat files.
    """

    started_at = perf_counter()

    current_state = get_character_state()

    write_started_at = perf_counter()
    write_runtime_tat_instance(current_state)
    write_skill_definitions_tat_instance()
    write_runtime_facts_ms = _elapsed_ms(write_started_at)

    module_path = PROJECT_ROOT / relative_module_path

    if not module_path.exists():
        return {
            "success": False,
            "status": "missing_file",
            "diagnostics": [
                {
                    "severity": "error",
                    "message": f"TAT module not found: {module_path}",
                }
            ],
            "graphs": {},
            "networks": {},
            "projections": {},
            "exports": {},
            "events": [],
            "modulePath": str(module_path),
            "timings": {
                "writeRuntimeFactsMs": write_runtime_facts_ms,
                "tatRunnerMs": 0,
                "totalTatModuleMs": _elapsed_ms(started_at),
            },
        }

    command = [
        "node",
        "tat-library/dist/run-module-json.cjs",
        relative_module_path,
        "--graph",
        "skillStatusViewGraph",
        "--inject",
        "character_runtime_facts=tat/runtime/character-builder-runtime.generated.tat",
        "--inject",
        "user_skill_definitions=tat/runtime/skill-definitions.generated.tat",
    ]

    runner_started_at = perf_counter()

    try:
        result = subprocess.run(
            command,
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=False,
            timeout=20,
        )
    except subprocess.TimeoutExpired as error:
        tat_runner_ms = _elapsed_ms(runner_started_at)

        return {
            "success": False,
            "status": "timeout",
            "diagnostics": [
                {
                    "severity": "error",
                    "message": "TAT module execution timed out.",
                }
            ],
            "stdout": error.stdout or "",
            "stderr": error.stderr or "",
            "graphs": {},
            "networks": {},
            "projections": {},
            "exports": {},
            "events": [],
            "modulePath": str(module_path),
            "timings": {
                "writeRuntimeFactsMs": write_runtime_facts_ms,
                "tatRunnerMs": tat_runner_ms,
                "totalTatModuleMs": _elapsed_ms(started_at),
            },
        }

    tat_runner_ms = _elapsed_ms(runner_started_at)

    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        payload = _extract_json_payload(result.stdout)

        if payload is None:
            return {
                "success": False,
                "status": "invalid_json",
                "diagnostics": [
                    {
                        "severity": "error",
                        "message": "TAT JSON runner returned invalid JSON.",
                        "jsonError": str(error),
                        "errorLine": error.lineno,
                        "errorColumn": error.colno,
                        "errorPosition": error.pos,
                        "nearError": result.stdout[
                            max(0, error.pos - 300) : error.pos + 300
                        ],
                    }
                ],
                "stdout": result.stdout,
                "stderr": result.stderr,
                "graphs": {},
                "networks": {},
                "projections": {},
                "exports": {},
                "events": [],
                "modulePath": str(module_path),
                "returnCode": result.returncode,
                "timings": {
                    "writeRuntimeFactsMs": write_runtime_facts_ms,
                    "tatRunnerMs": tat_runner_ms,
                    "totalTatModuleMs": _elapsed_ms(started_at),
                },
            }

    payload["returnCode"] = result.returncode
    payload["stderr"] = result.stderr
    payload["timings"] = {
        "writeRuntimeFactsMs": write_runtime_facts_ms,
        "tatRunnerMs": tat_runner_ms,
        "totalTatModuleMs": _elapsed_ms(started_at),
    }

    return payload


def _extract_json_payload(stdout: str) -> dict[str, Any] | None:
    """
    Fallback parser for cases where the command writes extra text before/after
    the JSON payload.

    Only accept the top-level TAT runner envelope, not nested graph objects.
    """

    decoder = json.JSONDecoder()

    for index, char in enumerate(stdout):
        if char != "{":
            continue

        try:
            payload, _end = decoder.raw_decode(stdout[index:])
        except json.JSONDecodeError:
            continue

        if not isinstance(payload, dict):
            continue

        if "success" in payload and "status" in payload and "graphs" in payload:
            return payload

    return None


def _elapsed_ms(started_at: float) -> float:
    return round((perf_counter() - started_at) * 1000, 2)