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
_users = {
    "admin": {"password": "heslo357", "role": "admin"},
    "user": {"password": "heslo", "role": "user"},
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
    Vlozi potrebne promenne pro http render

    Returns:
        json: promenne do vykreslovaciho enginu
    """
    static_path = app.static_folder

    # favicon
    favicon_filename = None
    for ext in ['ico', 'png', 'svg']:
        filename = f'favicon.{ext}'
        full_path = os.path.join(static_path, filename)
        if os.path.exists(full_path):
            favicon_filename = filename
            break

    return {
        "favicon_filename": favicon_filename,
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
    # jednoduchý login
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        user_rec = _users.get(username)
        if user_rec and password == user_rec.get('password'):
            user = User(username)
            login_user(user)
            flash("Přihlášení proběhlo úspěšně.", "success")
            session["username"] = username
            session["role"] = user_rec["role"]
            # přesměrování na původně požadovanou stránku
            next_page = request.args.get('next') or url_for('home_page')
            return redirect(next_page)
        else:
            flash("Neplatné uživatelské jméno nebo heslo.", "danger")
            return render_template('login/login.jinja', username=username)

    # GET
    return render_template('login/login.jinja', username='')


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
    query = getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset, tzinfo, start_iso, end_iso, group_by)
    if errorCode is not None:
        # nastala chyba -> zamitava odpoved
        return make_api_response_error(query, errorMessage, errorCode)

    # vracim odpoved        
    return make_api_response(query, result, log=3)        # loguje maximalne 3 radky dat ziskanych z DB


@app.route('/api/actuator/<sensor_id>/led', methods=['GET', 'POST'])
@login_required
def api_led(sensor_id):
    print("/api/actuator/<sensor_id>/led - 1", sensor_id)
    query = getQueryLed(sensor_id, request.method)
    print("/api/actuator/<sensor_id>/led - 2", query, request.method)

    if request.method == 'GET':
        print("/api/actuator/<sensor_id>/led - 3 GET")
        return api_read_led(act, sensor_id, query)

    # POST    
    if not is_admin():
        return adminNeeded_response(query)

    print("/api/actuator/<sensor_id>/led - 3 PUT")
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
