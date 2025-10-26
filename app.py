from flask import Flask, render_template, jsonify, request
from services.aggregate_service import AggregateService
from db import SqlSensorData

app = Flask(__name__)
aggregate_service = AggregateService(SqlSensorData)

@app.route('/')
def home_page():
    return render_template('index.html')

@app.route('/api/sensors')
def api_sensors():
    with SqlSensorData() as db:
        ids = db.get_sensor_ids()

    name_map = {
        "DHT11_01": "Vnitřní senzor",
        "DHT11_02": "Venkovní senzor",
        "DHT11_03": "Sklep",
        "DHT11_04": "Serverovna"
    }

    sensors = [{"id": sensor_id, "name": name_map.get(sensor_id, sensor_id)} for sensor_id in ids]
    return jsonify(sensors)

@app.route('/api/latest/<sensor_id>')
def api_latest(sensor_id):
    with SqlSensorData() as db:
        data = db.get_current(sensor_id)
    return jsonify(dict(data) if data else {})

@app.route('/api/aggregate/<sensor_id>/<level>/<key>')
def api_aggregate_level(sensor_id, level, key):
    tz_name = request.args.get('tz')
    tz_offset = request.args.get('tz_offset')

    try:
        result = aggregate_service.handle_aggregate(sensor_id, level, key, tz_name, tz_offset)
        return jsonify(result)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
