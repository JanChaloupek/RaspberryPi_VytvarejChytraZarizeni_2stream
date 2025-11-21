// static/js/table.js
// Modul pro vykreslení historické tabulky agregovaných dat.
// ----------------------------------------------------
// Účel:
// - Vykresluje tabulku s časovými agregacemi (hodinové, denní, atd.).
// - Zobrazuje sloupce: Čas, Teplota, Vlhkost, Rosný bod, Počet.
// - Podporuje drill-down (rozkliknutí na detailnější úroveň).
// - Exportuje funkci renderTable(tableRoot, rows, level, onRowClick).
//
// Závislosti:
// - utils.js (formatKeyForCzechDisplay, nextLevel)
//
// Exportované funkce:
// - renderTable(tableRoot, rows, level, onRowClick)

import { formatKeyForCzechDisplay, nextLevel } from './utils.js';

/**
 * makeCell(tag, className, content)
 * ----------------------------------------------------
 * Vytvoří HTML buňku (td/th).
 * - tag: typ elementu (default 'td').
 * - className: CSS třída (volitelné).
 * - content: text nebo Node, který se vloží do buňky.
 *
 * @returns {HTMLElement} vytvořený element
 */
function makeCell(tag = 'td', className = '', content = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content instanceof Node) el.appendChild(content);
  else el.textContent = content;
  return el;
}

/**
 * makeChevronButton()
 * ----------------------------------------------------
 * Vytvoří tlačítko s chevronem (›) pro drill-down.
 * - Používá se v prvním sloupci tabulky.
 * - Má ARIA atributy pro přístupnost.
 *
 * @returns {HTMLButtonElement} tlačítko
 */
function makeChevronButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chev-btn';
  btn.setAttribute('aria-hidden', 'false');
  btn.setAttribute('aria-label', 'Rozkliknout');
  btn.innerHTML = '<span class="chev">›</span>';
  return btn;
}

/**
 * formatNumber(v, digits)
 * ----------------------------------------------------
 * Naformátuje číslo na pevný počet desetinných míst.
 * - Pokud je hodnota null/undefined/NaN, vrátí '--'.
 *
 * @param {number} v - hodnota
 * @param {number} digits - počet desetinných míst (default 2)
 * @returns {string} formátovaný text
 */
function formatNumber(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '--';
  return Number(v).toFixed(digits);
}

/**
 * renderTable(tableRoot, rows, level, onRowClick)
 * ----------------------------------------------------
 * Vykreslí tabulku s historickými agregovanými daty.
 * - tableRoot: element <table>, do kterého se vykreslí obsah.
 * - rows: pole objektů s daty (key/time, temperature, humidity, dew_point, count).
 * - level: aktuální úroveň agregace ('hourly', 'daily', 'raw'…).
 * - onRowClick: callback pro drill-down (childLevel, childKey).
 *
 * Funkce:
 * - Vytvoří hlavičku tabulky.
 * - Pro každý řádek vykreslí buňky s daty.
 * - Pokud je řádek drillovatelný (má child_key/child_level nebo count > 0),
 *   přidá chevron a nastaví click handler.
 * - Časový klíč se formátuje pomocí formatKeyForCzechDisplay().
 */
export function renderTable(tableRoot, rows = [], level = 'hourly', onRowClick = null) {
  if (!tableRoot) return;
  tableRoot.innerHTML = '';

  // Header (first column reserved for chevron)
  const thead = document.createElement('thead');
  const thr = document.createElement('tr');
  thr.appendChild(makeCell('th', 'chev-col', ''));
  thr.appendChild(makeCell('th', '', 'Čas'));
  thr.appendChild(makeCell('th', '', 'Teplota'));
  thr.appendChild(makeCell('th', '', 'Vlhkost'));
  thr.appendChild(makeCell('th', '', 'Rosný bod'));
  thr.appendChild(makeCell('th', '', 'Počet'));
  thead.appendChild(thr);
  tableRoot.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    // Drillable heuristics:
    // - Never show chevron when current level is 'raw'
    // - Prefer explicit child_key/child_level from backend
    // - Otherwise consider row drillable when count > 0 and onRowClick exists
    const isRawLevel = (level === 'raw');
    const hasExplicitChild = Boolean(row.child_key || row.child_level);
    const hasCount = Number.isFinite(Number(row.count)) && Number(row.count) > 0;
    const canDrill = !isRawLevel && (typeof onRowClick === 'function') && (hasExplicitChild || hasCount);

    // First column: chevron if drillable
    const firstTd = makeCell('td', 'chev-col');
    if (canDrill) {
      const btn = makeChevronButton();
      btn.title = 'Rozkliknout';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const childLevel = row.child_level || nextLevel(level) || 'raw';
        const childKey = row.child_key || row.key;
        console.debug('[table.js] Chevron click', { childLevel, childKey, row });
        if (childKey) onRowClick(childLevel, childKey);
      });
      firstTd.appendChild(btn);
      tr.classList.add('clickable-row');
    }
    tr.appendChild(firstTd);

    // Time / key column - use Czech localized formatter
    const displayTime = formatKeyForCzechDisplay(row.key || row.time || '', level);
    tr.appendChild(makeCell('td', '', displayTime));

    // Temperature
    tr.appendChild(makeCell('td', '', formatNumber(row.temperature, 2)));

    // Humidity
    tr.appendChild(makeCell('td', '', formatNumber(row.humidity, 2)));

    // Dew point
    tr.appendChild(makeCell('td', '', formatNumber(row.dew_point, 2)));

    // Count
    tr.appendChild(makeCell('td', '', (Number.isFinite(Number(row.count)) ? String(row.count) : '--')));

    // Row click handler (body) if drillable
    if (canDrill) {
      tr.addEventListener('click', () => {
        const childLevel = row.child_level || nextLevel(level) || 'raw';
        const childKey = row.child_key || row.key;
        console.debug('[table.js] Row click', { childLevel, childKey, row });
        if (childKey) onRowClick(childLevel, childKey);
      });
    }

    tbody.appendChild(tr);
  });

  tableRoot.appendChild(tbody);
}
