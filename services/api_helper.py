# api_utils.py
from flask import Response, jsonify
from typing import Optional, Any, Tuple, Dict
import logging

logger = logging.getLogger("api")

def getQueryLogsTail():
    return {"route": "/api/logs/tail", "method": "GET"}

def getQueryDataSensors():
    return {"route": "/api/sensors", "method": "GET"}

def getQueryDataLatest(sensor_id: str) -> Dict:
    return {"route": "/api/latest/<sensor_id>", "method": "GET", "sensor_id": sensor_id}

def getQueryDataAggregate(sensor_id: str, level: str, key: str,
                          tz_name: str, tz_offset: str,
                          tzinfo=None, start_iso=None, end_iso=None, group_by=None) -> Dict:
    return {
        "route": "/api/aggregate/<sensor_id>/<level>/<key>",
        "method": "GET",
        "sensor_id": sensor_id,
        "level": level,
        "key": key,
        "tz": tz_name,
        "tz_offset": tz_offset,
        "resolved_tz": None if tzinfo is None else getattr(tzinfo, "key", None) or str(tzinfo),
        "start_utc": start_iso,
        "end_utc": end_iso,
        "group_by": group_by,
    }

def getQueryDataActor(method: str, actor_name: str) -> Dict:
    return {"route": "/api/actuators/<actor_name>", "actor_name": actor_name, "method": method}

def getQueryDataSetpoint(method: str, actor_name: str) -> Dict:
    return {"route": "/api/actuators/<actor_name>/setpoint", "actor_name": actor_name, "method": method}

def log_data(key: str, num: int | bool, data: Any) -> None:
    if isinstance(data, list):
        max_items = None if num is True else int(num)
        for count, item in enumerate(data, start=1):
            suffix = "  ..." if max_items is not None and count >= max_items else ""
            logger.debug(f"      {key}[]{item}{suffix}")
            if max_items is not None and count >= max_items:
                break
    else:
        logger.debug(f"      {key}{data}")

def make_api_response(query: Dict[str, Any],
                      result: Optional[Any] = None,
                      error: Optional[Any] = None,
                      status: int = 200,
                      log: bool | int | str = False) -> Tuple[Response, int]:
    payload = {"query": query}
    if result is not None:
        if log:
            log_data("result", log, result)
        payload["result"] = result
    if error is not None:
        if log:
            log_data("error", log, error)
        payload["error"] = error
        logger.error("API error: %s", error)
    return jsonify(payload), status

def make_api_response_error(query: Dict[str, Any],
                            error: Optional[Any],
                            status: int,
                            log: bool | int | str = True) -> Tuple[Response, int]:
    return make_api_response(query, None, error, status, log)
