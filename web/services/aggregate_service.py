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
from services.time_utils import parse_local_key_to_range, to_utc, parse_local_iso, shorten_key_by_level
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


def _normalize_row(column_key, column_temp, column_hum, column_count, row: Dict[str, Any], tzinfo=timezone.utc) -> Dict[str, Any]:
    """
    Normalizuje řádek z get_aggregated nebo jednotlivá měření:
    - převede zkrácený key na plné ISO UTC
    - zaokrouhlí průměry na 2 desetinná místa
    - doplní rosný bod

    Parametry:
    - column_key: název sloupce pro klíč (např. "key")
    - column_temp: název sloupce pro teplotu (např. "avg_temp" nebo "temperature")
    - column_hum: název sloupce pro vlhkost (např. "avg_hum" nebo "humidity")
    - column_count: název sloupce pro počet (např. "count")
    - row: dict s daty
    - tzinfo: časová zóna (default UTC)

    Návratová hodnota:
    - dict { key, temperature, humidity, dew_point, count }
    """
    raw_key = row.get(column_key)
    if raw_key:
        # parse_local_iso zvládne i zkrácené formáty (YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH)
        local_dt = parse_local_iso(raw_key, tzinfo)
        key = local_dt.isoformat(timespec="seconds")  # "2025-11-14T22:00:00+00:00"
    else:
        key = None

    temp = _round2(row.get(column_temp))
    hum = _round2(row.get(column_hum))
    dew = _round2(compute_dew_point(temp, hum))
    if column_count is None:
        count = 1
    else:
        count = int(row.get(column_count) or 0)
    return {
        "key": key,
        "temperature": temp,
        "humidity": hum,
        "dew_point": dew,
        "count": count,
    }
def _normalize_aggregated_row(row: Dict[str, Any], tzinfo=timezone.utc) -> Dict[str, Any]:
    return _normalize_row("key", "avg_temp", "avg_hum", "count", row, tzinfo)

def _normalize_measurement_row(row: Dict[str, Any], tzinfo=timezone.utc) -> Dict[str, Any]:
    return _normalize_row("timestamp", "temperature", "humidity", None, row, tzinfo)

def handle_aggregate(sensor_id: str, level: str, key: str, start_iso: str, end_iso: str, group_by: Optional[str], tzinfo) -> List[Dict[str, Any]]:
    """
    Hlavní rozhraní: vrací list dict s poli key, temperature, humidity, dew_point, count.

    Parametry:
    - sensor_id: ID senzoru
    - level: úroveň agregace ("raw", "hourly", "daily", "monthly", "minutely")
    - key: časový klíč (ISO string)
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

        if level == "daily":
            # ponecháme jen řádky, kde row["key"] začíná na krátký klíč
            short_key = shorten_key_by_level(level, key)
            rows = [row for row in rows if row["key"].startswith(short_key)]            
        
        result = [_normalize_aggregated_row(row, tzinfo ) for row in rows]
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
        result = handle_aggregate(sensor_id, level, key, start_iso, end_iso, group_by, tzinfo)
    except Exception as e:
        return 500, str(e), None, start_iso, end_iso, group_by

    return None, None, result, start_iso, end_iso, group_by
