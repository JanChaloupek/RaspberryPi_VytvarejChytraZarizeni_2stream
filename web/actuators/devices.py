"""
devices.py
----------

Účel:
- Definuje obálky pro ovládání LED a relé pomocí knihovny gpiozero.
- Poskytuje jednotné API pro zapnutí/vypnutí, čtení logického stavu a skutečného HW stavu.
- Používá se v ActuatorManageru a Thermostatu pro řízení aktuátorů.

Použití:
- Vytvoř instanci `LedDevice` nebo `RelayDevice` s názvem a volitelným pinem.
- Voláním `set_state(True/False)` nastavíš stav zařízení.
- `get_state()` vrací logický stav (virtuální).
- `get_hw_state()` vrací skutečný HW stav pinu (pokud je definován).
- `close()` uvolní zařízení a zavře GPIO.

Třídy:
- LedDevice: obálka pro LED (gpiozero.LED).
- RelayDevice: obálka pro relé (gpiozero.OutputDevice), navíc má režim a setpoint.
"""

import logging
from typing import Optional
from gpiozero import LED, OutputDevice

logger = logging.getLogger("devices")


class LedDevice:
    """
    Ovládání LED diody pomocí gpiozero.

    Args:
        name (str): Název zařízení (např. 'led_DHT11_01').
        pin (Optional[int]): GPIO pin; pokud None, zařízení funguje virtuálně.
    """

    def __init__(self, name: str, pin: Optional[int] = None) -> None:
        self.name: str = name
        self.pin: Optional[int] = pin
        self._state: bool = False
        self._device: Optional[LED] = LED(pin) if pin is not None else None

    def set_state(self, on: bool) -> None:
        """
        Nastaví stav LED.

        Args:
            on (bool): True → zapnout, False → vypnout.
        """
        self._state = on
        if self._device:
            self._device.on() if on else self._device.off()

    def get_state(self) -> bool:
        """
        Vrátí logický stav (virtuální).

        Returns:
            bool: True pokud je LED logicky zapnutá, jinak False.
        """
        return self._state

    def get_hw_state(self) -> Optional[bool]:
        """
        Vrátí skutečný HW stav pinu.

        Returns:
            Optional[bool]: True pokud je LED fyzicky svítí, False pokud ne,
                            None pokud není pin definován.
        """
        if self._device:
            return self._device.is_lit
        return None

    def close(self) -> None:
        """Uvolní zařízení a zavře GPIO."""
        if self._device:
            self._device.close()


class RelayDevice:
    """
    Ovládání relé pomocí gpiozero.

    Args:
        name (str): Název zařízení (např. 'relay_DHT11_01').
        pin (Optional[int]): GPIO pin; pokud None, zařízení funguje virtuálně.

    Atributy:
        mode (str): Režim relé ('auto' nebo 'manual').
        setpoint (float): Nastavená teplota pro režim 'auto'.
    """

    def __init__(self, name: str, pin: Optional[int] = None) -> None:
        self.name: str = name
        self.pin: Optional[int] = pin
        self._state: bool = False
        self.mode: str = "auto"
        self.setpoint: float = 25.0
        self._device: Optional[OutputDevice] = OutputDevice(pin) if pin is not None else None

    def set_state(self, on: bool) -> None:
        """
        Nastaví stav relé.

        Args:
            on (bool): True → zapnout, False → vypnout.
        """
        self._state = on
        if self._device:
            self._device.on() if on else self._device.off()

    def get_state(self) -> bool:
        """
        Vrátí logický stav (virtuální).

        Returns:
            bool: True pokud je relé logicky zapnuté, jinak False.
        """
        return self._state

    def get_hw_state(self) -> Optional[bool]:
        """
        Vrátí skutečný HW stav pinu.

        Returns:
            Optional[bool]: True pokud je relé fyzicky sepnuté, False pokud ne,
                            None pokud není pin definován.
        """
        if self._device:
            return self._device.value == 1
        return None

    def close(self) -> None:
        """Uvolní zařízení a zavře GPIO."""
        if self._device:
            self._device.close()
