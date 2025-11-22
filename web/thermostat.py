"""
thermostat.py
-------------

Účel:
- Řídí logiku termostatu pro senzory teploty.
- Periodicky kontroluje hodnoty teploty z databáze a podle nastaveného setpointu
  a hystereze zapíná nebo vypíná relé.
- Používá ActuatorManager pro ovládání relé a LED.

Použití:
- Vytvoř instanci Thermostat s odkazem na ActuatorManager.
- Zavolej `start()` pro spuštění vlákna, které bude periodicky kontrolovat senzory.
- Zavolej `stop()` pro ukončení vlákna a bezpečné vypnutí.
- Pro testování lze použít `thermostat_once()` pro jednorázovou kontrolu.

Hlavní třída:
- Thermostat(act: ActuatorManager, interval: int = 10, hysteresis: float = 1.0)
    - act: správce aktuátorů (LED/relé)
    - interval: čas mezi cykly kontroly v sekundách
    - hysteresis: šířka deadbandu kolem setpointu (např. 1.0 → ±1 °C)

Vlákno:
- Běží na pozadí, kontroluje všechny senzory v režimu "auto".
- Pokud je teplota pod setpoint - hystereze → relé ON.
- Pokud je teplota nad setpoint + hystereze → relé OFF.
- Jinak se stav nemění.
"""

import threading
import logging
from typing import Optional
from db import SqlSensorData
from actuators.manager import ActuatorManager

logger = logging.getLogger("thermostat")


class Thermostat:
    """
    Periodicky kontroluje senzory a přepíná relé v režimu 'auto' podle setpointu (nastaveného u relé).

    - Aktuální teplotu čte z DB pro konkrétní senzor (SqlSensorData.get_current).
    - Má jednu společnou hysterezi pro celou třídu (deadband ±hys kolem setpointu).
    - Běží ve vlákně; bezpečně start/stop; podrobné logování.

    Args:
        act (Optional[ActuatorManager]): Správce aktuátorů (pokud None, termostat nic neovládá).
        interval (int): Interval v sekundách mezi cykly kontroly (minimálně 1).
        hysteresis (float): Šířka deadbandu (např. 1.0 → ±1.0 °C).
    """

    def __init__(self, act: Optional[ActuatorManager], interval: int = 10, hysteresis: float = 1.0) -> None:
        self.act: Optional[ActuatorManager] = act
        self.interval: int = max(1, int(interval))
        self.hysteresis: float = float(hysteresis)
        self._stop_event: Optional[threading.Event] = None
        self._thread: Optional[threading.Thread] = None

    # ---- veřejné API ----
    def start(self) -> None:
        """
        Spustí vlákno termostatu.

        Pokud už běží, metoda nic neudělá.
        """
        if self._thread and self._thread.is_alive():
            logger.debug("Thermostat already running")
            return
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._loop, name="thermostat", daemon=True)
        self._thread.start()
        logger.info(
            f"Thermostat thread started (interval = {self.interval}s, hysteresis = {self.hysteresis}°C)"
        )

    def stop(self, timeout: float = 2.0) -> None:
        """
        Zastaví vlákno termostatu.

        Args:
            timeout (float): Maximální čas v sekundách pro join vlákna.
        """
        if not self._stop_event:
            return
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=timeout)
        self._thread = None
        self._stop_event = None
        logger.info("Thermostat thread stopped")

    def thermostat_once(self) -> None:
        """
        Provede jednorázovou kontrolu (užitečné pro testy).
        """
        self._run_iteration()

    # ---- interní ----
    def _loop(self) -> None:
        """
        Hlavní smyčka běžící ve vlákně.
        Periodicky spouští `_run_iteration()` dokud není nastaven `_stop_event`.
        """
        logger.info("Thermostat loop booting")
        while not (self._stop_event and self._stop_event.wait(self.interval)):
            try:
                self._run_iteration()
            except Exception as ex:
                logger.exception("Thermostat exception: %s", ex)
        logger.info("Thermostat loop exiting")

    def _read_sensor_temp(self, sensor_id: str) -> Optional[float]:
        """
        Načte aktuální teplotu senzoru z DB.

        Args:
            sensor_id (str): ID senzoru (např. 'DHT11_01').

        Returns:
            Optional[float]: Aktuální teplota nebo None, pokud není dostupná.
        """
        try:
            with SqlSensorData() as db:
                row = db.get_current(sensor_id)
            if not row:
                return None
            temp = row.get("temperature") if isinstance(row, dict) else row[2]
            return float(temp) if temp is not None else None
        except Exception as ex:
            logger.exception("Failed to read sensor %s temperature: %s", sensor_id, ex)
            return None

    def _run_iteration(self) -> None:
        """
        Projde všechna relé v režimu 'auto' a rozhodne ON/OFF podle DB teploty, setpointu a hystereze.
        """
        if not self.act:
            logger.warning("No ActuatorManager provided; skipping iteration")
            return

        hys: float = self.hysteresis

        for sensor_name in self.act.list_sensors():
            try:
                mode: str = self.act.get_relay_mode(sensor_name)
                if mode != "auto":
                    continue

                temp: Optional[float] = self.act.get_sensor_temperature(sensor_name)
                if temp is None:
                    logger.debug("No temperature for sensor %s; skipping", sensor_name)
                    continue

                sp: float = self.act.get_setpoint(sensor_name)
                current_on: bool = self.act.get_relay_state(sensor_name)

                desired: Optional[bool] = None
                if temp <= (sp - hys):
                    desired = True
                elif temp >= (sp + hys):
                    desired = False

                if desired is not None and desired != current_on:
                    log: str = (
                        f"Thermostat action: sensor={sensor_name} "
                        f"temp={temp:.2f} setpoint={sp:.2f} -> "
                        f"{'ON' if desired else 'OFF'}"
                    )
                    logger.info(log)
                    if desired:
                        self.act.turn_on_relay(sensor_name)
                    else:
                        self.act.turn_off_relay(sensor_name)

            except Exception as ex:
                logger.exception("Error processing thermostat for sensor=%s: %s", sensor_name, ex)
