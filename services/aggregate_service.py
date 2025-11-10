# services/aggregate_service.py
from datetime import datetime, timezone
from services.time_utils import resolve_tz, parse_local_key_to_range, to_local_iso_from_utc
from db import SqlSensorData

def _round2(value):
    return round(value, 2) if value is not None else None

def _normalize_aggregated_row(row, tzinfo):
    """
    Převod tvaru vráceného z get_aggregated na požadované výstupní sloupce
    a zaokrouhlení průměrů na 2 desetinná místa.
    """
    key_str = row.get("key")
    parsed_utc = None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H", "%Y-%m-%d", "%Y-%m"):
        try:
            parsed_utc = datetime.strptime(key_str, fmt).replace(tzinfo=timezone.utc)
            break
        except Exception:
            continue
    if parsed_utc is None:
        local_iso = key_str
    else:
        local_iso = to_local_iso_from_utc(parsed_utc, tzinfo)

    return {
        "key": local_iso,
        "temperature": _round2(row.get("avg_temp")),
        "humidity": _round2(row.get("avg_hum")),
        "count": int(row.get("count") or 0)
    }

def _normalize_measurement_row(row, tzinfo):
    """
    Převod jednotlivého měření na požadovaný tvar pro raw s zaokrouhlením na 2 desetinná místa.
    """
    ts_txt = row.get("timestamp")
    try:
        dt = datetime.strptime(ts_txt, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        key = to_local_iso_from_utc(dt, tzinfo)
    except Exception:
        key = ts_txt
    return {
        "key": key,
        "temperature": _round2(row.get("temperature")),
        "humidity": _round2(row.get("humidity")),
        "count": 1
    }

def handle_aggregate(sensor_id: str, level: str, tzinfo, start_iso: str, end_iso: str, group_by: str):
    """
    Hlavní rozhraní: vrací list dict s poli key, temperature, humidity, count.
    """
    with SqlSensorData() as db:
        if level == "raw":
            rows = db.get_measurements_range(sensor_id, start_iso, end_iso)
            result = [_normalize_measurement_row(r, tzinfo) for r in rows]
            return result

        if not group_by:
            raise ValueError("Aggregation group_by is not defined for this level")

        rows = db.get_aggregated(sensor_id, start_iso, end_iso, group_by)
        result = [_normalize_aggregated_row(r, tzinfo) for r in rows]

        return result

def api_aggregate(sensor_id, level, key, tzinfo):
    try:
        if level not in ('monthly', 'daily', 'hourly', 'minutely', 'raw'):
            # zaslana uroven mimo vyjmenovane
            return 400, "Unsupported level", None, None, None, None

        start_iso, end_iso, group_by = parse_local_key_to_range(level, key, tzinfo)
    except ValueError as e:
        # nastala vyjimka pri dekodovani dat
        return 400, str(e), None, None, None, None

    try:
        result = handle_aggregate(sensor_id, level, tzinfo, start_iso, end_iso, group_by)

    except Exception as e:
        # spadlo to pri ziskavani dat
        return 500, str(e), None, start_iso, end_iso, group_by

    return None, None, result, start_iso, end_iso, group_by
