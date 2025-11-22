// static/js/breadcrumb.js
// Modul pro vykreslení navigační cesty (breadcrumb) podle časového klíče.
// ----------------------------------------------------
// Účel:
// - Generuje breadcrumb navigaci pro časové úrovně (rok, měsíc, den, hodina, minuta).
// - Umožňuje uživateli přecházet mezi různými úrovněmi detailu dat.
// - Poskytuje vizuální oddělovače mezi jednotlivými úrovněmi.
// - Podporuje navigaci zpět na "Home" (dnešní den).
//
// Závislosti:
// - Používá pouze nativní DOM API.
// - Ikona "Home" využívá Bootstrap Icons (`bi bi-house`).
//
// Funkce:
// - el(html) → vytvoří DOM element z HTML stringu.
// - makeCrumbLink(label, levelName, keyStr, isActive, onNavigate)
//   → Vytvoří položku breadcrumb (klikací nebo neaktivní).
// - addSeparator(ol) → vloží vizuální oddělovač "›" mezi položky.
// - formatPartsFromKey(key) → rozparsuje časový klíč (YYYY, YYYY-MM, YYYY-MM-DD, …) na části.
// - renderBreadcrumb(container, level, key, onNavigate)
//   → Vykreslí kompletní breadcrumb navigaci do zadaného kontejneru.
//
// ----------------------------------------------------

/**
 * el()
 * ----------------------------------------------------
 * Vytvoří DOM element z HTML stringu.
 *
 * @param {string} html HTML kód
 * @returns {HTMLElement} První element z template
 */
function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

/**
 * makeCrumbLink()
 * ----------------------------------------------------
 * Vytvoří položku breadcrumb (li).
 * - Pokud je položka aktivní, renderuje se jako neklikatelné <span>.
 * - Pokud není aktivní, renderuje se jako <a> s event listenerem.
 *
 * @param {string} label Textový popisek položky
 * @param {string} levelName Úroveň (monthly, daily, hourly, minutely, raw)
 * @param {string} keyStr Klíč (např. "2025-11-11")
 * @param {boolean} isActive True = poslední aktivní položka
 * @param {function} onNavigate Callback pro navigaci
 * @returns {HTMLLIElement} Element <li> s obsahem
 */
function makeCrumbLink(label, levelName, keyStr, isActive, onNavigate) {
  const li = document.createElement('li');
  li.className = 'breadcrumb-item' + (isActive ? ' active' : '');
  if (isActive) li.setAttribute('aria-current', 'page');

  if (isActive) {
    // render as non-clickable text for the active (last) crumb
    const span = document.createElement('span');
    span.className = 'breadcrumb-link-disabled';
    span.textContent = label;
    span.setAttribute('role', 'text');
    span.setAttribute('aria-disabled', 'true');
    li.appendChild(span);
  } else {
    const a = document.createElement('a');
    a.className = 'breadcrumb-item-link';
    a.href = '#';
    a.textContent = label;
    a.dataset.level = levelName;
    a.dataset.key = keyStr;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      onNavigate(levelName, keyStr);
    });
    li.appendChild(a);
  }
  return li;
}

/**
 * addSeparator()
 * ----------------------------------------------------
 * Přidá vizuální oddělovač "›" mezi položky breadcrumb.
 *
 * @param {HTMLElement} ol Kontejner breadcrumb (např. <ol>)
 */
function addSeparator(ol) {
  const sep = document.createElement('span');
  sep.className = 'breadcrumb-sep';
  sep.textContent = '›';
  ol.appendChild(sep);
}

/**
 * formatPartsFromKey()
 * ----------------------------------------------------
 * Rozparsuje časový klíč na jednotlivé části.
 * - Podporované formáty: YYYY, YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH:MM, YYYY-MM-DDTHH:MM:SS
 * - Vrací objekt { year, month, day, hour, minute }.
 *
 * @param {string} key Časový klíč
 * @returns {{year:string|null, month:string|null, day:string|null, hour:string|null, minute:string|null}}
 */
function formatPartsFromKey(key) {
  const parts = { year: null, month: null, day: null, hour: null, minute: null };
  if (!key) return parts;
  const t = String(key).replace(' ', 'T');
  const dateOnly = t.split('T')[0];
  const ymd = dateOnly.split('-');
  if (ymd.length >= 1) parts.year = ymd[0];
  if (ymd.length >= 2) parts.month = ymd[1];
  if (ymd.length >= 3) parts.day = ymd[2];
  const timePart = t.includes('T') ? t.split('T')[1] : null;
  if (timePart) {
    const hm = timePart.split(':');
    if (hm.length >= 1) parts.hour = String(hm[0]).padStart(2, '0');
    if (hm.length >= 2) parts.minute = String(hm[1]).padStart(2, '0');
  }
  return parts;
}

// Mapování úrovní na segmenty klíče
const LEVEL_TO_SEGMENTS = {
  monthly: ['year'],
  daily: ['year','month'],
  hourly: ['year','month','day'],
  minutely: ['year','month','day','hour'],
  raw: ['year','month','day','hour','minute']
};

/**
 * renderBreadcrumb()
 * ----------------------------------------------------
 * Vykreslí breadcrumb navigaci do zadaného kontejneru.
 * - Vždy začíná položkou "Home" (ikona domu).
 * - Podle úrovně (level) a klíče (key) generuje jednotlivé části (rok, měsíc, den, hodina, minuta).
 * - Aktivní položka se renderuje jako neklikatelné <span>.
 *
 * @param {HTMLElement} container Kontejner breadcrumb (např. <ol>)
 * @param {string} level Úroveň detailu ("monthly","daily","hourly","minutely","raw")
 * @param {string} key Časový klíč (např. "2025-11-11T12:30")
 * @param {function} onNavigate Callback pro navigaci při kliknutí
 */
export function renderBreadcrumb(container, level, key, onNavigate) {
  container.innerHTML = '';

  // Home (icon)
  const homeLi = document.createElement('li');
  homeLi.className = 'breadcrumb-item breadcrumb-home';
  const homeA = document.createElement('a');
  homeA.href = '#';
  homeA.className = 'breadcrumb-item-home-link';
  homeA.innerHTML = '<i class="bi bi-house"></i>';
  homeA.addEventListener('click', (e) => {
    e.preventDefault();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayKey = `${y}-${m}-${d}`; // YYYY-MM-DD
    onNavigate('hourly', todayKey);
  });
  homeLi.appendChild(homeA);
  container.appendChild(homeLi);

  const parts = formatPartsFromKey(key);
  const segs = LEVEL_TO_SEGMENTS[level] || LEVEL_TO_SEGMENTS['raw'];

  // Year
  if (segs.includes('year') && parts.year) {
    addSeparator(container);
    const yearKey = `${parts.year}`;
    container.appendChild(makeCrumbLink(`Rok: ${parts.year}`, 'monthly', yearKey, segs.length === 1, onNavigate));
  }

  // Month
  if (segs.includes('month') && parts.month) {
    addSeparator(container);
    const monthKey = `${parts.year}-${parts.month}`;
    const isActive = segs.length === 2;
    container.appendChild(makeCrumbLink(`Měsíc: ${parts.month}`, 'daily', monthKey, isActive, onNavigate));
  }

  // Day
  if (segs.includes('day') && parts.day) {
    addSeparator(container);
    const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
    const isActive = segs.length === 3;
    container.appendChild(makeCrumbLink(`Den: ${parts.day}`, 'hourly', dayKey, isActive, onNavigate));
  }

  // Hour
  if (segs.includes('hour') && parts.hour) {
    addSeparator(container);
    const hourKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:00`;
    const isActive = segs.length === 4;
    container.appendChild(makeCrumbLink(`Hodina: ${parts.hour}`, 'minutely', hourKey, isActive, onNavigate));
  }

  // Minute
  if (segs.includes('minute') && parts.minute) {
    addSeparator(container);
    const minuteKey = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
    const isActive = segs.length === 5;
    container.appendChild(makeCrumbLink(`Minuta: ${parts.minute}`, 'raw', minuteKey, isActive, onNavigate));
  }
}
