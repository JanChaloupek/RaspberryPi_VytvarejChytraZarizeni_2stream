"""
API endpoints for actuators and logs
------------------------------------
"""

from pathlib import Path
from actuators.manager import ActuatorManager
import logging
from typing import Dict, Any, List
from services.api_utils import (
    make_api_response,
    make_api_response_error,
    getQueryLogsTail,
)

logger = logging.getLogger("api")


def api_read_led(act: ActuatorManager, sensor_id: str, query):
    actor_name = f"led_{sensor_id}"
    try:
        result = act.get_actor_states(actor_name)
        return make_api_response(query, result=result, status=200, log=True)
    except KeyError as ex:
        return make_api_response_error(query, str(ex), status=404)


def api_write_led(act: ActuatorManager, sensor_id: str, request, query):
    actor_name = f"led_{sensor_id}"
    try:
        data = request.get_json(force=True)
        on = bool(data.get("on"))
        act.set_actor(actor_name, on)
        logger.info("Změna LED: %s (sensor=%s)", data, sensor_id)
        result = act.get_actor_states(actor_name)
        return make_api_response(query, result=result, status=200, log=True)
    except Exception as ex:
        return make_api_response_error(query, str(ex), status=400)


def api_read_relay(act: ActuatorManager, sensor_id: str, query):
    actor_name = f"relay_{sensor_id}"
    try:
        result = act.get_actor_states(actor_name)
        # doplníme režim relé přímo do výsledku
        result["mode"] = act.get_relay_mode(sensor_id)
        return make_api_response(query, result=result, status=200, log=True)
    except KeyError as ex:
        return make_api_response_error(query, str(ex), status=404)


def api_write_relay(act: ActuatorManager, sensor_id: str, request, query):
    actor_name = f"relay_{sensor_id}"
    try:
        data = request.get_json(force=True)
        mode = data.get("mode")
        if mode != "auto":
            act.set_actor(actor_name, mode == "on")
        act.set_relay_mode(sensor_id, mode)
        logger.info("Změna relé: %s (sensor=%s)", data, sensor_id)
        result = act.get_actor_states(actor_name)
        result["mode"] = act.get_relay_mode(sensor_id)
        return make_api_response(query, result=result, status=200, log=True)
    except Exception as ex:
        return make_api_response_error(query, str(ex), status=400)


def api_read_setpoint(act: ActuatorManager, sensor_id: str, query):
    try:
        value = act.get_setpoint(sensor_id)
        return make_api_response(query, result={"value": value}, status=200, log=True)
    except Exception as ex:
        return make_api_response_error(query, str(ex), status=500)


def api_write_setpoint(act: ActuatorManager, sensor_id: str, request, query):
    try:
        data = request.get_json(force=True)
        new_value = float(data.get("value"))
        act.set_setpoint(sensor_id, new_value)
        value = act.get_setpoint(sensor_id)
        return make_api_response(query, result={"value": value}, status=200, log=True)
    except Exception as ex:
        return make_api_response_error(query, str(ex), status=400)


def get_logs_data(LOG_FILE: str, max_lines_count: int) -> Dict[str, Any]:
    if not Path(LOG_FILE).exists():
        return {"lines": [], "info": "Log file not found"}

    lines: List[bytes] = []
    with Path(LOG_FILE).open("rb") as f:
        f.seek(0, 2)
        filesize = f.tell()
        block_size = 1024
        data = b""
        blocks = -1
        while len(lines) <= max_lines_count and filesize > 0:
            if (filesize - block_size) > 0:
                f.seek(blocks * block_size, 2)
                chunk = f.read(block_size)
            else:
                f.seek(0, 0)
                chunk = f.read(filesize)
            data = chunk + data
            lines = data.splitlines()
            filesize -= block_size
            blocks -= 1
            if filesize <= 0:
                break

    decoded: List[str] = []
    for b in lines[-max_lines_count:]:
        try:
            decoded.append(b.decode("utf-8", errors="replace"))
        except Exception:
            decoded.append(b.decode("latin-1", errors="replace"))

    return {"lines": decoded}


def api_get_logs(LOG_FILE: str, max_lines_count: int):
    query = getQueryLogsTail()
    try:
        result = get_logs_data(LOG_FILE, max_lines_count)
        return make_api_response(query, result=result, status=200, log=True)
    except Exception as ex:
        logger.exception("Failed to tail log file: %s", ex)
        return make_api_response_error(query, "Failed to read log file", status=500)
