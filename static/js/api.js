// api.js - jednoduché fetch wrappery pro sensors, latest a aggregate

function fetchSensors() {
  return fetch('/api/sensors').then(r => {
    if (!r.ok) throw new Error('fetchSensors failed ' + r.status);
    return r.json();
  });
}

function fetchLatest(sensor_id) {
  return fetch(`/api/latest/${encodeURIComponent(sensor_id)}`)
    .then(r => {
      if (!r.ok) throw new Error('fetchLatest failed ' + r.status);
      return r.json();
    });
}

// fetchAggregate: posílat vždy local key + tz metadata
function fetchAggregate(sensor_id, level, key) {
  const tzInfo = getClientTzParams();
  const params = new URLSearchParams();
  if (tzInfo.tz) params.set('tz', tzInfo.tz);
  if (typeof tzInfo.offset !== 'undefined' && tzInfo.offset !== null) params.set('tz_offset', String(tzInfo.offset));

  // key by měl být v lokálním formátu (YYYY, YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH, YYYY-MM-DDTHH:MM)
  let keyToSend = key;
  try {
    keyToSend = normalizeLocalKeyForApi(level, key);
  } catch (e) {
    console.warn('[fetchAggregate] normalizeLocalKeyForApi failed', e);
    keyToSend = key;
  }

  const url = `/api/aggregate/${encodeURIComponent(sensor_id)}/${encodeURIComponent(level)}/${encodeURIComponent(keyToSend)}?${params.toString()}`;
  console.debug('[fetchAggregate] url=', url, 'sentKey=', keyToSend, 'origKey=', key, 'tzInfo=', tzInfo);
  return fetch(url).then(r => {
    if (!r.ok) throw new Error('fetchAggregate failed ' + r.status);
    return r.json();
  });
}
