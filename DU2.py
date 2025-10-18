import math
import gpiozero
import board
import time
import adafruit_dht

class Display:
    def __init__(self, pinNumber):
        self.pinNumber = pinNumber
        self.led = gpiozero.LED(pinNumber)
        self.led.off()

    def show(self, value: float):
        sValue = f"{value:.0f}"
        for char in sValue:
            self.__showdigit(char)
        time.sleep(2)

    def __showdigit(self, digit: str):
        match digit:
            case '-':
                self.__write_dash()
            case '0':
                self.__write_dash()
            case '1':
                self.__write_dot(1)
            case '2':
                self.__write_dot(2)
            case '3':
                self.__write_dot(3)
            case '4':
                self.__write_dot(4)
            case '5':
                self.__write_dot(5)
            case '6':
                self.__write_dot(6)
            case '7':
                self.__write_dot(7)
            case '8':
                self.__write_dot(8)
            case '9':
                self.__write_dot(9)
            case _:
                print("Invalid digit")
        time.sleep(1)

    def __write_dot(self, count: int = 1):
        for _ in range(count):
            self.led.on()
            time.sleep(0.1)
            self.led.off()
            time.sleep(0.2)

    def __write_dash(self):
        self.led.on()
        time.sleep(0.4)
        self.led.off()
        time.sleep(0.2)

def dew_point(temp_c, humidity):
    a = 17.62
    b = 243.12
    alpha = ((a * temp_c) / (b + temp_c)) + math.log(humidity / 100.0)
    dp = (b * alpha) / (a - alpha)
    return dp

DHT_PIN = 17
LED_PIN = 27

if __name__ == "__main__":
        
    display = Display(LED_PIN)
    dhtDevice = adafruit_dht.DHT11(getattr(board, f"D{DHT_PIN}"))

    while True:
        try:
            temperature = dhtDevice.temperature
            humidity = dhtDevice.humidity
            print(f"Teplota: {temperature:.1f}°C  Vlhkost: {humidity:.1f}%")
            dp = dew_point(temperature, humidity)
            print(f"Rosný bod: {dp:.1f}°C")
            display.show(temperature)
        except RuntimeError as error:
            print(f"Reading from DHT sensor failed: {error.args[0]}")
            time.sleep(2.0)
            continue
    
