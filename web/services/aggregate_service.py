# services/aggregate_service.py
"""
Aggregate service
-----------------

Účel:
- Poskytuje funkce pro agregaci a normalizaci dat ze senzorů.
- Převádí surová i agregovaná měření do jednotného tvaru pro API.
- Doplní výpočet rosného bodu (dew point) na základě teploty a vlhkosti.

Závislosti:
- datetime, timezone (pro práci s časem)
- services.time_utils (resolve_tz, parse_local_key_to_range, to_local_iso_from_utc)
- db.SqlSensorData (přístup k SQLite databázi)
- math (logaritmus pro výpočet rosného bodu)

Hlavní rozhraní:
- `handle_aggregate(...)` → vrací list dictů s agregovanými nebo raw daty.
- `api_aggregate(...)` → API wrapper, vrací tuple (status, message, result, start_iso, end_iso, group_by).

Výstupní formát dat:
{
    "key": <časový klíč ISO>,
    "temperature": <float|None>,
    "humidity": <float|None>,
    "dew_point": <float|None>,
    "count": <int>
}
"""

from datetime import datetime, timezone
from services.time_utils import resolve_tz, parse_local_key_to_range, to_local_iso_from_utc
from db import SqlSensorData
import math
from typing import Optional, Dict, Any, List, Tuple


def _round2(value: Optional[float]) -> Optional[float]:
    """
    Zaokrouhlí hodnotu na 2 desetinná místa.
    Vrací None pokud vstup je None.

    Parametry:
    - value: číslo nebo None

    Návratová hodnota:
    - float nebo None
    """
    return round(value, 2) if value is not None else None


def compute_dew_point(temp_c: Optional[float], humidity: Optional[float]) -> Optional[float]:
    """
    Výpočet rosného bodu (°C) z teploty a relativní vlhkosti.
    Vrací None pokud vstupy nejsou validní.

    Parametry:
    - temp_c: teplota v °C
    - humidity: relativní vlhkost v %

    Návratová hodnota:
    - float (rosný bod °C) nebo None
    """
    if temp_c is None or humidity is None:
        return None
    try:
        a, b = 17.27, 237.7
        gamma = (a * temp_c) / (b + temp_c) + math.log(humidity / 100.0)
        return round((b * gamma) / (a - gamma), 2)
    except Exception:
        return None


def _normalize_aggregated_row(row: Dict[str, Any], tzinfo) -> Dict[str, Any]:
    """
    Normalizuje řádek z get_aggregated:
    - převede klíč na lokální ISO čas
    - zaokrouhlí průměry na 2 desetinná místa
    - doplní rosný bod

    Parametry:
    - row: dict s klíči { key, avg_temp, avg_hum, count }
    - tzinfo: časová zóna

    Návratová hodnota:
    - dict { key, temperature, humidity, dew_point, count }
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

    temp = _round2(row.get("avg_temp"))
    hum = _round2(row.get("avg_hum"))
    dew = _round2(compute_dew_point(temp, hum))

    return {
        "key": local_iso,
        "temperature": temp,
        "humidity": hum,
        "dew_point": dew,
        "count": int(row.get("count") or 0)
    }


def _normalize_measurement_row(row: Dict[str, Any], tzinfo) -> Dict[str, Any]:
    """
    Normalizuje jednotlivé měření:
    - převede timestamp na lokální ISO čas
    - zaokrouhlí hodnoty
    - doplní rosný bod

    Parametry:
    - row: dict { timestamp, temperature, humidity }
    - tzinfo: časová zóna

    Návratová hodnota:
    - dict { key, temperature, humidity, dew_point, count }
    """
    ts_txt = row.get("timestamp")
    try:
        dt = datetime.strptime(ts_txt, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        key = to_local_iso_from_utc(dt, tzinfo)
    except Exception:
        key = ts_txt

    temp = _round2(row.get("temperature"))
    hum = _round2(row.get("humidity"))
    dew = _round2(compute_dew_point(temp, hum))

    return {
        "key": key,
        "temperature": temp,
        "humidity": hum,
        "dew_point": dew,
        "count": 1
    }


def handle_aggregate(sensor_id: str, level: str, tzinfo, start_iso: str, end_iso: str, group_by: Optional[str]) -> List[Dict[str, Any]]:
    """
    Hlavní rozhraní: vrací list dict s poli key, temperature, humidity, dew_point, count.

    Parametry:
    - sensor_id: ID senzoru
    - level: úroveň agregace ("raw", "hourly", "daily", "monthly", "minutely")
    - tzinfo: časová zóna
    - start_iso, end_iso: časové rozmezí (ISO string)
    - group_by: pattern pro strftime (None pro raw)

    Návratová hodnota:
    - List[Dict[str, Any]]: normalizovaná data
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


def api_aggregate(sensor_id: str, level: str, key: str, tzinfo) -> Tuple[Optional[int], Optional[str], Optional[List[Dict[str, Any]]], Optional[str], Optional[str], Optional[str]]:
    """
    API wrapper pro agregaci.
    Vrací tuple (status_code, message, result, start_iso, end_iso, group_by).

    Parametry:
    - sensor_id: ID senzoru
    - level: úroveň ("monthly", "daily", "hourly", "minutely", "raw")
    - key: časový klíč (např. "2025-11-01")
    - tzinfo: časová zóna

    Návratová hodnota:
    - Tuple:
        - status_code: int nebo None
        - message: str nebo None
        - result: List[Dict[str, Any]] nebo None
        - start_iso: str nebo None
        - end_iso: str nebo None
        - group_by: str nebo None
    """
    try:
        if level not in ('monthly', 'daily', 'hourly', 'minutely', 'raw'):
            return 400, "Unsupported level", None, None, None, None

        start_iso, end_iso, group_by = parse_local_key_to_range(level, key, tzinfo)
    except ValueError as e:
        return 400, str(e), None, None, None, None

    try:
        result = handle_aggregate(sensor_id, level, tzinfo, start_iso, end_iso, group_by)
    except Exception as e:
        return 500, str(e), None, start_iso, end_iso, group_by

    return None, None, result, start_iso, end_iso, group_by
