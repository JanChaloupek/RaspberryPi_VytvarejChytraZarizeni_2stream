import time
import board
import signal
from gpiozero import LED
from sqlSensorData import SqlSensorData
from adafruit_dht import DHT11
from csvExporter import exportCsv
from keypad import Keypad

# Identifikátor senzoru (zatím je jediný ale časem jich může být více)
SENSOR_ID = "DHT11_01"

# Inicializace zařízení
dhtDevice = DHT11(board.D17)                        # DHT11 na GPIO pin 17
keypad = Keypad([16, 20, 21])                       # Klávesnice z GPIO pinů 16 (key0), 20 (key1), 21 (key2)
sql = SqlSensorData("sensors.db")                   # SQLite databáze sensors.db s tabulkou sensor_data

# Globální proměnná pro řízení běhu smyčky (ukončení skriptu stiskem klávesy 2 a signálem)
running = True

# LED pro indikaci činnosti (heartbeat)
heartbeat_led = LED(27)                             # LED na GPIO pin 27
heartbeat_led.off()


"""
    Funkce pro zpracování stisknutých tlačítek
    key 0: Zobrazit počet záznamů, průměrnou, minimální a maximální teplotu za poslední hodinu
            a export agregovaných dat po hodinách za posledních 24 hodin do CSV souboru
    key 1: Exportovat data za poslední hodinu do CSV souboru
    key 2: Ukončit skript
"""
def keypad_action():
    global running
    
    # je stisknuto tlačítko 0?
    if keypad.is_pressed(0):
        """ Do konzole vypíšeme počet záznamů, průměrnou, minimální a maximální teplotu za poslední hodinu """
        # WHERE podmínka pro konkrétní senzor a poslední hodinu
        where = f"sensor_id = '{SENSOR_ID}' AND timestamp >= datetime('now', '-1 hour')"
        print("Total records: {}, Temperature Avg: {:.1f}°C, Min: {:.1f}°C, Max: {:.1f}°C".format(
            sql.count(where_clause=where) or 0, 
            sql.get_average_temperature(where_clause=where), 
            sql.get_min_temperature(where_clause=where), 
            sql.get_max_temperature(where_clause=where),
        ))

        """ Export agregovaných dat z jednoho senzoru po hodinách za posledních 24 hodin/1 den do CSV souboru """
        columns = (
            "sensor_id, "
            "strftime('%Y-%m-%d %H', timestamp) AS hour, "
            "ROUND(AVG(temperature), 1) AS avg_temp, "
            "MIN(temperature) AS min_temp, "
            "MAX(temperature) AS max_temp, "
            "COUNT(*) AS record_count"
        )
        exportCsv(
            fileName="export24.csv",
            rows=sql.execute_select_get_all(
                columns=columns,
                where_clause=f"sensor_id = '{SENSOR_ID}' AND timestamp >= datetime('now', '-1 day')",
                group_by="sensor_id, strftime('%Y-%m-%d %H', timestamp)",
                order_by="timestamp ASC",
            ),
            headersColumns=sql.get_column_names(columns=columns),
        )

    # je stisknuto tlačítko 1?
    if keypad.is_pressed(1):
        """ Export dat z jednoho senzoru za poslední hodinu do CSV souboru """
        exportCsv(
            fileName="export1.csv", 
            rows=sql.execute_select_get_all(
                where_clause=f"sensor_id = '{SENSOR_ID}' AND timestamp >= datetime('now', '-1 hour')",
                order_by="timestamp ASC",
            ), 
            headersColumns=sql.get_column_names(),
        )

    # je stisknuto tlačítko 2?
    if keypad.is_pressed(2):
        """ Pozadavek na ukončení skriptu """
        print("\nKey 2 pressed. Exiting...")
        running = False

# Funkce zavolana pri signalu interrupt (pro "bezpečné" ukončení skriptu)
def signal_handler(sig, frame):
    global running
    print("\nInterrupt signal received. Exiting...")
    running = False

signal.signal(signal.SIGINT, signal_handler)

if __name__ == "__main__":
    # dokud máme běžet, tak čteme data ze senzoru a ukládáme je do DB
    while running:
        try:
            heartbeat_led.on()
            temperature = dhtDevice.temperature
            humidity = dhtDevice.humidity

            temperature_str = "{:.1f}°C".format(temperature) if temperature is not None else "N/A"
            humidity_str = "{:.1f}%".format(humidity) if humidity is not None else "N/A"

            if temperature is not None:
                sql.insert_data(SENSOR_ID, temperature, humidity)
                print("Temperature: {}, Humidity: {}".format(temperature_str, humidity_str))
            else:
                print("Data not saved. Temperature: {}, Humidity: {}".format(temperature_str, humidity_str))
            heartbeat_led.off()

            # během 3 sekund (30 desetin) kontrolujeme stisky tlačítek
            for _ in range(30):
                keypad_action()
                time.sleep(0.1)

        except Exception as ex:
            print("Error occurred: {}".format(ex))

    sql.close()
    heartbeat_led.off()