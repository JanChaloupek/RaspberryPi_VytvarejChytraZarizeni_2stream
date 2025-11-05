// static/js/logs.js
const API_LOG_TAIL = '/api/logs/tail';
const TAIL_LINES = 200;
const AUTO_INTERVAL_MS = 5000;

function qs(id){ return document.getElementById(id); }

async function fetchLogTail() {
  const res = await fetch(API_LOG_TAIL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const payload = await res.json();
  // expected payload.result.lines or payload.lines depending on your api helper
  // try both
  const lines = (payload && (payload.result && payload.result.lines)) || (payload && payload.lines) || [];
  return Array.isArray(lines) ? lines : [];
}

function renderLines(lines) {
  const pre = qs('logs-pre');
  if (!pre) return;
  pre.textContent = lines.join('\n');
  // scroll to bottom
  pre.parentElement.scrollTop = pre.parentElement.scrollHeight;
}

function setStatus(text) {
  const s = qs('logs-status');
  if (s) s.textContent = text || '';
}

export function initLogs() {
  const btn = qs('logs-refresh');
  const auto = qs('logs-autorefresh');

  let timer = null;

  async function doFetch() {
    setStatus('Načítám…');
    try {
      const lines = await fetchLogTail();
      renderLines(lines);
      setStatus(`Posledních ${lines.length} řádků`);
    } catch (err) {
      console.error('Failed to fetch logs', err);
      setStatus('Chyba při načítání logu');
    }
  }

  btn?.addEventListener('click', doFetch);

  auto?.addEventListener('change', (ev) => {
    if (ev.target.checked) {
      doFetch();
      timer = setInterval(doFetch, AUTO_INTERVAL_MS);
    } else {
      if (timer) { clearInterval(timer); timer = null; }
    }
  });

  // initial load
  doFetch();
}

// auto-initialize if module is loaded
document.addEventListener('DOMContentLoaded', initLogs);
