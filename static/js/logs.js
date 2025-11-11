// static/js/logs.js
// Modul pro zobrazení posledních řádků logu z backendu.
// ----------------------------------------------------
// Účel:
// - Poskytuje jednoduchý log viewer přímo v UI.
// - Umožňuje ruční i automatické obnovování logu.
// - Zobrazuje stav načítání a počet načtených řádků.
// - Posouvá scroll na konec, aby byl vidět poslední řádek.
//
// Závislosti:
// - Používá pouze nativní DOM API a fetch.
//
// Konfigurace:
// - API_LOG_TAIL = '/api/logs/tail' (endpoint pro získání posledních řádků logu)
// - AUTO_INTERVAL_MS = 5000 ms (interval pro auto-refresh)
//
// Funkce:
// - qs(id) → zkrácená funkce pro získání elementu podle ID.
// - fetchLogTail() → načte poslední řádky logu z API.
// - renderLines(lines) → vykreslí načtené řádky do <pre id="logs-pre">.
// - setStatus(text) → nastaví statusový text do elementu #logs-status.
// - init() → hlavní inicializace log vieweru (binding událostí, auto-refresh).
//
// ----------------------------------------------------

const API_LOG_TAIL = '/api/logs/tail';   // endpoint pro získání posledních řádků logu
const AUTO_INTERVAL_MS = 5000;           // interval pro automatické obnovování (ms)

/**
 * qs(id)
 * ---------------------------------
 * Zkrácená funkce pro získání elementu podle ID.
 *
 * @param {string} id ID elementu
 * @returns {HTMLElement|null} Element nebo null
 */
function qs(id){ return document.getElementById(id); }

/**
 * fetchLogTail()
 * ---------------------------------
 * Načte poslední řádky logu z API.
 * - Volá /api/logs/tail s cache=no-store (aby se vždy načetla čerstvá data).
 * - Ověří HTTP status, pokud není OK → vyhodí chybu.
 * - Vrátí pole řádků (payload.result.lines nebo payload.lines).
 *
 * @returns {Promise<string[]>} Pole řádků logu
 * @throws {Error} Pokud HTTP status není OK
 */
async function fetchLogTail() {
  const res = await fetch(API_LOG_TAIL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const payload = await res.json();
  const lines = (payload?.result?.lines) || payload?.lines || [];
  return Array.isArray(lines) ? lines : [];
}

/**
 * renderLines(lines)
 * ---------------------------------
 * Vykreslí načtené řádky logu do <pre id="logs-pre">.
 * - Nastaví textContent na spojení řádků.
 * - Posune scroll parent elementu na konec (aby byl vidět poslední řádek).
 *
 * @param {string[]} lines Pole řádků logu
 */
function renderLines(lines) {
  const pre = qs('logs-pre');
  if (!pre) return;
  pre.textContent = lines.join('\n');
  pre.parentElement.scrollTop = pre.parentElement.scrollHeight;
}

/**
 * setStatus(text)
 * ---------------------------------
 * Nastaví statusový text do elementu #logs-status.
 * - Používá se pro zobrazení stavu (Načítám…, Chyba, počet řádků).
 *
 * @param {string} text Text statusu
 */
function setStatus(text) {
  const s = qs('logs-status');
  if (s) s.textContent = text || '';
}

/**
 * init()
 * ---------------------------------
 * Inicializuje log viewer.
 * - Najde tlačítko pro ruční refresh (#logs-refresh).
 * - Najde checkbox pro auto-refresh (#logs-autorefresh).
 * - Definuje funkci doFetch() pro načtení logu:
 *    - Nastaví status "Načítám…"
 *    - Zavolá fetchLogTail() a vykreslí řádky
 *    - Nastaví status na "Posledních N řádků"
 *    - Při chybě zaloguje error a nastaví status "Chyba při načítání logu"
 * - Připojí listener na tlačítko (ruční refresh).
 * - Připojí listener na checkbox (zapnutí/vypnutí auto-refresh).
 *    - Pokud je zapnutý, spustí interval každých 5s.
 *    - Pokud je vypnutý, interval se zruší.
 * - Provede první načtení logu hned při inicializaci.
 */
export function init() {
  const btn = qs('logs-refresh');
  const auto = qs('logs-autorefresh');
  let timer = null;

  /**
   * doFetch()
   * ---------------------------------
   * Pomocná funkce pro načtení logu a aktualizaci UI.
   * - Nastaví status "Načítám…"
   * - Zavolá fetchLogTail() a vykreslí řádky
   * - Nastaví status na "Posledních N řádků"
   * - Při chybě zaloguje error a nastaví status "Chyba při načítání logu"
   */
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
