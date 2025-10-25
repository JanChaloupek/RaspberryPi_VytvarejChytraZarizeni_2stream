import csv
import time
import board
import signal
from keypad import Keypad
from typing import Any, Optional
from gpiozero import LED
from adafruit_dht import DHT11
from sqlSensorData import SqlSensorData

# Identifikátory senzorů
SENSOR_IDS = ["DHT11_01", "DHT11_02"]

# Inicializace zařízení
heartbeat_led = LED(27)                             # LED na GPIO pin 27
dhtDevice1 = DHT11(board.D17)                        # DHT11 na GPIO pin 17
dhtDevice2 = DHT11(board.D22)                        # DHT11 na GPIO pin 22
keypad = Keypad([16, 20, 21])                       # Klávesnice z GPIO pinů 16 (key0), 20 (key1), 21 (key2)
sql = SqlSensorData("data_db/sensors.db")           # SQLite databáze sensors.db s tabulkou sensor_data

# Globální proměnná pro řízení běhu smyčky (ukončení skriptu stiskem klávesy 2 nebo signálem interrupt)
running = True


"""
Provedeni exportu do CSV

Args:
    fileName: Název CSV souboru
    rows: Data řádků pro export
    headerColumnNames: Sloupce záhlaví (volitelné) - pokud není zadáno, záhlaví nebude zahrnuto
Returns:
    None
"""
def exportCsv(fileName: str, rows: list[list[Any]], headerColumnNames: Optional[list[str]] = None) -> None:
    with open(file=fileName, mode='w', newline='') as file:
        writer = csv.writer(file, strict=True)
        if headerColumnNames is not None:
            writer.writerow(headerColumnNames)      # záhlaví
        writer.writerows(rows)                      # data
    print(f"Data is successfully exported to {fileName}")


"""
Funkce implementující co se má stát po stisknutí tlačítek klávesnice

key 0: Zobrazit počet záznamů, průměrnou, minimální a maximální teplotu za poslední hodinu
        a export agregovaných dat po hodinách za posledních 24 hodin do CSV souboru
key 1: Exportovat data za poslední hodinu do CSV souboru
key 2: Ukončit skript
"""
def keypad_action():
    global running
    
    # bylo stisknuto tlačítko 0?
    if keypad.was_pressed(0):
        for sensor_id in SENSOR_IDS:
            """ Do konzole vypíšeme počet záznamů, průměrnou, minimální a maximální teplotu za poslední hodinu """
            # WHERE podmínka pro konkrétní senzor a poslední hodinu
            where = f"sensor_id = '{sensor_id}' AND timestamp >= datetime('now', '-1 hour')"
            print("{} - Total records: {}, Temperature Avg: {:.1f}°C, Min: {:.1f}°C, Max: {:.1f}°C".format(
                sensor_id,
                sql.count(where_clause=where),
                sql.get_average_temperature(where_clause=where),
                sql.get_min_temperature(where_clause=where),
                sql.get_max_temperature(where_clause=where),
            ))

        """ Export agregovaných dat z jednoho senzoru po hodinách za 1 den (za 24 hodin) do CSV souboru """
        columns = (
            "sensor_id, "
            "strftime('%Y-%m-%d %H', timestamp) AS hour, "
            "ROUND(AVG(temperature), 1) AS avg_temp, "
            "MIN(temperature) AS min_temp, "
            "MAX(temperature) AS max_temp, "
            "COUNT(*) AS record_count"
        )
        exportCsv(
            fileName="exports/export24.csv",
            rows=sql.execute_select_get_all(
                columns=columns,
                where_clause=f"timestamp >= datetime('now', '-1 day')",
                group_by="sensor_id, strftime('%Y-%m-%d %H', timestamp)",
                order_by="sensor_id ASC, hour ASC",
            ),
            headerColumnNames=sql.get_column_names(columns=columns),
        )

    # bylo stisknuto tlačítko 1?
    if keypad.was_pressed(1):
        """ Export všech dat z jednoho senzoru za poslední hodinu do CSV souboru """
        exportCsv(
            fileName="exports/export1.csv",
            rows=sql.execute_select_get_all(
                where_clause=f"sensor_id = '{SENSOR_IDS[1]}' AND timestamp >= datetime('now', '-1 hour')",
                order_by="timestamp ASC",
            ), 
            headerColumnNames=sql.get_column_names(),
        )

    # bylo stisknuto tlačítko 2?
    if keypad.was_pressed(2):
        """ Pozadavek na ukončení skriptu """
        print("\nKey 2 pressed. Exiting...")
        running = False

# Funkce zavolana pri signalu interrupt (pro "bezpečné" ukončení skriptu)
def signal_handler(sig, frame):
    global running
    print("\nInterrupt signal received. Exiting...")
    running = False


if __name__ == "__main__":
    # registrace handleru pro signal interrupt
    signal.signal(signal.SIGINT, signal_handler)

    # dokud máme běžet, tak čteme data ze senzoru, ukládáme je do DB a vypisujeme do konzole
    while running:
        try:
            heartbeat_led.on()

            for sensor_id, dhtDevice in zip(SENSOR_IDS, [dhtDevice1, dhtDevice2]):
                # Čtení dat ze senzoru
                temperature = dhtDevice.temperature
                humidity = dhtDevice.humidity

                # Ukládání dat do DB
                if temperature is not None:
                    sql.insert_data(sensor_id, temperature, humidity)

                # Výpis do konzole
                temperature_str = f"{temperature:.1f}°C" if temperature is not None else "N/A"
                humidity_str = f"{humidity:.1f}%" if humidity is not None else "N/A"
                log_str = f"{sensor_id} - Temperature: {temperature_str}, Humidity: {humidity_str}"
                if temperature is None:
                    log_str += " - Data not inserted."               
                print(log_str)

            heartbeat_led.off()

            # během 3 sekund (30 desetin) kontrolujeme stisky tlačítek a čekáme před dalším čtením
            for _ in range(30):
                keypad_action()
                time.sleep(0.1)

        except Exception as ex:
            # V případě chyby vypíšeme chybové hlášení a počkáme 2 sekundy před dalším pokusem
            print(f"Error occurred: {ex}")
            time.sleep(2)

    sql.close()
    heartbeat_led.off()
