# thermostat.py
import threading
import time
from typing import Optional, Dict
from db import SqlSensorData
from actuators import ActuatorManager
import logging

logger = logging.getLogger("thermostat")

class Thermostat:
    """
    Periodicky kontroluje senzory a přepíná relé v režimu 'auto' podle setpointu.
    Konstruktor přijímá:
      - act: instance ActuatorManager (může být None; v tom případě nic nespravuje)
      - interval: kontrolní interval v sekundách
      - hysteresis: celková šířka deadbandu v °C (např. 1.0)
    """
    def __init__(self, act: Optional[ActuatorManager], interval: int = 10, hysteresis: float = 1.0):
        self.act = act
        self.interval = max(1, int(interval))
        self.hysteresis = float(hysteresis)
        self._stop_event: Optional[threading.Event] = None
        self._thread: Optional[threading.Thread] = None

    # ---- veřejné API ----
    def start(self):
        if self._thread and self._thread.is_alive():
            logger.debug("Thermostat already running")
            return
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="thermostat", daemon=True)
        self._thread.start()
        logger.info(f"Thermostat thread started (interval = {self.interval}s, hysteresis = {self.hysteresis}°C)")

    def stop(self, timeout: float = 2.0):
        if not self._stop_event:
            return
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=timeout)
        self._thread = None
        self._stop_event = None
        logger.info("Thermostat thread stopped")

    def thermostat_once(self):
        """One-shot run (useful for tests)."""
        self._run_iteration()

    # ---- interní ----
    def _loop(self):
        logger.info("Thermostat loop booting")
        while not (self._stop_event and self._stop_event.wait(self.interval)):
            try:
                self._run_iteration()
            except Exception as ex:
                logger.exception("Thermostat exception: %s", ex)
        logger.info("Thermostat loop exiting")

    def _read_sensor_temp(self, sensor_id: str) -> Optional[float]:
        try:
            with SqlSensorData() as db:
                row = db.get_current(sensor_id)
            if not row:
                return None
            # db.get_current returns a mapping-like object in your app; adapt if different
            temp = row.get("temperature") if isinstance(row, dict) else row[2]
            if temp is None:
                return None
            return float(temp)
        except Exception as ex:
            print(f"Failed to read sensor {sensor_id} - exception {ex}")
            return None

    def _get_actor_setpoint(self, actor_name: str) -> Optional[float]:
        try:
            if not self.act:
                return None
            return self.act.get_setpoint(actor_name)
        except Exception as ex:
            print(f"Failed to get setpoint for {actor_name} - exception {ex}")
            return None

    def _get_relay_mode(self, actor_name: str) -> Optional[str]:
        try:
            if not self.act:
                return None
            return self.act.get_relay_mode(actor_name)
        except Exception as ex:
            print(f"Failed to read mode for {actor_name} - exception {ex}")
            return None

    def _get_actor_state(self, actor_name: str) -> Optional[bool]:
        try:
            if not self.act:
                return None
            return self.act.get_actor_state(actor_name)
        except Exception as ex:
            print(f"Failed to read actor state {actor_name} - exception {ex}")
            return None

    def _set_actor(self, actor_name: str, on: bool):
        try:
            if not self.act:
                print(f"No ActuatorManager provided; skipping set_actor for {actor_name}")
                return
            self.act.set_actor(actor_name, on)
        except Exception as ex:
            print("Failed to set actor {actor_name} -> {on} - exception {ex}")

    def _run_iteration(self):
        hys = float(self.hysteresis)
        for actor_name in self.act.get_relays():
            sensor_id = None
            try:
                # získat id senzoru odstraněním prefixu relay_
                if actor_name.startswith("relay_"):
                    sensor_id = actor_name.removeprefix("relay_")
                else:
                    sensor_id = actor_name
        
                mode = self._get_relay_mode(actor_name)
                if mode != "auto":
                    continue

                temp = self._read_sensor_temp(sensor_id)
                if temp is None:
                    print(f"No temperature for sensor {sensor_id}; skipping")
                    continue

                sp = self._get_actor_setpoint(actor_name)
                if sp is None:
                    print(f"No setpoint for actor {actor_name}; skipping")
                    continue
                sp = float(sp)
                current_on = self._get_actor_state(actor_name)
                if temp <= (sp - hys):
                    # V zadani je: "Pokud naměřená teplota klesne pod (setpoint - hys), relé se zapne"
                    # protoze ale ziskavam teplotu v celych stupnich, zvedlo by to hysterezi o dalsi 1°C, proto je tam podminka <=
                    desired = True
                elif temp >= (sp + hys):
                    # V zadani je: "Pokud naměřená teplota překročí (setpoint + hys), relé se vypne"
                    # protoze ale ziskavam teplotu v celych stupnich, zvedlo by to hysterezi o dalsi 1°C, proto je tam podminka >=
                    desired = False
                else:
                    # Jinak nedelej nic
                    desired = None
                    
                if desired is not None and desired != current_on:
                    # Pokud mas novy stav a je jiny nez soucasny, zmen ho
                    print(f"Thermostat action: sensor={sensor_id} actor={actor_name} temp={temp:.2f} setpoint={sp:.2f} -> {'ON' if desired else 'OFF'}")
                    self._set_actor(actor_name, desired)
            except Exception as ex:
                print(f"Error processing thermostat for sensor={sensor_id} actor={actor_name} - exception {ex}")
