# ============================================================
# Modul: params.py
# ------------------------------------------------------------
# Účel:
# - Poskytuje jednotné rozhraní pro správu parametrů aktuátorů.
# - Parametry jsou uchovávány v paměti (cache) a volitelně
#   perzistovány do databáze pomocí SqlSensorData.
# - Modul zajišťuje načítání parametrů s fallbackem na defaultní hodnoty.
# ============================================================

from typing import Dict, Any, Optional
import logging
from db import SqlSensorData

NV_PREFIX: str = "actuator-"


class ParamRepository:
    """
    Správa parametrů aktuátorů (paměť + DB).

    Účel:
    - Uchovávat aktuální hodnoty parametrů aktuátorů v paměti.
    - Poskytovat metody pro nastavení a načtení parametrů.
    - Volitelně perzistovat hodnoty do databáze (NV storage).
    - Při načítání parametrů provést fallback na defaultní hodnotu,
      pokud parametr není dostupný.

    Atributy:
    ----------
    _params : Dict[str, Dict[str, Any]]
        Interní cache parametrů, strukturovaná jako {název_aktuátoru: {param: hodnota}}.
    """

    def __init__(self) -> None:
        """
        Inicializuje repository s prázdnou paměťovou cache.
        """
        self._params: Dict[str, Dict[str, Any]] = {}

    def set_param(self, name: str, param: str, value: Any, persist: bool = True) -> None:
        """
        Nastaví hodnotu parametru pro daný aktuátor.

        Parametry:
        ----------
        name : str
            Název aktuátoru (např. "relay_01").
        param : str
            Název parametru (např. "mode").
        value : Any
            Hodnota parametru (libovolný typ).
        persist : bool, default=True
            Pokud True, hodnota se uloží i do databáze.

        Návratová hodnota:
        ------------------
        None
        """
        if name not in self._params:
            self._params[name] = {}
        self._params[name][param] = value

        if persist:
            try:
                with SqlSensorData() as db:
                    db.save_actuator_param(name, param, value, prefix=NV_PREFIX)
            except Exception as ex:
                logger = logging.getLogger("actuators")
                logger.exception("Failed to save param %s/%s: %s", name, param, ex)

    def get_param(self, name: str, param: str, default: Optional[Any] = None) -> Any:
        """
        Načte hodnotu parametru pro daný aktuátor.

        Parametry:
        ----------
        name : str
            Název aktuátoru (např. "relay_01").
        param : str
            Název parametru (např. "mode").
        default : Any, optional
            Defaultní hodnota, která se vrátí pokud parametr není nalezen.

        Návratová hodnota:
        ------------------
        Any
            Hodnota parametru, nebo default pokud není dostupná.
        """
        if name in self._params and param in self._params[name]:
            return self._params[name][param]

        try:
            with SqlSensorData() as db:
                v = db.nv_get(f"{NV_PREFIX}{name}-{param}")
            return v if v is not None else default
        except Exception as ex:
            logger = logging.getLogger("actuators")
            logger.exception("Failed to read param %s/%s: %s", name, param, ex)
            return default
