import threading
import atexit
import signal
import logging
from typing import Dict, Any, Optional
from db import SqlSensorData
from .devices import LedDevice, RelayDevice
from .params import ParamRepository

logger = logging.getLogger("actuators")


class SensorConfig:
    def __init__(self, name: str, led_pin: Optional[int] = None, relay_pin: Optional[int] = None) -> None:
        self.name: str = name
        self.led: LedDevice = LedDevice(f"{name}_LED", led_pin)
        self.relay: RelayDevice = RelayDevice(f"{name}_RELAY", relay_pin)


class ActuatorManager:
    def __init__(self, sensors: Dict[str, Dict[str, Any]]) -> None:
        self._lock: threading.RLock = threading.RLock()
        self._sensors: Dict[str, SensorConfig] = {}
        self._params = ParamRepository()

        for name, cfg in sensors.items():
            self._sensors[name] = SensorConfig(name, cfg.get("led_pin"), cfg.get("relay_pin"))

        # obnov stavy z DB
        self.load_params_from_db()

        try:
            atexit.register(self.close_all)
            signal.signal(signal.SIGINT, self._handle_sig)
            signal.signal(signal.SIGTERM, self._handle_sig)
        except Exception:
            pass

    # --- veřejné API ---
    def list_sensors(self) -> list[str]:
        return list(self._sensors.keys())

    def get_sensor_temperature(self, sensor_id: str) -> Optional[float]:
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

    def get_setpoint(self, sensor: str) -> float:
        return float(self._sensors[sensor].relay.setpoint)

    def set_setpoint(self, sensor: str, setpoint: float) -> None:
        self._sensors[sensor].relay.setpoint = float(setpoint)
        self._params.set_param(sensor, "setpoint", float(setpoint))

    def get_relay_mode(self, sensor: str) -> str:
        return self._sensors[sensor].relay.mode

    def set_relay_mode(self, sensor: str, mode: str) -> None:
        self._sensors[sensor].relay.mode = mode
        self._params.set_param(sensor, "relay_mode", mode)

    def get_relay_state(self, sensor: str) -> bool:
        return self._sensors[sensor].relay.get_state()

    def turn_on_relay(self, sensor: str) -> None:
        self._sensors[sensor].relay.set_state(True)
        self._params.set_param(sensor, "relay_state", True)

    def turn_off_relay(self, sensor: str) -> None:
        self._sensors[sensor].relay.set_state(False)
        self._params.set_param(sensor, "relay_state", False)

    def get_actor_state(self, actor_name: str) -> bool:
        if actor_name.startswith("led_"):
            sensor = actor_name.removeprefix("led_")
            return self._sensors[sensor].led.get_state()
        elif actor_name.startswith("relay_"):
            sensor = actor_name.removeprefix("relay_")
            return self._sensors[sensor].relay.get_state()
        else:
            raise KeyError(f"Unknown actor name: {actor_name}")

    def set_actor(self, actor_name: str, on: bool) -> None:
        if actor_name.startswith("led_"):
            sensor = actor_name.removeprefix("led_")
            print(sensor)
            self._sensors[sensor].led.set_state(on)
            self._params.set_param(sensor, "led_state", on)
        elif actor_name.startswith("relay_"):
            sensor = actor_name.removeprefix("relay_")
            self._sensors[sensor].relay.set_state(on)
            self._params.set_param(sensor, "relay_state", on)
        else:
            raise KeyError(f"Unknown actor name: {actor_name}")

    def get_actor_hw_present(self, actor_name: str) -> bool:
        if actor_name.startswith("led_"):
            sensor = actor_name.removeprefix("led_")
            return self._sensors[sensor].led.pin is not None
        elif actor_name.startswith("relay_"):
            sensor = actor_name.removeprefix("relay_")
            return self._sensors[sensor].relay.pin is not None
        else:
            raise KeyError(f"Unknown actor {actor_name}")

    def get_actor_hw_state(self, actor_name: str) -> Optional[bool]:
        if actor_name.startswith("led_"):
            sensor = actor_name.removeprefix("led_")
            return self._sensors[sensor].led.get_hw_state()
        elif actor_name.startswith("relay_"):
            sensor = actor_name.removeprefix("relay_")
            return self._sensors[sensor].relay.get_hw_state()
        else:
            raise KeyError(f"Unknown actor {actor_name}")

    def get_actor_states(self, actor_name: str) -> dict[str, Optional[bool]]:
        """
        Vrátí logický i HW stav aktuátoru.

        Args:
            actor_name (str): Jméno aktuátoru (např. 'led_DHT11_01' nebo 'relay_DHT11_02').

        Returns:
            dict[str, Optional[bool]]: {"logical": True/False, "hw": True/False/None}
        """
        if actor_name.startswith("led_"):
            sensor = actor_name.removeprefix("led_")
            return {
                "logical": self._sensors[sensor].led.get_state(),
                "hw": self._sensors[sensor].led.get_hw_state(),
            }
        elif actor_name.startswith("relay_"):
            sensor = actor_name.removeprefix("relay_")
            return {
                "logical": self._sensors[sensor].relay.get_state(),
                "hw": self._sensors[sensor].relay.get_hw_state(),
            }
        else:
            raise KeyError(f"Unknown actor {actor_name}")

    # --- init/cleanup ---
    def load_params_from_db(self) -> None:
        for sensor_name, sensor_cfg in self._sensors.items():
            led_state = self._params.get_param(sensor_name, "led_state", default=False)
            sensor_cfg.led.set_state(bool(led_state))

            relay_state = self._params.get_param(sensor_name, "relay_state", default=False)
            sensor_cfg.relay.set_state(bool(relay_state))

            relay_mode = self._params.get_param(sensor_name, "relay_mode", default="auto")
            sensor_cfg.relay.mode = relay_mode

            setpoint = self._params.get_param(sensor_name, "setpoint", default=25.0)
            sensor_cfg.relay.setpoint = float(setpoint)

    def close_all(self) -> None:
        for sensor_cfg in self._sensors.values():
            sensor_cfg.led.close()
            sensor_cfg.relay.close()

    def _handle_sig(self, signum, frame):
        self.close_all()
