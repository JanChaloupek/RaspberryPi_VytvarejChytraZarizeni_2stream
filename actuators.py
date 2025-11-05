# actuators.py
import os
import signal
import atexit
import threading
from typing import Dict, Optional, Any
import logging

try:
    from gpiozero import LED, OutputDevice
except Exception:
    LED = None
    OutputDevice = None

from db import SqlSensorData

logger = logging.getLogger("actuators")

NV_PREFIX = "actuator-"  # prefix pro klíče v nonvolatile_params
ALLOWED_RELAY_MODES = ("auto", "on", "off")

class ActuatorManager:
    def __init__(self, config: Optional[Dict[str, Dict]] = None):
        self._default_config = {
            "led_DHT11_01": {"type": "led", "pin": 18},
            "led_DHT11_02": {"type": "led", "pin": 12},
            "relay_DHT11_01": {"type": "relay", "pin": 23},
            "relay_DHT11_02": {"type": "relay", "pin": 24},
        }
        self._config = (config.copy() if config else self._default_config.copy())
        self._devices: Dict[str, Optional[object]] = {k: None for k in self._config}
        self._states: Dict[str, bool] = {k: False for k in self._config}
        self._params: Dict[str, Dict[str, Any]] = {k: {} for k in self._config}

        # defaulty parametrů
        for name in list(self._params.keys()):
            if "relay" in name:
                self._params[name].setdefault("relay_mode", "auto")
                self._params[name].setdefault("setpoint", 25.0)
            if "led" in name:
                self._params[name].setdefault("label", name)
                self._params[name].setdefault("invert", False)

        self._inited = False
        self._lock = threading.RLock()
        self._db: Optional[SqlSensorData] = None
        try:
            db = SqlSensorData()
            db.open()
            self._db = db
            try:
                loaded = self._db.load_actuator_params(prefix=NV_PREFIX)
                for name, kv in loaded.items():
                    if name not in self._params:
                        self._params[name] = {}
                    self._params[name].update(kv)
            except Exception:
                # pokud nemáme parametry pokračujeme bez nich ale s vytvorenou DB
                pass
        except Exception:
            # pokud se nepovedlo inicializovat SqlSensorData pokračujeme, ale bez DB
            self._db = None

        try:
            atexit.register(self.close_all)
        except Exception:
            pass

        try:
            signal.signal(signal.SIGINT, self._handle_sig)
            signal.signal(signal.SIGTERM, self._handle_sig)
        except Exception:
            pass

    # ---- konfigurace ----
    # připraveno na změnu konfugurace po vytvoření objektu (zatím nepoužito)
    def configure(self, mapping: Dict[str, Dict]):
        with self._lock:
            if self._inited:
                raise RuntimeError("Cannot reconfigure after init")
            new = self._default_config.copy()
            new.update(mapping)
            self._config = new
            self._devices = {k: None for k in self._config}
            self._states = {k: False for k in self._config}
            new_params = {k: self._params.get(k, {}) for k in self._config}
            self._params = new_params

    # ---- inicializace ----
    def init_if_needed(self):
        logger.info("init_if_needed")
        with self._lock:
            if self._inited:
                logger.info("uz inicializovano")
                return
            for name, cfg in self._config.items():
                typ = cfg.get("type")
                pin = cfg.get("pin")
#                print(typ, pin)
                dev = None
                if typ == "led" and LED is not None:
                    try:
                        dev = LED(pin)
                    except Exception as e:
                        dev = None
                elif typ == "relay" and OutputDevice is not None:
                    try:
                        dev = OutputDevice(pin, active_high=True, initial_value=False)
                    except Exception as e:
                        dev = None
                logger.info(f"Device: name={name} type={typ}, pin={pin}, created={dev}")
                self._devices[name] = dev
                self._states[name] = False
            self._inited = True
            if self._db:
                try:
                    loaded = self._db.load_actuator_params(prefix=NV_PREFIX)
                    for name, kv in loaded.items():
                        if name not in self._params:
                            self._params[name] = {}
                        self._params[name].update(kv)
                    for device in self._devices:
                        if device is not None:
                            self.s
                except Exception:
                    pass
            self._restore_state_in_all_devices()

    def _ensure_inited(self):
        if not self._inited:
            self.init_if_needed()

    def _handle_sig(self, signum, frame):
        try:
            self.close_all()
        finally:
            raise SystemExit

    # ---- základní param metody ----
    def get_relays(self):
        list = []
        for name, cfg in self._config.items():
            typ = cfg.get("type")
            if typ == "relay":
                list.append(name)
        return list
    
    # ulozi parametr k aktuatoru
    def set_param(self, name: str, param: str, value: Any, persist: bool = True):
        with self._lock:
            logger.info(f"set_param(name={name}, param={param}, value={value}, persist={persist})")
            if name not in self._params:
                raise KeyError(name)
            self._params[name][param] = value
            if persist:
                self.save_param(name, param)

    # precte parametr k aktuatoru
    def get_param(self, name: str, param: str, default: Any = None) -> Any:
        logger.info(f"get_param(name={name}, param={param}, default={default})")
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            if param in self._params[name]:
                # pokud máme parametr v paměti, rovnou ho vrátíme
                value = self._params[name][param]
                logger.info(f"get_param from memory - {value}")
                return value
            if self._db:
                # pokusime se ho vycist z DB pokud ji mame
                v = self.load_param(name, param)
                logger.info(f"get_param from db - {v}")
                return default if v is None else v
            return default

    # ulozi hodnotu parametru persistentne (do DB)
    def save_param(self, name: str, param: str):
        with self._lock:
            if not self._db:
                return
            if name not in self._params:
                raise KeyError(name)
            if param not in self._params[name]:
                # takovy parametr nemame -> nelze ho tedy ulozit do DB
                return
            try:
                value = self._params[name][param]
                self._db.save_actuator_param(name, param, value, prefix=NV_PREFIX)
            except Exception as ex:
                print("save_params - exception", ex)
                pass

    # vycte parametr z DB
    def load_param(self, name: str, param: str) -> Optional[Any]:
        with self._lock:
            if not self._db:
                return None
            if name not in self._params:
                raise KeyError(name)
            try:
                key = f"{NV_PREFIX}{name}-{param}"
                v = self._db.nv_get(key)
                if v is None:
                    return None
                if v in ("True", "False"):
                    parsed = True if v == "True" else False
                else:
                    try:
                        if "." in v:
                            parsed = float(v)
                        else:
                            parsed = int(v)
                    except Exception:
                        parsed = v
                self._params[name][param] = parsed
                return parsed
            except Exception:
                return None

    def save_all_params(self):
        with self._lock:
            if not self._db:
                return
            try:
                self._db.save_actuator_params_bulk(self._params, prefix=NV_PREFIX)
            except Exception:
                pass

    def load_all_params(self):
        with self._lock:
            if not self._db:
                return
            try:
                loaded = self._db.load_actuator_params(prefix=NV_PREFIX)
                for name, kv in loaded.items():
                    if name not in self._params:
                        self._params[name] = {}
                    self._params[name].update(kv)
            except Exception:
                pass

    # ---- wrappery pro relay ----
    def set_relay_mode(self, name: str, mode: str, persist: bool = True):
        if mode not in ALLOWED_RELAY_MODES:
            raise ValueError(f"Invalid relay mode '{mode}'. Allowed: {ALLOWED_RELAY_MODES}")
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            self._params[name]["relay_mode"] = mode
            if persist and self._db:
                try:
                    self._db.save_actuator_param(name, "relay_mode", mode, prefix=NV_PREFIX)
                except Exception:
                    pass

    def get_relay_mode(self, name: str) -> str:
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            return str(self._params[name].get("relay_mode", "auto"))

    def set_setpoint(self, name: str, setpoint: float, persist: bool = True, min_v: float = -50.0, max_v: float = 150.0):
        if not isinstance(setpoint, (int, float)):
            raise ValueError("Setpoint must be a number")
        if not (min_v <= setpoint <= max_v):
            raise ValueError(f"Setpoint {setpoint} out of allowed range [{min_v}, {max_v}]")
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            self._params[name]["setpoint"] = float(setpoint)
            if persist and self._db:
                try:
                    self._db.save_actuator_param(name, "setpoint", float(setpoint), prefix=NV_PREFIX)
                except Exception:
                    pass

    def get_setpoint(self, name: str) -> float:
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            val = self._params[name].get("setpoint", 25.0)
            try:
                return float(val)
            except Exception:
                return 25.0

    # ---- wrappery pro LED vlastnosti ----
    def set_led_label(self, name: str, label: str, persist: bool = True):
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            self._params[name]["label"] = str(label)
            if persist and self._db:
                try:
                    self._db.save_actuator_param(name, "label", str(label), prefix=NV_PREFIX)
                except Exception:
                    pass

    def get_led_label(self, name: str) -> str:
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            return str(self._params[name].get("label", name))

    def set_led_invert(self, name: str, invert: bool, persist: bool = True):
        if not isinstance(invert, bool):
            raise ValueError("invert must be boolean")
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            self._params[name]["invert"] = invert
            if persist and self._db:
                try:
                    self._db.save_actuator_param(name, "invert", str(invert), prefix=NV_PREFIX)
                except Exception:
                    pass

    def get_led_invert(self, name: str) -> bool:
        with self._lock:
            if name not in self._params:
                raise KeyError(name)
            return bool(self._params[name].get("invert", False))

    # ---- mozne prime pouziti ----
    def turn_on(self, name: str) -> bool:
        return self.set_actor(name, True)

    def turn_off(self, name: str) -> bool:
        return self.set_actor(name, False)

    def toggle(self, name: str) -> bool:
        with self._lock:
            cur = self.get_actor_state(name)
            return self.set_actor(name, not cur)

    # ---- základní operace pro HW ----
    def set_actor(self, name: str, on: bool) -> bool:
        with self._lock:
            if name not in self._devices:
                raise KeyError(name)
            self._ensure_inited()
            dev = self._devices.get(name)
            try:
                if dev is None:
                    self._states[name] = bool(on)
                    self.set_param(name, "state", bool(on), persist=True)
                    return False
                if on:
                    dev.on()
                else:
                    dev.off()
                self._states[name] = bool(on)
                self.set_param(name, "state", bool(on), persist=True)
                return True
            except Exception:
                self._states[name] = bool(on)
                try:
                    self.set_param(name, "state", bool(on), persist=True)
                except Exception:
                    pass
                return False

    def _restore_state_in_all_devices(self):
        for name, dev in list(self._devices.items()):
            if dev is not None:
                try:
                    self.set_actor(name, self._params[name]["state"])
                except Exception as ex:
                    print("restore_state - exception", ex)

    def get_actor_state(self, name: str) -> bool:
        with self._lock:
            if name not in self._states:
                raise KeyError(name)
            self._ensure_inited()
            dev = self._devices.get(name)
            if dev is None:
                return self._states[name]
            try:
                st = dev.is_active
                self._states[name] = st
                self._params[name]["state"] = st
                return st
            except Exception as ex:
                logger.exception("Exception in read state from device: %s", ex)
                return self._states[name]

    # ---- cleanup ----
    def close_all(self):
        with self._lock:
            for name, dev in list(self._devices.items()):
                if dev is not None:
                    try:
                        dev.close()
                    except Exception:
                        pass
                    self._devices[name] = None
            self._inited = False
            try:
                self.save_all_params()
            except Exception:
                pass
            try:
                if self._db is not None:
                    self._db.close()
                    self._db = None
            except Exception:
                pass

    def __enter__(self):
        self.init_if_needed()
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close_all()
