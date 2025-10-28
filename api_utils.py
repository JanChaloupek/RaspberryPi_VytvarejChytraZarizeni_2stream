# api_utils.py
from flask import jsonify, Response
from typing import Optional, Any, Tuple, Dict
from collections.abc import Iterable

def getQueryDataSensors():
    return {
        "route": "/api/sensors",
        "method": "GET"
    }

def getQueryDataLatest(sensor_id):
    return {
        "route": "/api/latest/<sensor_id>",
        "method": "GET",
        "sensor_id": sensor_id,
    }

def getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset, tzinfo=None, start_iso=None, end_iso=None, group_by=None):
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

def log_data(key: str, num, data):
    if isinstance(data, list):
        # num může být int nebo bool; pokud je True, považuj to za "vypiš vše"
        max_items = None if num is True else int(num)
        count = 0
        for item in data:
            count += 1
            suffix = ""
            if max_items is not None and count >= max_items:
                suffix = "  ..."
            print("      ", key, "[]", item, suffix)
            if max_items is not None and count >= max_items:
                break
    else:
        print("      ", key, data)

def make_api_response_error(
        query: Dict[str, Any],
        error: Optional[Any],
        status: int,
        log: bool | int | str = True,
    ) -> Tuple:
    return make_api_response(query, None, error, status, log)

def make_api_response(
    query: Dict[str, Any],
    result: Optional[Any] = None,
    error: Optional[Any] = None,
    status: int = 200,
    log: bool | int | str = False,
) -> Tuple[Response, int]:
    """
    Zapouzdří odpověď API do tvaru:
    {
      "query": { ... },
      "result": ...,
      "error": ...
    }
    Vrací (Response, status) vhodné pro Flask route handler.
    """
    payload = {"query": query}

    if result is not None:
        if log:
            log_data("result", log, f"- {log}" if isinstance(log, str) else result)
        payload["result"] = result

    if error is not None:
        if log:
            log_data("error", log, f"- {log}" if isinstance(log, str) else error)
        payload["error"] = error

    return jsonify(payload), status
