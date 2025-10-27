# api_utils.py
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

def make_api_response(query: dict, result, status: int = 200):
    """
    Zapouzdří odpověď API do tvaru:
    {
      "query": { ... },
      "result": ...   # list nebo objekt podle endpointu
    }
    Vrací tuple (jsonify(payload), status) v app route handleru.
    """
    payload = {
        "query": query,
        "result": result
    }
    
    # flask.jsonify volá se v app handleru přes návrat make_api_response(...) což vrací (Response, status)
    # zde pouze vrací payload a status; ve Flasku použijeme jsonify při vrácení
    from flask import jsonify
    return jsonify(payload), status
