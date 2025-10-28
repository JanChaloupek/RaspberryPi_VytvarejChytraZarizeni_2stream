# db.py
import sqlite3
import os

class SqlSensorData:
    def __init__(self, db_path='../DU4/data_db/sensors.db'):
        self.db_path = db_path
        self.conn = None

    def __enter__(self):
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Databázový soubor '{self.db_path}' neexistuje.")
        # otevřeme připojení; timestampy v DB očekáváme jako UTC uložené ve formátu 'YYYY-MM-DD HH:MM:SS'
        # (pokud vaše DB ukládá lokální čas, je potřeba tomu přizpůsobit parse_local_key_to_range)
        self.conn = sqlite3.connect(self.db_path, detect_types=sqlite3.PARSE_DECLTYPES | sqlite3.PARSE_COLNAMES)
        self.conn.row_factory = sqlite3.Row
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if self.conn:
            self.conn.close()

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

    # Generická agregace nad časovým intervalem; group_by je strftime formát (např. '%Y-%m-%d' nebo '%Y-%m')
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

    # Vrátí jednotlivá měření v intervalu [start_iso, end_iso)
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
