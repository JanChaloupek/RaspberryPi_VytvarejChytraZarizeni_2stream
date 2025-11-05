# app.py
from logger_config import configure_logging
import logging

LOG_FILE = "./app.log"
# konfigurace pro celý projekt (root logger)
configure_logging(log_file=LOG_FILE, level=logging.DEBUG, console=True)

import os
import time
from db import SqlSensorData
from flask import Flask, render_template, request
from thermostat import Thermostat
from actuators import ActuatorManager
from services.time_utils import resolve_tz, parse_local_key_to_range
from services.aggregate_service import handle_aggregate, run_aggregate
import services.api_helper as api_helper
from typing import Optional
from pathlib import Path

logger = logging.getLogger("web")

act: Optional[ActuatorManager] = None
app = Flask(__name__)

sensor_map = {
    "DHT11_01": "Vnitřní senzor",
    "DHT11_02": "Venkovní senzor",
}


@app.route('/')
def home_page():
    return render_template('index.html')


@app.route('/api/sensors')
def api_sensors():
    with SqlSensorData() as db:
        ids = db.get_sensor_ids()

    return api_helper.make_api_response(
        api_helper.getQueryDataSensors(),
        [{"id": sensor_id, "name": sensor_map.get(sensor_id, sensor_id)} for sensor_id in ids],
        log=True,                   # loguje tento pozadavek
    )


@app.route('/api/latest/<sensor_id>')
def api_latest(sensor_id):
    with SqlSensorData() as db:
        data = db.get_current(sensor_id)

    return api_helper.make_api_response(
        api_helper.getQueryDataLatest(sensor_id),
        dict(data) if data else {},
        log=True,                   # loguje tento pozadavek
    )


@app.route('/api/aggregate/<sensor_id>/<level>/<key>')
def api_aggregate_level(sensor_id, level, key):
    # vycti timezone informace predane internetovym prohlizecem 
    tz_name = request.args.get('tz')
    tz_offset = request.args.get('tz_offset')
    tzinfo = resolve_tz(tz_name, tz_offset)

    # ziskej data podle pozadovane urovne a vybraného období
    errorCode, errorMessage, result, start_iso, end_iso, group_by = run_aggregate(sensor_id, level, key, tzinfo)
    if errorCode is None:
        # ziskali jsme data pro odpoved
        return api_helper.make_api_response(
            api_helper.getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset, tzinfo, start_iso, end_iso, group_by),
            result,
            log=3,                  # loguje maximalne 3 radky dat ziskanych z DB
        )
    else:
        # nastala nejaka chyba - posli chybu jako odpoved
        return api_helper.make_api_response_error(
            api_helper.getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset, tzinfo, start_iso, end_iso, group_by),
            errorMessage,
            errorCode,
        )


# ---- Actuators API ----
@app.route('/api/actuators/<name>', methods=['GET', 'POST'])
def api_actuator(name):
    """
    Podporovaná jména: led_DHT11_01, led_DHT11_02, relay_DHT11_01, relay_DHT11_02
    GET -> {"on": bool, "hw": bool}
    POST -> JSON {"on": true/false}  (vrací stejné)
    """
    try:
        if request.method == 'GET':
            errorMessage, result = get_actor_state_api(name)
            
            if (result is None):
                # nastala nejaka chyba
                return api_helper.make_api_response_error(
                    api_helper.getQueryDataRelay(request.method),
                    errorMessage,
                    400,
                )

            return api_helper.make_api_response(
                api_helper.getQueryDataLed("GET"), 
                result, 
                log=True,
            )

        # POST - změna stavu
        errorMessage, result = set_actor_state_api(name, request.get_json(force=True))
        
        if (errorMessage is not None):
            # nastala nejaka chyba
            return api_helper.make_api_response_error(
                api_helper.getQueryDataLed(request.method), 
                errorMessage, 
                400
            )

        return api_helper.make_api_response(
            api_helper.getQueryDataLed(request.method),
            result,
            log=True,
        )
    except Exception as ex:
        print("api_actuator - exception ", ex)
        pass


@app.route('/api/actuators/setpoint/<actor_name>', methods=['GET', 'POST'])
def api_actuator_setpoint(actor_name):
    if request.method == 'GET':
        # čteme setpoint z ActuatorManager (pokud implementováno) nebo z fallbacku
        try:
            value = act.get_setpoint(actor_name)
        except Exception as ex:
            return api_helper.make_api_response_error(
                api_helper.getQueryDataSetpoint(request.method),
                str(ex)
            )
        return api_helper.make_api_response(
            api_helper.getQueryDataSetpoint(request.method),
            {"value": value},
            log=True,
        )

    # POST
    try:
        data = request.get_json(force=True)
        v = float(data.get("value"))
        act.set_setpoint(actor_name, v, persist=True)
    except Exception as e:
        return api_helper.make_api_response_error(
            api_helper.getQueryDataSetpoint(request.method),
            str(e),
            500,
        )
    return api_helper.make_api_response(
        api_helper.getQueryDataSetpoint(request.method),
        {"value": v},
        log=True,
    )


@app.route('/api/logs/tail', methods=['GET'])
def api_logs_tail():
    """
    Vrátí posledních LOG_TAIL_LINES řádků z logovacího souboru jako JSON:
    { "lines": ["...","..."] }
    """
    try:
        result = get_logs_data()

        return api_helper.make_api_response(
            api_helper.getQueryLogsTail(),  # použij vhodný query descriptor nebo vytvoř nový
            result,
            log=False,
        )
    except Exception as ex:
        logger.exception("Failed to tail log file: %s", ex)
        return api_helper.make_api_response_error(
            api_helper.getQueryLogsTail(),
            "Failed to read log file",
            500,
        )


def get_actor_state_api(name):
    try:
        state = act.get_actor_state(name)
    except KeyError:
        return "Invalid actuator name", None

    hw_present = act._devices.get(name) is not None

    # pokud jde o relay, pokusíme se dodat i aktuální režim
    result = {"on": state, "hw": hw_present}
    try:
        if name.startswith("relay_"):
            result["mode"] = act.get_relay_mode(name)
    except Exception:
        # potlačíme chybu při čtení režimu, ale necháme základní stav vrátit
        pass

    return None, result

def set_actor_state_api(name, data):
    try:
        mode = data.get("mode")
        if mode is None:
            # pro ledky se nezasila mode
            on = bool(data.get("on"))
        else:
            # pro relay se zasila mode - musime ho ulozit persistentne
            act.set_relay_mode(name, mode, persist=True)
            # prevedeme ho na 'on'
            if mode == 'auto':
                # chovej se jako termostat (to ale nemuze byt vyhodnoceno zde - nech to na tride Thermostat)
                on = None
            else:
                on = (mode == 'on')

    except Exception as e:
        return str(e), None

    if on is not None:
        try:
            ok = act.set_actor(name, on)
        except KeyError as e:
            return str(e), None       
        print('      Zmena stavu:', data, data.get("on"), on, name, ok)
    
    hw_present = act._devices.get(name) is not None
    
    return None, {"on": act.get_actor_state(name), "hw": hw_present}    


# počet řádků, které endpoint vrátí
LOG_TAIL_LINES = 200
def get_logs_data():
    if not Path(LOG_FILE).exists():
        return {"lines": [], "info": "Log file not found"},

    # čteme z konce souboru efektivněji: přečteme v blocích od konce
    lines = []
    with Path(LOG_FILE).open('rb') as f:
        f.seek(0, 2)
        filesize = f.tell()
        block_size = 1024
        data = b''
        blocks = -1
        while len(lines) <= LOG_TAIL_LINES and filesize > 0:
            if (filesize - block_size) > 0:
                f.seek(blocks * block_size, 2)
                chunk = f.read(block_size)
            else:
                f.seek(0, 0)
                chunk = f.read(filesize)
            data = chunk + data
            lines = data.splitlines()
            filesize -= block_size
            blocks -= 1
            if filesize <= 0:
                break

    # dekódovat a vybrat posledních LOG_TAIL_LINES
    decoded = []
    for b in lines[-LOG_TAIL_LINES:]:
        try:
            decoded.append(b.decode('utf-8', errors='replace'))
        except Exception:
            decoded.append(b.decode('latin-1', errors='replace'))

    return {"lines": decoded}
    


if __name__ == "__main__":
    logger.info("Run app")

    act = ActuatorManager()
    act.init_if_needed()
    
    thermostat = Thermostat(act, interval=5, hysteresis=1.0)
    thermostat.start()

    try:
#        app.run(debug=True, use_reloader=False)
        app.run(debug=False)
    finally:
        thermostat.stop()
        act.close_all()
