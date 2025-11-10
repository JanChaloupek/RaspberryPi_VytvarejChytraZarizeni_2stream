// static/js/latest.js
import { getLatest } from './api.js';
import { setGaugeValue } from './gauges.js';
import { updateSnapshotFromIso } from './snapshot.js';
import { currentSensor } from './sensors.js';

export async function loadLatest() {
  if (!currentSensor) return;
  const sensorAtCall = currentSensor;
  try {
    const latest = await getLatest(sensorAtCall);
    if (currentSensor !== sensorAtCall) return;

    if (!latest || Object.keys(latest).length === 0) {
      setGaugeValue('tempArc', 'temperature', null);
      setGaugeValue('humArc', 'humidity', null);
      return;
    }

    let tsRaw = String(latest.timestamp || '').replace(' ', 'T');
    const tsIso = /Z|[+\-]\d{2}:\d{2}$/.test(tsRaw) ? tsRaw : (tsRaw + 'Z');
    updateSnapshotFromIso(tsIso);

    const tempVal = Number(latest.temperature);
    const humVal = Number(latest.humidity);

    setGaugeValue('tempArc', 'temperature', Number.isFinite(tempVal) ? tempVal : null, -20, 50);
    setGaugeValue('humArc', 'humidity', Number.isFinite(humVal) ? humVal : null, 0, 100);
  } catch (e) {
    console.error('Failed to load latest', e);
    setGaugeValue('tempArc', 'temperature', null);
    setGaugeValue('humArc', 'humidity', null);
  }
}
