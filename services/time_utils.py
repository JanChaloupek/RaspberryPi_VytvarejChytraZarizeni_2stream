# services/time_utils.py
from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Tuple, Optional

def _ensure_tz(tz_name: Optional[str], tz_offset_min: Optional[int]) -> ZoneInfo:
    """
    Vrátí ZoneInfo odpovídající tz_name nebo pro tz_offset fallback na UTC (využito pouze pokud tz_name chybí).
    Poznámka: mapování offset->zóna je nejednoznačné, proto preferujeme tz_name.
    """
    if tz_name:
        try:
            return ZoneInfo(tz_name)
        except Exception:
            # pokud zadané jméno neexistuje, fallback na UTC
            return ZoneInfo("UTC")
    # pokud máme offset, použijeme UTC (server bude posouvat podle offset manuálně)
    # zde nevracíme dynamickou zónu, pouze UTC a budeme posouvat pomocí offsetu
    return ZoneInfo("UTC")


def parse_local_key_to_range(level: str, local_key: str, tz_name: Optional[str], tz_offset_min: Optional[int]) -> Tuple[str, str]:
    """
    Převod lokálního klíče a tz informací na UTC interval vhodný pro DB dotaz.
    Vrací (start_iso, end_iso) jako řetězce "YYYY-MM-DD HH:MM:SS" v UTC (bez 'Z').
    Parametry:
      - level: 'monthly','daily','hourly','minutely','raw' (nebo 'year')
      - local_key: formáty: YYYY, YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH, YYYY-MM-DDTHH:MM, nebo "YYYY-MM-DD HH:MM"
      - tz_name: např. "Europe/Prague" (preferované)
      - tz_offset_min: posun v minutách east of UTC (pokud tz_name chybí)
    Výsledek:
      - start inclusive, end exclusive: [start_iso, end_iso)
    """
    if not local_key:
        raise ValueError("local_key is required")

    # normalizovat vstupní key (nahrazení mezery za 'T')
    s = local_key.strip().replace(' ', 'T')

    # detekce granularit podle délky / patternu
    # podporované granularity: year, month, day, hour, minute
    gran = None
    if s.isdigit() and len(s) == 4:
        gran = 'year'
        y = int(s)
    elif len(s) == 7 and s[4] == '-':
        gran = 'month'
        y, m = map(int, s.split('-', 1))
    elif len(s) >= 10 and s[4] == '-' and s[7] == '-':
        # day or more
        if len(s) == 10:
            gran = 'day'
            y, m, d = map(int, s.split('-', 2))
        elif len(s) == 13 and s[10] == 'T':
            gran = 'hour'
            y, m, d = map(int, s[:10].split('-', 2))
            hh = int(s[11:13])
        else:
            # possible minute or second included; take minute if possible
            if len(s) >= 16 and s[10] == 'T' and s[13] == ':':
                gran = 'minute'
                y, m, d = map(int, s[:10].split('-', 2))
                hh = int(s[11:13])
                mm = int(s[14:16])
            else:
                # fallback: if contains 'T' and hour parseable => hour
                if 'T' in s and len(s) >= 13:
                    gran = 'hour'
                    y, m, d = map(int, s[:10].split('-', 2))
                    hh = int(s[11:13])
                else:
                    raise ValueError(f"Unsupported local_key format: {local_key}")

    else:
        raise ValueError(f"Unsupported local_key format: {local_key}")

    # získat zónu; pokud máme pouze tz_offset, použijeme UTC a aplikujeme offset manuálně
    has_tz_name = bool(tz_name)
    tz = _ensure_tz(tz_name, tz_offset_min)

    def _local_dt(y, m, d, hh=0, mm=0, ss=0):
        """Vytvoří timezone-aware local datetime podle tz_name nebo (pokud chybí) podle místního offset patche."""
        if has_tz_name:
            return datetime(y, m, d, hh, mm, ss, tzinfo=tz)
        else:
            # pokud nemáme jméno zóny, použijeme UTC a aplikujeme tz_offset_min posun jako opačný posun
            # klient posílá tz_offset = minutes east of UTC, tedy local = UTC + offset
            # chceme vytvořit tz-aware datetime interpretovaný jako local: local_naive -> treat as UTC then subtract offset to get UTC
            # proto vytvoříme naive local dt and attach tzinfo=UTC then shift by -offset when converting to UTC
            return datetime(y, m, d, hh, mm, ss, tzinfo=ZoneInfo("UTC"))

    # vypočíst local_start a local_end jako tz-aware datetimes
    if gran == 'year':
        local_start = _local_dt(y, 1, 1, 0, 0, 0)
        local_end = _local_dt(y + 1, 1, 1, 0, 0, 0)
    elif gran == 'month':
        local_start = _local_dt(y, m, 1, 0, 0, 0)
        if m == 12:
            local_end = _local_dt(y + 1, 1, 1, 0, 0, 0)
        else:
            local_end = _local_dt(y, m + 1, 1, 0, 0, 0)
    elif gran == 'day':
        local_start = _local_dt(y, m, d, 0, 0, 0)
        local_end = local_start + timedelta(days=1)
    elif gran == 'hour':
        local_start = _local_dt(y, m, d, hh, 0, 0)
        local_end = local_start + timedelta(hours=1)
    elif gran == 'minute':
        local_start = _local_dt(y, m, d, hh, mm, 0)
        local_end = local_start + timedelta(minutes=1)
    else:
        raise ValueError("Unhandled granularity")

    # pokud máme pouze tz_offset (bez tz_name), převést podle offset: local = UTC + offset
    # tedy UTC = local - offset minutes
    if not has_tz_name and tz_offset_min is not None:
        offset_delta = timedelta(minutes=tz_offset_min)
        utc_start = (local_start - offset_delta).astimezone(ZoneInfo("UTC"))
        utc_end = (local_end - offset_delta).astimezone(ZoneInfo("UTC"))
    else:
        # máme plnou zónu, použij standardní astimezone
        utc_start = local_start.astimezone(ZoneInfo("UTC"))
        utc_end = local_end.astimezone(ZoneInfo("UTC"))

    # formát pro SQLite: "YYYY-MM-DD HH:MM:SS" (bez Z)
    def _fmt(dt):
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    start_iso = _fmt(utc_start)
    end_iso = _fmt(utc_end)
    return start_iso, end_iso
