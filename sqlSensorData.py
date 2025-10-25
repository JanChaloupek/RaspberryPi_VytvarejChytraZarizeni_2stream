import sqlite3
from typing import Any, Optional

class SqlSensorData:
    """
    Třída pro práci s SQLite databází pro ukládání senzorových dat (teplota, vlhkost)
    
    Args:
        db_name: Název SQLite databázového souboru
    """
    def __init__(self, db_name: str):
        self.conn = sqlite3.connect(db_name)
        self.__create_tables()

    def __del__(self):
        self.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def __create_tables(self) -> None:
        cursor = self.conn.cursor()

        # Historická data
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sensor_data (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                sensor_id TEXT NOT NULL,
                temperature REAL NOT NULL,
                humidity REAL
            )
        ''')

        # Aktuální data (jeden řádek na senzor)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS current_sensor_data (
                sensor_id TEXT PRIMARY KEY,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
                temperature REAL NOT NULL,
                humidity REAL
            )
        ''')

        self.conn.commit()

    """
    Uzavření připojení k databázi
    
    Args: 
        None
    Returns: 
        None
    """
    def close(self) -> None:
        self.conn.close()

    """
    Vložení dat z jednoho senzoru do historické tabulky a aktualizace aktuálního záznamu
    
    Args:
        sensor_id: ID senzoru
        temperature: Teplota
        humidity: Vlhkost
    Returns:
        None
    """
    def insert_data(self, sensor_id: str, temperature: float, humidity: Optional[float] = None) -> None:
        cursor = self.conn.cursor()

        # Vložení do historické tabulky
        cursor.execute('''
            INSERT INTO sensor_data (sensor_id, temperature, humidity)
            VALUES (?, ?, ?)
        ''', (sensor_id, temperature, humidity))

        # Pokus o aktualizaci aktuálního záznamu
        cursor.execute('''
            UPDATE current_sensor_data
            SET timestamp = CURRENT_TIMESTAMP,
                temperature = ?,
                humidity = ?
            WHERE sensor_id = ?
        ''', (temperature, humidity, sensor_id))

        # Pokud nebyl žádný řádek aktualizován, vlož nový
        if cursor.rowcount == 0:
            cursor.execute('''
                INSERT INTO current_sensor_data (sensor_id, temperature, humidity)
                VALUES (?, ?, ?)
            ''', (sensor_id, temperature, humidity))

        self.conn.commit()

    """
    Provedeni SELECT dotazu

    Args:
        columns: Sloupce pro výběr (výchozí '*')
        where_clause: Podmínka WHERE (výchozí '')
        group_by: Podmínka GROUP BY (výchozí '')
        having: Podmínka HAVING (výchozí '')
        order_by: Podmínka ORDER BY (výchozí '')
    Returns: 
        Objekt kurzoru s výsledky dotazu
    """
    def __execute_select(self, columns: str = '*', where_clause: str = '', group_by: str = '', having: str = '', order_by: str = '') -> sqlite3.Cursor:
        query = f'SELECT {columns} FROM sensor_data'
        if where_clause:
            query += f' WHERE {where_clause}'
        if group_by:
            query += f' GROUP BY {group_by}'
        if having:
            query += f' HAVING {having}'
        if order_by:
            query += f' ORDER BY {order_by}'
        cursor = self.conn.cursor()
        cursor.execute(query)
        return cursor


    """
    Provedení SELECT dotazu a vrácení jednoho řádku výsledku

    Args:
        columns: Sloupce pro výběr (výchozí '*')
        where_clause: Podmínka WHERE (výchozí '')
        group_by: Podmínka GROUP BY (výchozí '')
        having: Podmínka HAVING (výchozí '')
        order_by: Podmínka ORDER BY (výchozí '')
    Returns: 
        Jeden řádek výsledku
    """
    def execute_select_get_one(self, columns: str = '*', where_clause: str = '', group_by: str = '', having: str = '', order_by: str = '') -> Optional[tuple[Any, ...]]:
        cursor = self.__execute_select(columns, where_clause, group_by, having, order_by)
        return cursor.fetchone()

    """
    Provedení SELECT dotazu a vrácení první hodnoty prvního řádku výsledku

    Args:
        columns: Sloupce pro výběr (výchozí '*')
        where_clause: Podmínka WHERE (výchozí '')
        group_by: Podmínka GROUP BY (výchozí '')
        having: Podmínka HAVING (výchozí '')
        order_by: Podmínka ORDER BY (výchozí '')
        default: Výchozí hodnota, pokud není žádný výsledek (výchozí None)
    Returns: 
        První hodnota prvního řádku výsledku nebo default
    """
    def execute_select_get_one_return_first_column(self, columns: str = '*', where_clause: str = '', group_by: str = '', having: str = '', order_by: str = '', default: Optional[Any] = None) -> Optional[Any]:
        result = self.execute_select_get_one(columns, where_clause, group_by, having, order_by)
        return result[0] if result else default


    """
    Provedení SELECT dotazu a vrácení všech řádků výsledku

    Args:
        columns: Sloupce pro výběr (výchozí '*')
        where_clause: Podmínka WHERE (výchozí '')
        group_by: Podmínka GROUP BY (výchozí '')
        having: Podmínka HAVING (výchozí '')
        order_by: Podmínka ORDER BY (výchozí '')    
    Returns: 
        Všechny řádky výsledku
    """
    def execute_select_get_all(self, columns: str = '*', where_clause: str = '', group_by: str = '', having: str = '', order_by: str = '') -> list[tuple[Any, ...]]:
        cursor = self.__execute_select(columns, where_clause, group_by, having, order_by)
        return cursor.fetchall()


    """
    Vrátí názvy sloupců výsledku SELECT dotazu

    Args:
        columns: Sloupce pro výběr (výchozí '*')
    Returns: 
        Seznam názvů sloupců
    """
    def get_column_names(self, columns: str = '*') -> list[str]:
        cursor = self.__execute_select(columns)
        return [description[0] for description in cursor.description]


    """
    Vrátí průměrnou teplotu

    Args:
        where_clause: Podmínka WHERE (výchozí '')
    Returns: 
        Průměrná teplota nebo None
    """
    def get_average_temperature(self, where_clause: str = '') -> float | None:
        return self.execute_select_get_one_return_first_column("AVG(temperature)", where_clause=where_clause)


    """
    Vrátí minimální teplotu

    Args:
        where_clause: Podmínka WHERE (výchozí '')
    Returns: 
        Minimální teplota nebo None
    """
    def get_min_temperature(self, where_clause: str = '') -> float | None:
        return self.execute_select_get_one_return_first_column("MIN(temperature)", where_clause=where_clause)


    """
    Vrátí maximální teplotu

    Args:
        where_clause: Podmínka WHERE (výchozí '')
    Returns: 
        Maximální teplota nebo None
    """
    def get_max_temperature(self, where_clause: str = '') -> float | None:
        return self.execute_select_get_one_return_first_column("MAX(temperature)", where_clause=where_clause)


    """
    Vrátí počet záznamů
    
    Args:
        where_clause: Podmínka WHERE (výchozí '')
    Returns:
        Počet záznamů nebo None
    """
    def count(self, where_clause: str = '') -> int | None:
        return self.execute_select_get_one_return_first_column("COUNT(*)", where_clause=where_clause)

