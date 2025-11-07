import csv
import time
import board
import signal
from keypad import Keypad
from typing import Any, Optional
from gpiozero import LED, OutputDevice
from adafruit_dht import DHT11, DHTBase
from sqlSensorData import SqlSensorData

# Identifikátory senzorů
SENSOR_IDS = ["DHT11_01", "DHT11_02"]

#relay = OutputDevice(23, active_high=True, initial_value=False)  # LED na GPIO pin 23
#rele2 = OutputDevice(24, active_high=True, initial_value=False)  # LED na GPIO pin 24
# 18


class SensorsMeasureApp:

    # Inicializace aplikace (zařízení)
    def __init__(self):
        print("Inicializace aplikace")
        self.__heartbeat_led = LED(27)                      # LED na GPIO pin 27
        self.__dhtDevice1 = DHT11(board.D17)                # DHT11 na GPIO pin 17
        self.__dhtDevice2 = DHT11(board.D22)                # DHT11 na GPIO pin 22
        self.__keypad = Keypad([16, 20, 21])                # Klávesnice z GPIO pinů 16 (key0), 20 (key1), 21 (key2)
        self.__sql = SqlSensorData("../data_db/sensors.db")    # SQLite databáze sensors.db s tabulkou sensor_data

        # Proměnná pro řízení běhu smyčky (ukončení skriptu stiskem klávesy 2 nebo signálem interrupt)
        self.running = True
        self.__cleaned = False

    def signal_handler(self, sig, frame):
            print(f"Signal {sig} received. Stopping app.")
            self.running = False

    """
    Provedeni exportu do CSV

    Args:
        fileName: Název CSV souboru
        rows: Data řádků pro export
        headerColumnNames: Sloupce záhlaví (volitelné) - pokud není zadáno, záhlaví nebude zahrnuto
    Returns:
        None
    """
    def __exportCsv(self, fileName: str, rows: list[list[Any]], headerColumnNames: Optional[list[str]] = None) -> None:
        with open(file=fileName, mode='w', newline='') as file:
            writer = csv.writer(file, strict=True)
            if headerColumnNames is not None:               # pokud máme sloupce záhlaví
                writer.writerow(headerColumnNames)          #   zapíšene záhlaví do exportu
            writer.writerows(rows)                          # zapiseme všechny řádky dat do exportu
        print(f"Data is successfully exported to {fileName}")


    """
    Funkce implementující co se má stát po stisknutí tlačítek klávesnice

    key 0: Zobrazit počet záznamů, průměrnou, minimální a maximální teplotu za poslední hodinu
            a export agregovaných dat po hodinách za posledních 24 hodin do CSV souboru
    key 1: Exportovat data za poslední hodinu do CSV souboru
    key 2: Ukončit skript
    """
    def __keypad_action(self):
        # bylo stisknuto tlačítko 0?
        if self.__keypad.was_pressed(0):
            # projdi jednotlive senzory
            for sensor_id in SENSOR_IDS:
                """ Do konzole vypíšeme počet záznamů, průměrnou, minimální a maximální teplotu za poslední hodinu """
                # WHERE podmínka pro konkrétní senzor a poslední hodinu
                where = f"sensor_id = '{sensor_id}' AND timestamp >= datetime('now', '-1 hour')"
                print("{} - Total records: {}, Temperature Avg: {:.1f}°C, Min: {:.1f}°C, Max: {:.1f}°C".format(
                    sensor_id,
                    self.__sql.count(where_clause=where),
                    self.__sql.get_average_temperature(where_clause=where),
                    self.__sql.get_min_temperature(where_clause=where),
                    self.__sql.get_max_temperature(where_clause=where),
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
            self.__exportCsv(
                fileName="../exports/export24.csv",
                rows=self.__sql.execute_select_get_all(
                    columns=columns,
                    where_clause=f"timestamp >= datetime('now', '-1 day')",
                    group_by="sensor_id, strftime('%Y-%m-%d %H', timestamp)",
                    order_by="sensor_id ASC, hour ASC",
                ),
                headerColumnNames=self.__sql.get_column_names(columns=columns),
            )

        # bylo stisknuto tlačítko 1?
        if self.__keypad.was_pressed(1):
            """ Export všech dat z jednoho senzoru za poslední hodinu do CSV souboru """
            self.__exportCsv(
                fileName="../exports/export1.csv",
                rows=self.__sql.execute_select_get_all(
                    where_clause=f"sensor_id = '{SENSOR_IDS[1]}' AND timestamp >= datetime('now', '-1 hour')",
                    order_by="timestamp ASC",
                ), 
                headerColumnNames=self.__sql.get_column_names(),
            )

        # bylo stisknuto tlačítko 2?
        if self.__keypad.was_pressed(2):
            """ Pozadavek na ukončení skriptu """
            try:
                self.__keypad.stop()
            except Exception:
                pass
            # delší čekání, aby backend dokončil asynchronní zpracování
            try:
                time.sleep(0.18)
            except Exception:
                pass
            print("\nKey 2 pressed. Stopping app.")
            self.running = False

    def __sensor_DHT_measure(self, sensor_id: str, dhtDevice: DHTBase) -> None:
        try:
            # Čtení dat ze senzoru
            temperature = dhtDevice.temperature
            humidity = dhtDevice.humidity

            # Ukládání dat do DB
            if temperature is not None:
                self.__sql.insert_data(sensor_id, temperature, humidity)

            # Výpis do konzole
            temperature_str = f"{temperature:.1f}°C" if temperature is not None else "N/A"
            humidity_str = f"{humidity:.1f}%" if humidity is not None else "N/A"
            log_str = f"{sensor_id} - Temperature: {temperature_str}, Humidity: {humidity_str}"
            if temperature is None:
                log_str += " - Data not inserted."               
            print(log_str)

        except Exception as ex:
            # V případě chyby vypíšeme chybové hlášení a počkáme 2 sekundy před dalším pokusem
            print(f"Error occurred: {ex}")
            time.sleep(2)

    def cleanup(self) -> None:
        if getattr(self, "_SensorsMeasureApp__cleaned", False):
            print("cleanup: already done")
            return
        self.__cleaned = True

        print("cleanup: start - waiting")
        time.sleep(1)
        print("cleanup: wait ending")

        # Keypad
        try:
            kp = getattr(self, "_SensorsMeasureApp__keypad", None)
            if kp is not None:
                if hasattr(kp, "close"):
                    try:
                        print("cleanup: keypad.close()")
                        kp.close()
                    except Exception as e:
                        print(f"cleanup: keypad.close() failed: {e}")
                elif hasattr(kp, "deinit"):
                    try:
                        print("cleanup: keypad.deinit()")
                        kp.deinit()
                    except Exception as e:
                        print(f"cleanup: keypad.deinit() failed: {e}")
            time.sleep(0.05)
        except Exception as e:
            print(f"cleanup: keypad block error: {e}")
        
        time.sleep(0.08)

        # LED
        try:
            print("cleanup: led off")
            if getattr(self, "_SensorsMeasureApp__heartbeat_led", None):
                try: self.__heartbeat_led.off()
                except Exception as e: print(f"cleanup: led.off() failed: {e}")
                if hasattr(self.__heartbeat_led, "close"):
                    try:
                        print("cleanup: led.close()")
                        self.__heartbeat_led.close()
                    except Exception as e:
                        print(f"cleanup: led.close() failed: {e}")
            time.sleep(0.05)
        except Exception as e:
            print(f"cleanup: led block error: {e}")

        # SQL
        try:
            if getattr(self, "_SensorsMeasureApp__sql", None):
                try:
                    print("cleanup: sql.close()")
                    self.__sql.close()
                except Exception as e:
                    print(f"cleanup: sql.close() failed: {e}")
            time.sleep(0.05)
        except Exception as e:
            print(f"cleanup: sql block error: {e}")

        # Force backend cleanup once
#        try:
#            print("cleanup: Device.close()")
#            Device.close()
#        except Exception as e:
#            print(f"cleanup: Device.close() failed: {e}")

        print("cleanup: odregistuji signaly")
        try:
            signal.signal(signal.SIGINT, signal.SIG_DFL)
            try: signal.signal(signal.SIGTERM, signal.SIG_DFL)
            except Exception: pass
        except Exception:
            pass
        # Dajíme malou prodlevu, aby backend dokončil teardown
        try:
            time.sleep(0.20)
        except Exception:
            pass

        print("cleanup: finished")

    def run(self):
        print("Aplikace bezi (meri a uklada data)")
        # dokud máme běžet, tak čteme data ze senzoru, ukládáme je do DB a vypisujeme do konzole
        while self.running:
            try:
                self.__heartbeat_led.on()

                for sensor_id, dhtDevice in zip(SENSOR_IDS, [self.__dhtDevice1, self.__dhtDevice2]):
                    self.__sensor_DHT_measure(sensor_id, dhtDevice)
                    
                self.__heartbeat_led.off()

                # během 3 sekund (30 desetin) kontrolujeme stisky tlačítek a čekáme před dalším čtením
                for _ in range(30):
                    self.__keypad_action()
                    time.sleep(0.1)
#                    if not self.running:
#                        break
                        
            except Exception as ex:
                # V případě chyby vypíšeme chybové hlášení a počkáme 2 sekundy před dalším pokusem
                print(f"Error occurred: {ex}")
                time.sleep(2)

# Funkce zavolana pri signalu interrupt (pro "bezpečné" ukončení skriptu)
def signal_handler(sig, frame):
    print("\nInterrupt signal received. Exiting...")
    if app:
        app.running = False

    
def register_signal_handlers(app):
    signal.signal(signal.SIGINT, app.signal_handler)
    try:
        signal.signal(signal.SIGTERM, app.signal_handler)
    except Exception:
        pass


if __name__ == "__main__":
    app = SensorsMeasureApp()
    register_signal_handlers(app)
    try:
        app.run()
    finally:
        app.cleanup()
    