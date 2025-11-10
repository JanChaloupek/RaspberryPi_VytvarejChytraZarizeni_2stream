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
from actuators import ActuatorManager
from services.time_utils import resolve_tz
from services.aggregate_service import api_aggregate
from services.api_helper import make_api_response, make_api_response_error, getQueryDataSensors, getQueryDataLatest, getQueryDataAggregate, getQueryLogsTail, getQueryDataSetpoint
from services.api_func import api_get_logs, api_read_actor_state, api_write_actor_state, api_read_setpoint, api_write_setpoint
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
    return render_template("index.html", role=session.get("role"))


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
            return render_template('login/login.html', username=username)

    # GET
    return render_template('login/login.html', username='')


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

    return make_api_response(
        getQueryDataLatest(sensor_id),
        dict(data) if data else {},
        log=True,                   # loguje tento pozadavek
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


# ---- Actuators API ----
@app.route('/api/actuators/<actor_name>', methods=['GET', 'POST'])
@login_required
def api_actuator(actor_name):
    """
    Podporovaná jména: led_DHT11_01, led_DHT11_02, relay_DHT11_01, relay_DHT11_02
    GET: {"on": bool, "hw": bool}
    POST: {"on": bool} -> {"on": bool, "hw": bool}
    """
    query = getQueryDataSetpoint(request.method, actor_name)
    if request.method == 'GET':
        errCode, errMessage, result = api_read_actor_state(act, actor_name)
        if errCode is not None:
            # nastala chyba -> zamitava odpoved
            return make_api_response_error(query, errMessage, errCode)

        # vracim odpoved        
        return make_api_response(query, result, log=True)

    # POST
    if not is_admin():                      # over prava admina
        return adminNeeded_response(query)  # pokud je nemas, odpovez ze je potrebujes

    errCode, errMessage, result = api_write_actor_state(act, actor_name, request)
    if errCode is not None:
        # nastala chyba -> zamitava odpoved
        return make_api_response_error(query, errMessage, errCode)

    # vracim odpoved
    return make_api_response(query, result, log=True)


@app.route('/api/actuators/<actor_name>/setpoint', methods=['GET', 'POST'])
@login_required
def api_actuator_setpoint(actor_name):
    """
    Podporovaná jména: relay_DHT11_01, relay_DHT11_02
    GET: {"value": value}
    POST: {"value": value} -> {"value": value}
    """
    query = getQueryDataSetpoint(request.method, actor_name)
    if request.method == 'GET':
        errCode, errMessage, result = api_read_setpoint(act, actor_name)
        if errCode is not None:
            # nastala chyba -> zamitava odpoved
            return make_api_response_error(query, errMessage, errCode)

        # vracim odpoved        
        return make_api_response(query, result, log=True)

    # POST
    if not is_admin():                      # over prava admina
        return adminNeeded_response(query)  # pokud je nemas, odpovez ze je potrebujes

    errCode, errMessage, result = api_write_setpoint(act, actor_name, request)
    if errCode is not None:
        # nastala chyba -> zamitava odpoved
        return make_api_response_error(query, errMessage, errCode)

    # vracim odpoved
    return make_api_response(query, result, log=True)


@app.route('/api/logs/tail', methods=['GET'])
@login_required
def api_logs_tail():
    query = getQueryLogsTail()
    
    if not is_admin():                      # over prava admina
        return adminNeeded_response(query)  # pokud je nemas, odpovez ze je potrebujes

    errCode, errMessage, result = api_get_logs(LOG_FILE, 200)
    if errCode is not None:
        # nastala chyba -> zamitava odpoved
        return make_api_response_error(query, errMessage, errCode)
    # vracim odpoved
    return make_api_response(query, result, log=True)



if __name__ == "__main__":
    logger.info("Run app")

    act = ActuatorManager()
    act.init_if_needed()
    
    thermostat = Thermostat(act, interval=5, hysteresis=1.0)
    thermostat.start()

    try:
        app.run(debug=True, use_reloader=False)
#        app.run(debug=False)
    finally:
        thermostat.stop()
        act.close_all()
