# services/time_utils.py
"""
Time utilities
--------------

Účel:
- Poskytuje pomocné funkce pro práci s časovými zónami a ISO formáty.
- Umožňuje převod mezi lokálním časem a UTC.
- Podporuje dekódování klíčů (např. "2025-11-01") na časové intervaly pro agregace.

Závislosti:
- datetime, timedelta, timezone (standardní knihovna)
- zoneinfo.ZoneInfo pro práci s názvy časových zón
- re pro regulární výrazy
- logging pro ladicí logování

Hlavní rozhraní:
- resolve_tz() → vrací timezone objekt podle názvu nebo offsetu
- parse_local_iso() → převede ISO string na datetime s daným tzinfo
- to_utc() → převede lokální datetime na UTC
- to_local_iso_from_utc() → převede UTC datetime na lokální ISO string
- parse_local_key_to_range() → vrací časový interval a group_by pattern pro agregace

Výstupní formáty:
- ISO stringy: "%Y-%m-%dT%H:%M:%S"
- SQLite WHERE podmínky: "%Y-%m-%d %H:%M:%S"
"""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger("time_utils")

ISO_FORMAT = "%Y-%m-%dT%H:%M:%S"


def resolve_tz(tz_name: Optional[str], tz_offset: Optional[str]) -> timezone:
    """
    Vrátí timezone objekt podle názvu nebo offsetu.

    Parametry:
    - tz_name: název časové zóny (např. "Europe/Prague") nebo None
    - tz_offset: offset v minutách (string), např. "60" nebo "-120"

    Návratová hodnota:
    - timezone objekt (ZoneInfo nebo timezone.utc)
    """
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except Exception as ex:
            logger.warning("Invalid tz_name %s: %s", tz_name, ex)
    if tz_offset is not None:
        try:
            minutes = int(tz_offset)
            return timezone(timedelta(minutes=minutes))
        except Exception as ex:
            logger.warning("Invalid tz_offset %s: %s", tz_offset, ex)
    return timezone.utc


def _is_tz_aware_str(txt: str) -> bool:
    """
    Detekuje, zda ISO string obsahuje informaci o časové zóně (Z nebo ±HH[:MM]).
    """
    return bool(re.search(r'(Z|[+\-]\d{2}(:\d{2})?)$', txt))


def parse_local_iso(local_iso: str, tzinfo: timezone) -> datetime:
    """
    Převede ISO string (lokální nebo tz-aware) na datetime s daným tzinfo.

    Parametry:
    - local_iso: ISO string (např. "2025-11-01T12:00:00")
    - tzinfo: cílová časová zóna

    Návratová hodnota:
    - datetime objekt s nastaveným tzinfo
    """
    txt = str(local_iso).replace(" ", "T")

    # 1) tz-aware input (Z or ±HH[:MM])
    if _is_tz_aware_str(txt):
        try:
            normalized = txt[:-1] + "+00:00" if txt.endswith("Z") else txt
            aware = datetime.fromisoformat(normalized)
            if aware.tzinfo is None:
                aware = aware.replace(tzinfo=timezone.utc)
            return aware.astimezone(tzinfo)
        except Exception as ex:
            logger.debug("Failed tz-aware parse for %s: %s", txt, ex)

    # 2) precise local forms
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d"):
        try:
            naive = datetime.strptime(txt, fmt)
            return naive.replace(tzinfo=tzinfo)
        except ValueError:
            continue

    # 3) year-month
    try:
        naive = datetime.strptime(txt, "%Y-%m")
        return naive.replace(day=1, hour=0, minute=0, second=0, microsecond=0, tzinfo=tzinfo)
    except ValueError:
        pass

    # 4) year only
    try:
        naive = datetime.strptime(txt, "%Y")
        return naive.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0, tzinfo=tzinfo)
    except ValueError as e:
        raise ValueError(f"Unsupported key datetime format: {local_iso}") from e


def to_utc(dt_local: datetime) -> datetime:
    """
    Převede lokální datetime na UTC.
    """
    return dt_local.astimezone(timezone.utc)


def to_local_iso_from_utc(utc_dt: datetime, tzinfo: timezone) -> str:
    """
    Převede UTC datetime na lokální ISO string.

    Parametry:
    - utc_dt: datetime v UTC
    - tzinfo: cílová časová zóna

    Návratová hodnota:
    - ISO string "%Y-%m-%dT%H:%M:%S"
    """
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=timezone.utc)
    local_dt = utc_dt.astimezone(tzinfo)
    return local_dt.strftime(ISO_FORMAT)


def parse_local_key_to_range(level: str, key: str, tzinfo: timezone) -> Tuple[str, str, Optional[str]]:
    """
    Vrátí (start_utc_iso, end_utc_iso, group_by_str).
    Start a end jsou ve formátu 'YYYY-%m-%d %H:%M:%S' v UTC (pro SQLite WHERE).
    group_by_str je SQLite strftime pattern nebo None pro raw.

    Parametry:
    - level: úroveň agregace ("monthly", "daily", "hourly", "minutely", "raw")
    - key: časový klíč (ISO string)
    - tzinfo: časová zóna

    Návratová hodnota:
    - tuple (start_iso: str, end_iso: str, group_by: Optional[str])
    """
    logger.debug("parse_local_key_to_range input: level=%s key=%s tzinfo=%s", level, key, tzinfo)
    local_dt = parse_local_iso(key, tzinfo)

    if level == "monthly":
        now = datetime.now(tzinfo)
        year = local_dt.year
        start_local = datetime(year=year, month=1, day=1, tzinfo=tzinfo)
        if now.month in (1, 2, 3):
            start_local = start_local.replace(year=year - 1)
        end_local = start_local.replace(year=start_local.year + 1)
        group_by = "%Y-%m"

    elif level == "daily":
        start_local = local_dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end_local = start_local.replace(year=start_local.year + 1, month=1) if start_local.month == 12 \
            else start_local.replace(month=start_local.month + 1)
        group_by = "%Y-%m-%d"

    elif level == "hourly":
        start_local = local_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        end_local = start_local + timedelta(days=1)
        group_by = "%Y-%m-%d %H"

    elif level == "minutely":
        start_local = local_dt.replace(minute=0, second=0, microsecond=0)
        end_local = start_local + timedelta(hours=1)
        group_by = "%Y-%m-%d %H:%M"

    elif level == "raw":
        start_local = local_dt.replace(second=0, microsecond=0)
        end_local = start_local + timedelta(minutes=1)
        group_by = None

    else:
        raise ValueError(f"Unsupported level: {level}")

    start_iso = to_utc(start_local).strftime("%Y-%m-%d %H:%M:%S")
    end_iso = to_utc(end_local).strftime("%Y-%m-%d %H:%M:%S")
    logger.debug("parse_local_key_to_range output: level=%s start=%s end=%s", level, start_iso, end_iso)
    return start_iso, end_iso, group_by
