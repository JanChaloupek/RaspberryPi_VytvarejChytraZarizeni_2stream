from datetime import datetime, timedelta
import sqlite3
import os

class SqlSensorData:
    def __init__(self, db_path='../DU4/data_db/sensors.db'):
        self.db_path = db_path
        self.conn = None

    def __enter__(self):
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Databázový soubor '{self.db_path}' neexistuje.")

        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row

        if not self._table_exists('sensor_data'):
            raise RuntimeError("Tabulka 'sensor_data' neexistuje v databázi.")

        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if self.conn:
            self.conn.close()

    def _table_exists(self, table_name):
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master
            WHERE type='table' AND name=?
        """, (table_name,))
        return cursor.fetchone() is not None

    def get_sensor_ids(self) -> list[str]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT sensor_id FROM current_sensor_data ORDER BY sensor_id")
        return [row['sensor_id'] for row in cursor.fetchall()]


    def get_current(self, sensor_id: str) -> dict | None:
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT timestamp, sensor_id, temperature, humidity
            FROM current_sensor_data
            WHERE sensor_id = ?
        """, (sensor_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


    def get_hourly_aggregated(self, sensor_id: str) -> list[dict]:
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT 
                strftime('%Y-%m-%d %H:00:00', timestamp) AS hour,
                AVG(temperature) AS avg_temp,
                AVG(humidity) AS avg_hum,
                COUNT(*) AS count
            FROM sensor_data
            WHERE sensor_id = ?
            AND timestamp >= datetime('now', '-24 hours')
            GROUP BY hour
            ORDER BY hour DESC
        """, (sensor_id,))
        return cursor.fetchall()

