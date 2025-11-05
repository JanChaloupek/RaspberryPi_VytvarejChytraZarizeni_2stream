# db.py
import sqlite3
import os
from typing import Optional, Dict, Iterator, Tuple, Any

class SqlSensorData:
    """
    Db helper s interně uloženou výchozí db_path.
    Použití:
        db = SqlSensorData()
        db.open()
        ... používat db ...
        db.close()
    Nebo jako context manager:
        with SqlSensorData() as db:
            ...
    """
    def __init__(self, db_path: str = '../data_db/sensors.db'):
        self._db_path = db_path
        self.conn: Optional[sqlite3.Connection] = None

    # explicitní otevření/zavření
    def open(self):
        if self.conn:
            return
        if not os.path.exists(self._db_path):
            raise FileNotFoundError(f"Databázový soubor '{self._db_path}' neexistuje.")
        self.conn = sqlite3.connect(self._db_path, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
        self.conn.row_factory = sqlite3.Row

    def close(self):
        if self.conn:
            try:
                self.conn.close()
            finally:
                self.conn = None

    # context manager kompatibilita
    def __enter__(self):
        self.open()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

    # -------------------------
    # Sensor metody
    # -------------------------
    def get_sensor_ids(self) -> list:
        cursor = self.conn.cursor()
        cursor.execute("SELECT sensor_id FROM current_sensor_data ORDER BY sensor_id")
        return [row['sensor_id'] for row in cursor.fetchall()]

    def get_current(self, sensor_id: str):
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT timestamp, sensor_id, temperature, humidity
            FROM current_sensor_data
            WHERE sensor_id = ?
        """, (sensor_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_aggregated(self, sensor_id: str, start_iso: str, end_iso: str, group_by: str):
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

    def get_measurements_range(self, sensor_id: str, start_iso: str, end_iso: str):
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
    # Params metody
    # -------------------------
    def nv_set(self, key: str, value: str):
        if not self.conn:
            raise RuntimeError("DB connection is not open")
        cur = self.conn.cursor()
        cur.execute('''
            INSERT INTO nonvolatile_params(key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
        ''', (key, value))
        self.conn.commit()

    def nv_get(self, key: str) -> Optional[str]:
        if not self.conn:
            raise RuntimeError("DB connection is not open")
        cur = self.conn.cursor()
        cur.execute('SELECT value FROM nonvolatile_params WHERE key = ?', (key,))
        row = cur.fetchone()
        return row[0] if row else None

    def nv_iter_prefixed(self, prefix: str) -> Iterator[Tuple[str, str]]:
        if not self.conn:
            raise RuntimeError("DB connection is not open")
        cur = self.conn.cursor()
        cur.execute('SELECT key, value FROM nonvolatile_params WHERE key LIKE ?', (f'{prefix}%',))
        for k, v in cur.fetchall():
            yield k, v

    # Helpers pro actuatory
    def load_actuator_params(self, prefix: str = 'actuator-') -> Dict[str, Dict[str, Any]]:
        out: Dict[str, Dict[str, Any]] = {}
        for key, raw in self.nv_iter_prefixed(prefix):
            suffix = key[len(prefix):]
            try:
                name, param = suffix.split("-", 1)
            except Exception:
                continue
            val = raw
            if val in ("True", "False"):
                parsed = True if val == "True" else False
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

    def save_actuator_param(self, name: str, param: str, value: Any, prefix: str = 'actuator-'):
        key = f"{prefix}{name}-{param}"
        self.nv_set(key, str(value))

    def save_actuator_params_bulk(self, params: Dict[str, Dict[str, Any]], prefix: str = 'actuator-'):
        for name, kv in params.items():
            for p, v in kv.items():
                try:
                    param_name = f"{prefix}{name}-{p}"
                    value = str(v)
                    self.nv_set(param_name, value)
                except Exception as ex:
                    print(ex)
