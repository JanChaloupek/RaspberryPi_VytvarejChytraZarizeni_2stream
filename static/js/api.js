// static/js/api.js

let sensorsController = null;
let latestController = null;
let aggregateController = null;

async function fetchJsonWithAbort(url, which = 'default') {
  console.debug(`[api] fetch start (${which}):`, url);
  // choose controller per logical request type
  let controllerRef;
  if (which === 'sensors') {
    if (sensorsController) {
      console.debug('[api] aborting previous sensors request');
      try { sensorsController.abort(); } catch(e){}
    }
    sensorsController = new AbortController();
    controllerRef = sensorsController;
  } else if (which === 'latest') {
    if (latestController) {
      console.debug('[api] aborting previous latest request');
      try { latestController.abort(); } catch(e){}
    }
    latestController = new AbortController();
    controllerRef = latestController;
  } else if (which === 'aggregate') {
    if (aggregateController) {
      console.debug('[api] aborting previous aggregate request');
      try { aggregateController.abort(); } catch(e){}
    }
    aggregateController = new AbortController();
    controllerRef = aggregateController;
  } else {
    controllerRef = new AbortController();
  }

  try {
    const res = await fetch(url, { signal: controllerRef.signal });
    console.debug(`[api] fetch response (${which}):`, url, res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error(`[api] non-ok response (${which}) ${res.status} for ${url}:`, text);
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const json = await res.json();
    console.debug(`[api] fetch json (${which}) for ${url}:`, json);
    return json;
  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`[api] fetch aborted (${which}):`, url);
      throw err;
    }
    console.error(`[api] fetch failed (${which}) for ${url}:`, err);
    throw err;
  }
}

export async function getSensors() {
  const data = await fetchJsonWithAbort('/api/sensors', 'sensors');
  return data.result;
}

export async function getLatest(sensorId) {
  const url = `/api/latest/${encodeURIComponent(sensorId)}`;
  const data = await fetchJsonWithAbort(url, 'latest');
  // log the exact sensor requested and what came back
  console.debug('[api] getLatest: requested sensor=', sensorId, 'response.query?', data.query || null, 'result=', data.result);
  return data.result;
}

export async function getAggregate(sensorId, level, key, tzName = null, tzOffset = null) {
  const qs = new URLSearchParams();
  if (tzName) qs.set('tz', tzName);
  if (tzOffset) qs.set('tz_offset', tzOffset);
  const url = `/api/aggregate/${encodeURIComponent(sensorId)}/${encodeURIComponent(level)}/${encodeURIComponent(key)}?${qs.toString()}`;
  console.debug('[api] getAggregate URL:', url);
  return fetchJsonWithAbort(url, 'aggregate');
}
