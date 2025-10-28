# app.py (fragment)
from flask import Flask, render_template, request
from db import SqlSensorData
from services.aggregate_service import handle_aggregate
from services.time_utils import resolve_tz, parse_local_key_to_range
import api_utils

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

    return api_utils.make_api_response(
        api_utils.getQueryDataSensors(), 
        [{"id": sensor_id, "name": sensor_map.get(sensor_id, sensor_id)} for sensor_id in ids],
        log=True
    )

@app.route('/api/latest/<sensor_id>')
def api_latest(sensor_id):
    with SqlSensorData() as db:
        data = db.get_current(sensor_id)

    return api_utils.make_api_response(
        api_utils.getQueryDataLatest(sensor_id), 
        dict(data) if data else {},
        log=True,
    )

@app.route('/api/aggregate/<sensor_id>/<level>/<key>')
def api_aggregate_level(sensor_id, level, key):
    tz_name = request.args.get('tz')
    tz_offset = request.args.get('tz_offset')

    if level not in ('monthly', 'daily', 'hourly', 'minutely', 'raw'):
        return api_utils.make_api_response_error(
            api_utils.getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset),
            "Unsupported level",
            400,
        )

    tzinfo = resolve_tz(tz_name, tz_offset)
    try:
        start_iso, end_iso, group_by = parse_local_key_to_range(level, key, tzinfo)
    except ValueError as e:
        return api_utils.make_api_response_error(
            api_utils.getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset),
            str(e),
            400,
        )

    try:
        result = handle_aggregate(sensor_id, level, key, tz_name, tz_offset)
        return api_utils.make_api_response(
            api_utils.getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset, tzinfo, start_iso, end_iso, group_by),
            result,
            log=3,
        )
    except ValueError as e:
        return api_utils.make_api_response_error(
            api_utils.getQueryDataAggregate(sensor_id, level, key, tz_name, tz_offset, tzinfo, start_iso, end_iso, group_by),
            str(e),
            500,
        )

if __name__ == '__main__':
    app.run(debug=True)
