import gpiozero
import time

class Keypad:
    def __init__(self, pinNumbers: list[int]):
        self.buttons = [gpiozero.Button(pin, bounce_time=0.1) for pin in pinNumbers]
        for index, button in enumerate(self.buttons):
            button.when_pressed = lambda ind=index: self.__handle_key_press(ind)
        self.__key_press = [False] * len(pinNumbers)

    def stop(self):
        # 1) odregistrovat všechny callbacky
        for b in self.buttons:
            try:
                b.when_pressed = None
                b.when_released = None
                b.when_held = None
            except Exception:
                pass

        # 2) krátce počkat aby backend dokončil právě probíhající zpracování eventů
        #    a případně počkat na uvolnění tlačítka
        for b in self.buttons:
            try:
                # wait_for_release je blokující s timeoutem, bezpečné použít krátký timeout
                b.wait_for_release(timeout=0.1)
            except Exception:
                # ignorovat timeout/chyby — jen dáváme šanci backendu dokončit
                pass

        # ještě malá dodatečná prodleva
        try:
            time.sleep(0.08)
        except Exception:
            pass

    def close(self):
        # Odregistrovat callbacky
        self.stop()

        # Zavřít tlačítka
        for b in self.buttons:
            try: b.close()
            except Exception: pass

        # Uvolnit reference
        self.buttons = []

        # reset interního stavu kláves
        try: self.__key_press = [False] * len(self.__key_press)
        except Exception: self.__key_press = []

    """
    Pomocná metoda pro zapamatování stisknutí tlačítka. 
    Volaná je v lambda funkci pro událost stisknutí tlačítka. Událost je zaregistrována v konstruktoru.
    """
    def __handle_key_press(self, index: int) -> None:
        self.__key_press[index] = True


    """
    Zjištění, zda bylo tlačítko stisknuto od posledního volání této metody

    Args:
        index: Index tlačítka (0 až počet tlačítek - 1)
    Returns: 
        True, pokud bylo tlačítko stisknuto, jinak False
    Raises:
        ValueError: Pokud je index mimo rozsah
    """
    def was_pressed(self, index: int) -> bool:
        if 0 <= index < len(self.buttons):
            pressed = self.__key_press[index]
            self.__key_press[index] = False
            return pressed
        else:
            raise ValueError(f"Key number must be between 0 and {len(self.buttons) - 1}")
