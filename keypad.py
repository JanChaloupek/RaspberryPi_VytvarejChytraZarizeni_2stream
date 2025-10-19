import gpiozero


class Keypad:
    def __init__(self, pinNumbers: list[int]):
        self.buttons = [gpiozero.Button(pin, bounce_time=0.1) for pin in pinNumbers]
        for index, button in enumerate(self.buttons):
            button.when_pressed = lambda ind=index: self.__handle_key_press(ind)
        self.__key_press = [False] * len(pinNumbers)


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
