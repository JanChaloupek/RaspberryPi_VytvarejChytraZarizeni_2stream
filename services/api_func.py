from pathlib import Path
from actuators import ActuatorManager
import logging

logger = logging.getLogger("api")


def api_read_actor_state(act: ActuatorManager, actor_name: str):
    try:
        state = act.get_actor_state(actor_name)
    except KeyError:
        return 404, "Invalid actuator name", None

    hw_present = act._devices.get(actor_name) is not None

    # pokud jde o relay, pokusíme se dodat i aktuální režim
    result = {"on": state, "hw": hw_present}
    try:
        if actor_name.startswith("relay_"):
            result["mode"] = act.get_relay_mode(actor_name)
    except Exception:
        # potlačíme chybu při čtení režimu, ale necháme základní stav vrátit
        pass

    return None, None, result

def api_write_actor_state(act: ActuatorManager, actor_name: str, request):
    try:
        data = request.get_json(force=True)        
        mode = data.get("mode")
        if mode is None:
            on = bool(data.get("on"))
        else:
            act.set_relay_mode(actor_name, mode, persist=True)
            on = None if mode == 'auto' else (mode == 'on')
    except Exception as e:
        return 404, str(e), None

    if on is not None:
        try:
            ok = act.set_actor(actor_name, on)
        except KeyError as e:
            return 404, str(e), None       
        logger.info("Změna stavu: %s (on=%s, actor=%s, ok=%s)", data, on, actor_name, ok)
    
    return api_read_actor_state(act, actor_name)


def api_read_setpoint(act: ActuatorManager, actor_name):
    # čteme setpoint z ActuatorManager (pokud implementováno) nebo z fallbacku
    try:
        value = act.get_setpoint(actor_name)
    except Exception as ex:
        return 500, str(ex), None
    return None, None, {"value": value}

def api_write_setpoint(act: ActuatorManager, actor_name, request):
    try:
        data = request.get_json(force=True)
        new_value = float(data.get("value"))
        act.set_setpoint(actor_name, new_value, persist=True)
    except Exception as e:
        return 500, str(e), None
    
    return api_read_setpoint(act, actor_name)  

def get_logs_data(LOG_FILE: str, max_lines_count: int):
    if not Path(LOG_FILE).exists():
        return {"lines": [], "info": "Log file not found"}

    # čteme z konce souboru efektivněji: přečteme v blocích od konce
    lines = []
    with Path(LOG_FILE).open('rb') as f:
        f.seek(0, 2)
        filesize = f.tell()
        block_size = 1024
        data = b''
        blocks = -1
        while len(lines) <= max_lines_count and filesize > 0:
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

    decoded = []
    for b in lines[-max_lines_count:]:
        try:
            decoded.append(b.decode('utf-8', errors='replace'))
        except Exception:
            decoded.append(b.decode('latin-1', errors='replace'))

    return {"lines": decoded}

def api_get_logs(LOG_FILE: str, max_lines_count: int):
    """
    Vrátí posledních x řádků z logovacího souboru jako JSON:
    { "lines": ["...","..."] }
    """
    try:
        result = get_logs_data(LOG_FILE, max_lines_count)
        return None, None, result
    except Exception as ex:
        logger.exception("Failed to tail log file: %s", ex)
        return 500, "Failed to read log file", None
