from flask import Flask, render_template, jsonify
from db import SqlSensorData

app = Flask(__name__)

@app.route('/')
def home_page():
    return render_template('index.html')

@app.route('/api/sensors')
def api_sensors():
    with SqlSensorData() as db:
        ids = db.get_sensor_ids()

    # Dočasné názvy podle ID
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

@app.route('/api/aggregated/<sensor_id>')
def api_aggregated(sensor_id):
    with SqlSensorData() as db:
        data = db.get_hourly_aggregated(sensor_id)
    return jsonify([dict(row) for row in data])

if __name__ == '__main__':
    app.run(debug=True)
