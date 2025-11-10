// static/js/refresh.js
import { loadLatest } from './latest.js';
import { loadAggregate } from './aggregate.js';
import { currentSensor } from './sensors.js';

const AUTO_REFRESH_MS = 10_000;
let __autoRefreshId = null;
let __isRefreshing = false;

async function callAppRefresh() {
  if (__isRefreshing) return true;
  if (!currentSensor) return false;
  __isRefreshing = true;
  try {
    await loadLatest();
    await loadAggregate();
    return true;
  } catch (e) {
    console.error('Auto-refresh error', e);
    return true;
  } finally {
    __isRefreshing = false;
  }
}

export function startAutoRefresh() {
  if (__autoRefreshId !== null) return;
  callAppRefresh().catch(console.error);
  __autoRefreshId = setInterval(() => {
    callAppRefresh().then(ok => {
      if (!ok) stopAutoRefresh();
    }).catch(console.error);
  }, AUTO_REFRESH_MS);
}

export function stopAutoRefresh() {
  if (__autoRefreshId !== null) {
    clearInterval(__autoRefreshId);
    __autoRefreshId = null;
  }
}
