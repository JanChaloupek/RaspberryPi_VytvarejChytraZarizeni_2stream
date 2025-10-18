import gpiozero

class Keypad:
    def __init__(self, pinNumbers):
        self.buttons = [gpiozero.Button(pin, bounce_time=0.1) for pin in pinNumbers]
        for index, button in enumerate(self.buttons):
            button.when_pressed = lambda ind=index: self.__handle_key_press(ind)
        self.__key_press = [False] * len(pinNumbers)

    """
        Pomocná metoda pro zapamatování stisknutí tlačítka volana v lambda funkci
    """
    def __handle_key_press(self, index):
        self.__key_press[index] = True

    """
        Zjištění, zda bylo tlačítko stisknuto od posledního volání této metody
        Args:
            index: Index tlačítka (0 až počet tlačítek - 1)
        Returns: True, pokud bylo tlačítko stisknuto, jinak False
    """
    def is_pressed(self, index):
        if 0 <= index < len(self.buttons):
            pressed = self.__key_press[index]
            self.__key_press[index] = False
            return pressed
        else:
            raise ValueError("Key number must be between 0 and {}".format(len(self.buttons) - 1))
