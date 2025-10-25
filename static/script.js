function formatTime(utc) {
    if (!utc) return '--';
    const local = new Date(utc.endsWith('Z') ? utc : utc + 'Z');
    return isNaN(local.getTime()) ? '--' : local.toLocaleString();
}

function getColor(value, max) {
    const ratio = value / max;
    if (ratio < 0.33) return '#4caf50';
    if (ratio < 0.66) return '#ffeb3b';
    return '#f44336';
}

function setSemiGaugeArc(id, value, max) {
    const percent = Math.min(value / max, 1);
    const arc = document.getElementById(id);
    const arcLength = arc.getTotalLength();
    const offset = arcLength * (1 - percent);

    arc.setAttribute("stroke-dasharray", arcLength);
    arc.setAttribute("stroke-dashoffset", offset);
    arc.style.stroke = getColor(value, max);

    console.log(`[setSemiGaugeArc] ${id}: value=${value}, offset=${offset.toFixed(1)}, arcLength=${arcLength.toFixed(1)}`);
}

function updateLatest(sensor_id) {
    console.log(`[updateLatest] Volám /api/latest/${sensor_id}`);
    fetch(`/api/latest/${sensor_id}`)
        .then(res => res.json())
        .then(data => {
            console.log("[updateLatest] Data z API:", data);
            const temp = parseFloat(data.temperature);
            const hum = parseFloat(data.humidity);
            document.getElementById('temperature').textContent = isNaN(temp) ? '--' : temp.toFixed(1);
            document.getElementById('humidity').textContent = isNaN(hum) ? '--' : hum.toFixed(1);
            document.getElementById('timestamp').textContent = data.timestamp ? formatTime(data.timestamp) : '--';

            if (!isNaN(temp)) setSemiGaugeArc('tempArc', temp, 50);
            if (!isNaN(hum)) setSemiGaugeArc('humArc', hum, 100);
        })
        .catch(err => console.error("[updateLatest] Chyba:", err));
}

function updateAggregated(sensor_id) {
    console.log(`[updateAggregated] Volám /api/aggregated/${sensor_id}`);
    fetch(`/api/aggregated/${sensor_id}`)
        .then(res => res.json())
        .then(data => {
            console.log("[updateAggregated] Data z API:", data);
            const tbody = document.getElementById('agg_table');
            tbody.innerHTML = '';
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatTime(row.hour)}</td>
                    <td>${parseFloat(row.avg_temp).toFixed(1)}</td>
                    <td>${parseFloat(row.avg_hum).toFixed(1)}</td>
                    <td>${row.count}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => console.error("[updateAggregated] Chyba:", err));
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("[DOMContentLoaded] DOM je připraven");
    const sensorSelect = document.getElementById("sensor_select");

    function updateAll(sensor_id = null) {
        const id = sensor_id || sensorSelect.value;
        if (!id || id === "undefined") {
            console.warn("[updateAll] Chybí platný sensor_id");
            return;
        }
        console.log(`[updateAll] Aktualizuji data pro sensor_id: ${id}`);
        updateLatest(id);
        updateAggregated(id);
    }

    function loadSensors() {
        console.log("[loadSensors] Načítám senzory...");
        fetch("/api/sensors")
            .then(res => res.json())
            .then(sensors => {
                console.log("[loadSensors] Načteno:", sensors);
                sensorSelect.innerHTML = "";
                sensors.forEach(sensor => {
                    const option = document.createElement("option");
                    option.value = sensor.id;
                    option.textContent = sensor.name;
                    sensorSelect.appendChild(option);
                });

                const lastSensor = localStorage.getItem("lastSensor");
                console.log("[loadSensors] Poslední senzor z localStorage:", lastSensor);
                const validSensor = sensors.find(s => s.id === lastSensor);
                const defaultSensor = validSensor ? validSensor.id : sensors[0]?.id;

                if (defaultSensor) {
                    console.log("[loadSensors] Používám defaultSensor:", defaultSensor);
                    sensorSelect.value = defaultSensor;
                    updateAll(defaultSensor);
                } else {
                    console.warn("[loadSensors] Žádný dostupný senzor");
                }
            })
            .catch(err => console.error("[loadSensors] Chyba:", err));
    }

    sensorSelect.addEventListener("change", () => {
        const selected = sensorSelect.value;
        console.log("[change] Vybrán senzor:", selected);
        localStorage.setItem("lastSensor", selected);
        updateAll(selected);
    });

    loadSensors();

    setInterval(() => {
        const selected = sensorSelect.value;
        console.log("[interval] Refresh pro senzor:", selected);
        if (selected) updateAll(selected);
    }, 5000);
});
