# db.py
"""
SQLite database helper for sensor data
--------------------------------------

Účel:
- Poskytuje třídu SqlSensorData pro pohodlnou práci s SQLite databází senzorů.
- Umožňuje získat aktuální a historická měření, agregovat hodnoty a spravovat
  trvalé parametry v tabulce `nonvolatile_params`.
- Odděluje aplikační logiku od detailů připojení k databázi.

Klíčové vlastnosti:
- Interní výchozí `db_path` s možností přepsání v konstruktoru.
- Bezpečné otevření/zavření spojení (explicitně i přes context manager).
- `row_factory = sqlite3.Row` pro čitelné výsledky (dict-like).
- Metody pro:
  - seznam dostupných senzorů (`get_sensor_ids`)
  - aktuální hodnoty (`get_current`)
  - agregace (`get_aggregated`) podle `strftime` patternu (např. "%Y-%m-%d", "%Y-%m-%d %H")
  - časové rozmezí měření (`get_measurements_range`)
  - trvalé parametry (NV) – set/get/iterate s prefixem
  - aktuátor parametry – načtení, uložení jednotlivě i hromadně

Kdy použít:
- V API endpointu nebo servisní vrstvě pro čtení dat grafů/tabulek.
- Při ukládání konfigurací, které mají přežít restart (nonvolatile_params).

Schéma očekávaných tabulek (tabulky zakládá měřící skript):
- current_sensor_data(sensor_id TEXT, timestamp TEXT, temperature REAL, humidity REAL)
- sensor_data(id INT, sensor_id TEXT, timestamp TEXT, temperature REAL, humidity REAL)
- nonvolatile_params(key TEXT PRIMARY KEY, value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)

Příklady použití:
    from db import SqlSensorData

    # Context manager
    with SqlSensorData('../data_db/sensors.db') as db:
        sensors = db.get_sensor_ids()
        current = db.get_current(sensors[0])

    # Explicitní open/close
    db = SqlSensorData()
    db.open()
    try:
        rows = db.get_measurements_range('DHT11_01', '2025-11-01T00:00:00', '2025-11-02T00:00:00')
    finally:
        db.close()

Poznámky:
- Parametr `group_by` v `get_aggregated` je přímo vložen do `strftime()`. Používej pouze bezpečné,
  předem definované patterny (např. "%Y-%m-%d", "%Y-%m-%d %H") – nesmí pocházet od uživatele.
"""

import sqlite3
import os
from typing import Optional, Dict, Iterator, Tuple, Any, List

class SqlSensorData:
    """
    Db helper s interně uloženou výchozí db_path.

    Použití (explicitní):
        db = SqlSensorData()
        db.open()
        ... používat db ...
        db.close()

    Použití (context manager):
        with SqlSensorData() as db:
            ...

    Parametry:
    - db_path: cesta k SQLite souboru; výchozí '../data_db/sensors.db'

    Vlastnosti:
    - conn: sqlite3.Connection | None – aktivní spojení (po open())
    """
    def __init__(self, db_path: str = '../data_db/sensors.db') -> None:
        self._db_path: str = db_path
        self.conn: Optional[sqlite3.Connection] = None

    # -------------------------------------------------
    # explicitní otevření/zavření
    # -------------------------------------------------
    def open(self) -> None:
        """
        Otevře spojení k SQLite DB, nastaví row_factory pro dict-like přístup.
        Zvedne FileNotFoundError, pokud soubor neexistuje.
        Idempotentní: pokud je spojení již otevřené, neprovede nic.
        """
        if self.conn:
            return
        if not os.path.exists(self._db_path):
            raise FileNotFoundError(f"Databázový soubor '{self._db_path}' neexistuje.")
        self.conn = sqlite3.connect(
            self._db_path,
            detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES
        )
        self.conn.row_factory = sqlite3.Row

    def close(self) -> None:
        """
        Bezpečně zavře spojení, pokud existuje.
        Po zavření nastaví conn na None.
        """
        if self.conn:
            try:
                self.conn.close()
            finally:
                self.conn = None

    # -------------------------------------------------
    # context manager kompatibilita
    # -------------------------------------------------
    def __enter__(self) -> "SqlSensorData":
        """
        Umožní použití `with SqlSensorData(...) as db:`.
        Při vstupu otevře spojení a vrátí instanci.
        """
        self.open()
        return self

    def __exit__(self, exc_type: Optional[type], exc_value: Optional[BaseException], traceback: Optional[Any]) -> None:
        """
        Při opuštění kontextu zavře spojení.
        """
        self.close()

    # -------------------------
    # Sensor metody
    # -------------------------
    def get_sensor_ids(self) -> List[str]:
        """
        Vrátí seznam dostupných sensor_id z tabulky current_sensor_data.
        Výstup: list[str]
        """
        cursor = self.conn.cursor()
        cursor.execute("SELECT sensor_id FROM current_sensor_data ORDER BY sensor_id")
        return [row['sensor_id'] for row in cursor.fetchall()]

    def get_current(self, sensor_id: str) -> Optional[Dict[str, Any]]:
        """
        Vrátí aktuální měření pro konkrétní sensor_id z current_sensor_data.
        Výstup: dict(row) nebo None, pokud záznam neexistuje.
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT timestamp, sensor_id, temperature, humidity
            FROM current_sensor_data
            WHERE sensor_id = ?
        """, (sensor_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_aggregated(self, sensor_id: str, start_iso: str, end_iso: str, group_by: str) -> List[Dict[str, Any]]:
        """
        Vrátí agregovaná data ze sensor_data pro daný senzor a časový interval.
        Agreguje pomocí AVG(temperature), AVG(humidity) a COUNT(*).
        Skupiny jsou definovány `strftime(group_by, timestamp)`.

        Parametry:
        - sensor_id: ID senzoru
        - start_iso, end_iso: ISO časové řetězce (inclusive start, exclusive end)
        - group_by: strftime pattern (např. "%Y-%m-%d %H")

        Výstup: list[dict] se strukturou { key, avg_temp, avg_hum, count }
        Pozn.: ORDER BY key DESC vrací nejnovější skupiny jako první.
        """
        cursor = self.conn.cursor()
        sql = f"""
            SELECT
                strftime('{group_by}', timestamp) AS key,
                AVG(temperature) AS avg_temp,
                AVG(humidity) AS avg_hum,
                COUNT(*) AS count
            FROM sensor_data
            WHERE sensor_id = ?
              AND timestamp >= ?
              AND timestamp < ?
            GROUP BY key
            ORDER BY key DESC
        """
        cursor.execute(sql, (sensor_id, start_iso, end_iso))
        return [dict(r) for r in cursor.fetchall()]

    def get_measurements_range(self, sensor_id: str, start_iso: str, end_iso: str) -> List[Dict[str, Any]]:
        """
        Vrátí surová měření z tabulky sensor_data pro daný senzor v intervalu.
        Výstup je seřazen DESC podle timestamp (nejnovější první).

        Výstup: list[dict] se strukturou { timestamp, temperature, humidity }
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT
                timestamp,
                temperature,
                humidity
            FROM sensor_data
            WHERE sensor_id = ?
              AND timestamp >= ?
              AND timestamp < ?
            ORDER BY timestamp DESC
        """, (sensor_id, start_iso, end_iso))
        return [dict(r) for r in cursor.fetchall()]

    # -------------------------
    # Params (nonvolatile) metody
    # -------------------------
    def nv_set(self, key: str, value: str) -> None:
        """
        Uloží klíč–hodnotu do tabulky nonvolatile_params.
        Pokud klíč existuje, provede UPDATE a nastaví updated_at na CURRENT_TIMESTAMP.
        """
        if not self.conn:
            raise RuntimeError("DB connection is not open")
        cur = self.conn.cursor()
        cur.execute('''
            INSERT INTO nonvolatile_params(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
        ''', (key, value))
        self.conn.commit()

    def nv_get(self, key: str) -> Optional[str]:
        """
        Načte hodnotu pro daný klíč z nonvolatile_params.
        Vrací hodnotu (str) nebo None, pokud neexistuje.
        """
        if not self.conn:
            raise RuntimeError("DB connection is not open")
        cur = self.conn.cursor()
        cur.execute('SELECT value FROM nonvolatile_params WHERE key = ?', (key,))
        row = cur.fetchone()
        return row[0] if row else None

    def nv_iter_prefixed(self, prefix: str) -> Iterator[Tuple[str, str]]:
        """
        Iteruje přes klíče v nonvolatile_params začínající na prefix.
        Vrací páry (key, value) jako iterator.
        """
        if not self.conn:
            raise RuntimeError("DB connection is not open")
        cur = self.conn.cursor()
        cur.execute('SELECT key, value FROM nonvolatile_params WHERE key LIKE ?', (f'{prefix}%',))
        for k, v in cur.fetchall():
            yield k, v

    # -------------------------
    # Helpers pro actuatory
    # -------------------------
    def load_actuator_params(self, prefix: str = 'actuator-') -> Dict[str, Dict[str, Any]]:
        """
        Načte všechny parametry aktuátorů z nonvolatile_params s daným prefixem.
        Očekávaný formát klíče: f"{prefix}{name}-{param}"
        Provádí základní převody typů (True/False → bool, čísla → int/float, jinak str).

        Výstup: dict[name] -> dict[param] = parsed_value
        """
        out: Dict[str, Dict[str, Any]] = {}
        for key, raw in self.nv_iter_prefixed(prefix):
            suffix = key[len(prefix):]
            try:
                name, param = suffix.split("-", 1)
            except Exception:
                # Ignoruj klíče bez očekávaného formátu
                continue

            val = raw
            if val in ("True", "False"):
                parsed = (val == "True")
            else:
                try:
                    if "." in val:
                        parsed = float(val)
                    else:
                        parsed = int(val)
                except Exception:
                    parsed = val

            out.setdefault(name, {})[param] = parsed
        return out

    def save_actuator_param(self, name: str, param: str, value: Any, prefix: str = 'actuator-') -> None:
        """
        Uloží jeden parametr aktuátoru pod klíč f"{prefix}{name}-{param}" jako str.
        """
        key = f"{prefix}{name}-{param}"
        self.nv_set(key, str(value))

    def save_actuator_params_bulk(self, params: Dict[str, Dict[str, Any]], prefix: str = 'actuator-') -> None:
        """
        Hromadně uloží více parametrů aktuátorů.
        Očekávaný vstup: { name: { param: value, ... }, ... }
        Každou hodnotu ukládá jako str; případné výjimky loguje přes print (zvaž přechod na logger).
        """
        for name, kv in params.items():
            for p, v in kv.items():
                try:
                    param_name = f"{prefix}{name}-{p}"
                    value = str(v)
                    self.nv_set(param_name, value)
                except Exception as ex:
                    # Pro produkci zvaž nahradit print za logger.warning/error
                    print(ex)
