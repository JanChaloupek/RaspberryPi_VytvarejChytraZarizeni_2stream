# app.py
from logger_config import configure_logging
import logging
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent  # adresář hlavního souboru
LOG_FILE = BASE_DIR / "app.log"

# konfigurace pro celý projekt (root logger)
configure_logging(log_file=LOG_FILE, level=logging.DEBUG, console=True)
logger = logging.getLogger("web")

import os
from typing import Optional
from db import SqlSensorData
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from thermostat import Thermostat
from actuators.manager import ActuatorManager
from services.time_utils import resolve_tz
from services.aggregate_service import api_aggregate, compute_dew_point
from services.api_utils import make_api_response, make_api_response_error, getQueryDataSensors, getQueryDataLatest, getQueryDataAggregate, getQueryLogsTail, getQueryLed, getQueryRelay, getQueryRelaySetpoint
from services.api_actuators import api_get_logs, api_read_led, api_write_led, api_read_relay, api_write_relay, api_read_setpoint, api_write_setpoint
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user
from werkzeug.security import generate_password_hash, check_password_hash


act: Optional[ActuatorManager] = None
app = Flask(__name__)


# Secret key pro session (čti z env v produkci)
app.secret_key = os.environ.get('FLASK_SECRET_KEY', 'naprosto_tajny_klic')


# --- Flask-Login setup ---
login_manager = LoginManager()
login_manager.init_app(app)

# kde přesměrovat nepřihlášené uživatele
login_manager.login_view = 'login'
login_manager.login_message = "Pro pokračování se prosím přihlašte."

# uživatelé s hesly a rolemi (v produkci vycist z DB - chtělo by to rozhrani pro administraci uzivatelu)
pwAdmin = "scrypt:32768:8:1$xAOzlgCDaorrbonm$2922c20d47f900f10fdaf6fc4a7e39debb4061cfb6daa24422520888f45441d0613c52f03d59e64f5848cc53fe73ff0bffb1fc2574f3cd8fc68346441fe36de9"
pwUser  = "scrypt:32768:8:1$q8R2Sf4a97wDA3hR$c53a71de46c6104fc81f8f1cb33f3d946da2779b18ef408e063a70c7f6570a588b35850d3fddf52bf5515785ec766e70ab95761ef13e546d977cf795c5cdecba"

_users = {
    "admin": {"password": pwAdmin, "role": "admin"},
    "user": {"password": pwUser, "role": "user"},
}

class User(UserMixin):
    def __init__(self, username):
        self.id = username

@login_manager.user_loader
def load_user(user_id):
    if user_id in _users:
        return User(user_id)
    return None


def is_admin():
    """
    Otestuj jestli prihlaseny uzivatel ma prava spravce
    
    Returns:
        bool: uzivatel ma prava spravce
    """
    return (session.get("role") == "admin")
        
def adminNeeded_response(query):
    """
    Vraci zamitavou odpoved pokud jsou prava spravcce vyzadovana

    Args:
        query (json): parametry pozadavku

    Returns:
        result: zamitaci text 
        code: http code 403 (forbidden)
    """
    return make_api_response_error(
        query,
        "Přístup zamítnut – požadují se práva administrátora",
        403,
    )
    


sensor_map = {
    "DHT11_01": "Vnitřní senzor",
    "DHT11_02": "Venkovní senzor",
    "DHT11_03": "další který nemám",
}

@app.context_processor
def inject_assets():
    """
    Injects required variables for HTTP render.

    Returns:
        dict: variables for the rendering engine
    """
    static_path = app.static_folder

    def find_favicon(name):
        for ext in ['ico', 'png', 'svg']:
            filename = os.path.join('img', f'{name}.{ext}')
            full_path = os.path.join(static_path, filename)
            if os.path.exists(full_path):
                return filename
        return None

    return {
        "favicon_light": find_favicon("favicon"),
        "favicon_dark": find_favicon("favicon-dark"),
    }
@app.route("/")
@login_required
def home_page():
    return render_template("index.jinja", role=session.get("role"))


@app.route('/api/me')
@login_required
def api_me():
    user_info = {
        "username": session.get("username"),
        "role": session.get("role"),
    }
    return jsonify(user_info)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        user_rec = _users.get(username)
        if user_rec and check_password_hash(user_rec["password"], password):
            user = User(username)
            login_user(user)
            flash("Přihlášení proběhlo úspěšně.", "success")
            session["username"] = username
            session["role"] = user_rec["role"]
            next_page = request.args.get('next') or url_for('home_page')
            return redirect(next_page)
        else:
            flash("Neplatné uživatelské jméno nebo heslo.", "danger")
            return render_template('login.jinja', username=username)

    # GET
    return render_template('login.jinja', username='')


@app.route('/logout', methods=['GET', 'POST'])
@app.route('/logoff', methods=['GET', 'POST'])
@login_required
def logout():
    session.clear()
    logout_user()
    flash("Byl(a) jste odhlášen(a).", "info")
    next_page = request.form.get('next') or url_for('login')
    return redirect(next_page)


@app.route('/api/sensors')
@login_required
def api_sensors():
    with SqlSensorData() as db:
        ids = db.get_sensor_ids()

    query = getQueryDataSensors()
    response = [{"id": sensor_id, "name": sensor_map.get(sensor_id, sensor_id)} for sensor_id in ids]
    return make_api_response(query, response, log=True)


@app.route('/api/latest/<sensor_id>')
@login_required
def api_latest(sensor_id):
    with SqlSensorData() as db:
        data = db.get_current(sensor_id)

    if data:
        d = dict(data)
        d["dew_point"] = compute_dew_point(d.get("temperature"), d.get("humidity"))
    else:
        d = {}

    return make_api_response(
        getQueryDataLatest(sensor_id),
        d,
        log=True,
    )


@app.route('/api/aggregate/<sensor_id>/<level>/<key>')
@login_required
def api_aggregate_level(sensor_id, level, key):
    # vycti timezone informace predane internetovym prohlizecem 
    tz_name = request.args.get('tz')
    tz_offset = request.args.get('tz_offset')
    tzinfo = resolve_tz(tz_name, tz_offset)
    # ziskej data podle pozadovane urovne a vybraného období
    errorCode, errorMessage, result, start_iso, end_iso, group_by = api_aggregate(sensor_id, level, key, tzinfo)
    print("Aggregate", sensor_id, level, key, start_iso, end_iso, group_by)
    query = getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset, tzinfo, start_iso, end_iso, group_by)
    if errorCode is not None:
        # nastala chyba -> zamitava odpoved
        return make_api_response_error(query, errorMessage, errorCode)

    # vracim odpoved
    return make_api_response(query, result, log=True)        # loguje maximalne 3 radky dat ziskanych z DB


@app.route('/api/actuator/<sensor_id>/led', methods=['GET', 'POST'])
@login_required
def api_led(sensor_id):
    query = getQueryLed(sensor_id, request.method)

    if request.method == 'GET':
        return api_read_led(act, sensor_id, query)

    # POST    
    if not is_admin():
        return adminNeeded_response(query)

    return api_write_led(act, sensor_id, request, query)

@app.route('/api/actuator/<sensor_id>/relay', methods=['GET', 'POST'])
@login_required
def api_relay(sensor_id):
    query = getQueryRelay(sensor_id, request.method)
    
    if request.method == 'GET':
        return api_read_relay(act, sensor_id, query)

    # POST    
    if not is_admin():
        return adminNeeded_response(query)

    return api_write_relay(act, sensor_id, request, query)


@app.route('/api/actuator/<sensor_id>/relay/setpoint', methods=['GET', 'POST'])
@login_required
def api_relay_setpoint(sensor_id):
    query = getQueryRelaySetpoint(sensor_id, request.method)
    
    if request.method == 'GET':
        return api_read_setpoint(act, sensor_id, query)

    # POST    
    if not is_admin():
        return adminNeeded_response(query)
    
    return api_write_setpoint(act, sensor_id, request, query)


@app.route('/api/logs/tail', methods=['GET'])
@login_required
def api_logs_tail():
    query = getQueryLogsTail()
    
    if not is_admin():                      # over prava admina
        return adminNeeded_response(query)  # pokud je nemas, odpovez ze je potrebujes

    return api_get_logs(LOG_FILE, 200)


@app.route("/styleguide")
def styleguide():
    if not is_admin():
        return adminNeeded_response({})

    return render_template("styleguide.jinja")


import signal
import sys

if __name__ == "__main__":
    logger.info("Run app")

    # Definice senzorů a jejich HW pinů (pokud nejsou, fungují virtuálně)
    sensors_config = {
        "DHT11_01": {"led_pin": 18, "relay_pin": 23},
        "DHT11_02": {"led_pin": 12, "relay_pin": 24},
    }
    
    # Inicializace ActuatorManageru s konfigurací senzorů
    act = ActuatorManager(sensors=sensors_config)

    # Spuštění termostatu – periodicky kontroluje teploty z DB
    thermostat = Thermostat(act, interval=5, hysteresis=1.0)
    thermostat.start()

    # --- Signal handler pro čisté ukončení ---
    def handle_sig(signum, frame):
        logger.info(f"Shutting down (signal {signum})...")
        thermostat.stop()
        act.close_all()
        sys.exit(0)

    # registrace handlerů
    signal.signal(signal.SIGINT, handle_sig)   # Ctrl+C
    signal.signal(signal.SIGTERM, handle_sig)  # kill

    try:
        # Flask aplikace
        app.run(debug=True, use_reloader=False)
        # app.run(debug=False)   # produkční režim
    except Exception as e:
        logger.exception("App crashed: %s", e)
    finally:
        # fallback – pokud se dostaneme sem, zavři zařízení
        thermostat.stop()
        act.close_all()
