# api_utils.py
"""
API utilities
-------------

Účel:
- Poskytuje pomocné funkce pro tvorbu API odpovědí a logování.
- Generuje metadata dotazů (query dict) pro různé API endpointy.
- Obsahuje funkce pro jednotné formátování odpovědí (JSON + status code).
- Umožňuje ladicí logování výsledků a chyb.

Závislosti:
- Flask (Response, jsonify) pro tvorbu HTTP odpovědí.
- logging pro logování.
- typing pro typové anotace.

Hlavní rozhraní:
- getQueryLogsTail(), getQueryDataSensors(), getQueryDataLatest(), getQueryDataAggregate(),
  getQueryDataActor(), getQueryDataSetpoint() → generují query dict pro API.
- log_data() → ladicí logování výsledků/chyb.
- make_api_response() → vytvoří JSON odpověď s výsledkem/chybou.
- make_api_response_error() → zjednodušený wrapper pro chybové odpovědi.

Výstupní formát odpovědí:
Tuple(Response, int) → Flask Response objekt a HTTP status code.
"""

from flask import Response, jsonify
from typing import Optional, Any, Tuple, Dict
import logging

logger = logging.getLogger("api")


def getQueryLogsTail() -> Dict[str, str]:
    """
    Vrátí metadata pro dotaz na logy (tail).
    """
    return {"route": "/api/logs/tail", "method": "GET"}


def getQueryDataSensors() -> Dict[str, str]:
    """
    Vrátí metadata pro dotaz na seznam senzorů.
    """
    return {"route": "/api/sensors", "method": "GET"}


def getQueryDataLatest(sensor_id: str) -> Dict[str, Any]:
    """
    Vrátí metadata pro dotaz na poslední data konkrétního senzoru.

    Parametry:
    - sensor_id: ID senzoru

    Návratová hodnota:
    - dict s route, method a sensor_id
    """
    return {"route": "/api/latest/<sensor_id>", "method": "GET", "sensor_id": sensor_id}


def getQueryDataAggregate(sensor_id: str, level: str, key: str,
                          tz_name: str, tz_offset: str,
                          tzinfo: Optional[Any] = None,
                          start_iso: Optional[str] = None,
                          end_iso: Optional[str] = None,
                          group_by: Optional[str] = None) -> Dict[str, Any]:
    """
    Vrátí metadata pro dotaz na agregovaná data.

    Parametry:
    - sensor_id: ID senzoru
    - level: úroveň agregace
    - key: časový klíč
    - tz_name: název časové zóny
    - tz_offset: offset časové zóny
    - tzinfo: objekt časové zóny (volitelný)
    - start_iso, end_iso: časové rozmezí (volitelné)
    - group_by: pattern pro agregaci (volitelný)

    Návratová hodnota:
    - dict s metadaty dotazu
    """
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

def getQueryLed(sensor_id: str, method: str = "GET") -> Dict[str, Any]:
    """
    Metadata pro dotaz na LED aktuátor.
    """
    return {
        "route": f"/api/actuator/<sensor_id>/led",
        "sensor_id": sensor_id,
        "method": method,
    }

def getQueryRelay(sensor_id: str, method: str = "GET") -> Dict[str, Any]:
    """
    Metadata pro dotaz na relé aktuátor.
    """
    return {
        "route": f"/api/actuator/<sensor_id>/relay",
        "sensor_id": sensor_id,
        "method": method,
    }

def getQueryRelaySetpoint(sensor_id: str, method: str = "GET") -> Dict[str, Any]:
    """
    Metadata pro dotaz na setpoint relé aktuátoru.
    """
    return {
        "route": f"/api/actuator/<sensor_id>/relay/setpoint",
        "sensor_id": sensor_id,
        "method": method,
    }

def getQueryLogsTail() -> Dict[str, str]:
    return {"route": "/api/logs/tail", "method": "GET"}

def log_data(key: str, num: int | bool, data: Any) -> None:
    """
    Ladicí logování dat (result/error).
    Pokud je data list, vypíše prvních num položek a vždy i poslední záznam.

    Parametry:
    - key: název logované položky
    - num: počet položek nebo True pro všechny
    - data: logovaná data
    """
    if isinstance(data, list):
        max_items = None if num is True else int(num)
        last_index = len(data) - 1
        useBreak = False
        for count, item in enumerate(data, start=1):
            suffix = ""
            # pokud jsme přes limit, přidáme "..." a ukončíme cyklus
            if max_items is not None and count >= max_items:
                suffix = "  ..."
                useBreak = True
            logger.debug(f"      {key}[]{item}{suffix}")
            if useBreak:
                break                
        # vždy zalogujeme poslední záznam, pokud není už zahrnut
        if last_index >= 0 and (max_items is None or last_index >= max_items):
            logger.debug(f"      {key}[]{data[-1]}{'  last'}")
    else:
        logger.debug(f"      {key}{data}")


def make_api_response(query: Dict[str, Any],
                      result: Optional[Any] = None,
                      error: Optional[Any] = None,
                      status: int = 200,
                      log: bool | int | str = False) -> Tuple[Response, int]:
    """
    Vytvoří jednotnou API odpověď.

    Parametry:
    - query: metadata dotazu
    - result: výsledek (volitelný)
    - error: chybová zpráva (volitelná)
    - status: HTTP status code (default 200)
    - log: zda logovat result/error (bool nebo počet položek)

    Návratová hodnota:
    - Tuple(Response, int): Flask Response objekt a status code
    """
    payload: Dict[str, Any] = {"query": query}
    if result is not None:
        payload["result"] = result
        if log:
            log_data("result", log, result)
    if error is not None:
        payload["error"] = error
        if log:
            log_data("error", log, error)
        logger.error("API error: %s", error)
    # payload["test"] = [
    #     {"info": "This is a test field to verify API responsiveness."}
    # ]
    # print(payload)
    return jsonify(payload), status


def make_api_response_error(query: Dict[str, Any],
                            error: Optional[Any],
                            status: int,
                            log: bool | int | str = True) -> Tuple[Response, int]:
    """
    Wrapper pro chybovou API odpověď.

    Parametry:
    - query: metadata dotazu
    - error: chybová zpráva
    - status: HTTP status code
    - log: zda logovat chybu (default True)

    Návratová hodnota:
    - Tuple(Response, int): Flask Response objekt a status code
    """
    return make_api_response(query, None, error, status, log)
