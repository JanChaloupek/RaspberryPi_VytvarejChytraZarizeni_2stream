// utils.js - časové a formátovací utility (upraveno: klient posílá pouze local key + tz metadata)
// Nasadit místo stávajícího utils.js. Funkce jsou top-level a dostupné globálně.

//
// Timezone / client info
//
function getClientTzParams() {
  let tz = null;
  try {
    const ro = Intl.DateTimeFormat().resolvedOptions();
    if (ro && ro.timeZone) tz = ro.timeZone;
  } catch (e) {
    console.warn('getClientTzParams: cannot resolve timeZone', e);
  }
  const offset = -new Date().getTimezoneOffset(); // minutes east of UTC
  console.debug('[getClientTzParams] tz:', tz, 'offset(min):', offset);
  return { tz, offset };
}

//
// Display helpers
//
function formatTime(utc) {
  if (!utc) return '--';
  const iso = utc.endsWith('Z') ? utc : utc + 'Z';
  const local = new Date(iso);
  return isNaN(local.getTime()) ? '--' : local.toLocaleString();
}

function formatFullLocalFromDate(d) {
  if (!d || isNaN(d.getTime())) return '--';
  const D = String(d.getDate()).padStart(2, '0');
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const Y = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${D}.${M}.${Y} ${hh}:${mm}:${ss}`;
}

//
// Key transformation utilities (format-only; do NOT perform timezone shifts here)
// - klient má nyní posílat lokální klíče + tz/tz_offset a backend bude provádět převody
//

// Převod UTC-style key z backendu na lokální key (pokud backend vrací UTC key, použij pro zobrazení)
// Tento helper neprovádí konverzi podle klienta; očekává UTC string konvenčně zakončený "Z" nebo tvar bez Z.
function utcKeyToLocalKey(level, utcKey) {
  if (!utcKey) return utcKey;
  try {
    // zachovat jednoduché granularitní formáty
    if (/^\d{4}$/.test(utcKey)) return utcKey;
    if (/^\d{4}-\d{2}$/.test(utcKey)) return utcKey;
    if (/^\d{4}-\d{2}-\d{2}$/.test(utcKey)) return utcKey;
    // pokud máme UTC datetime-like, pokusíme se vytvořit lokální reprezentaci (bez timezone korekce)
    // např. backend může vrátit "2025-10-25T17" nebo "2025-10-25T17:00"
    let s = utcKey;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(s)) s += ':00:00Z';
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s += ':00Z';
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s) && !/Z$/.test(s)) s += 'Z';
    // parse as ISO
    const d = new Date(s);
    if (isNaN(d.getTime())) return utcKey;
    // return local formatted string without altering timezone semantics (only user-friendly representation)
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    if (/T\d{2}:\d{2}/.test(utcKey)) return `${Y}-${M}-${D}T${hh}:${mm}`;
    if (/T\d{2}$/.test(utcKey)) return `${Y}-${M}-${D}T${hh}`;
    return `${Y}-${M}-${D}`;
  } catch (e) {
    console.warn('utcKeyToLocalKey error', e);
    return utcKey;
  }
}

// Normalize local key format for API (neprovádí timezone shifts)
// Přijímá level a klíč, vrátí canonical lokální formát, který backend očekává
function normalizeLocalKeyForApi(level, key) {
  if (!key) return key;
  // pokud už je v očekávaném formátu, vrátit jej
  if (/^\d{4}$/.test(key)) return key;
  if (/^\d{4}-\d{2}$/.test(key)) return key;
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key)) return key;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(key)) return key;

  // normalize space-separated datetime like 'YYYY-MM-DD HH:MM[:SS]'
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(key)) {
    const parts = key.split(' ');
    const date = parts[0];
    const time = parts[1].slice(0,5);
    if (level === 'minutely' || level === 'raw') return `${date}T${time}`;
    if (level === 'hourly') return `${date}T${time.slice(0,2)}`;
    return date;
  }

  // If we got a key like 'YYYY-MM-DDTHH:MM:SS' trim seconds if backend prefers not to have them
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(key)) {
    if (level === 'minutely' || level === 'raw') return key.slice(0,16); // keep YYYY-MM-DDTHH:MM
    if (level === 'hourly') return key.slice(0,13); // YYYY-MM-DDTHH
  }

  // Fallback: return original key (backend must handle validation)
  return key;
}

//
// Human-friendly period formatter
//
function formatPeriod(key) {
  if (!key) return '--';
  let safe = key;
  try {
    // year
    if (/^\d{4}$/.test(safe)) return safe;
    // month
    if (/^\d{4}-\d{2}$/.test(safe)) {
      const [y, m] = safe.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1, 1));
      return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }
    // day
    if (/^\d{4}-\d{2}-\d{2}$/.test(safe)) {
      const [y, m, day] = safe.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1, day));
      return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
    }
    // datetime-hour/minute
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(safe)) {
      safe += ':00Z';
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(safe)) {
      safe += ':00:00Z';
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(safe) && !/Z$/.test(safe)) {
      safe += 'Z';
    } else if (!/Z$/.test(safe) && /\dT/.test(safe)) {
      safe += 'Z';
    }
    const d = new Date(safe);
    if (isNaN(d.getTime())) return key;
    // If key contains time portion, return "YYYY-MM-DD HH:MM"
    if (/T\d{2}:\d{2}/.test(key)) {
      const Y = d.getFullYear();
      const M = String(d.getMonth() + 1).padStart(2, '0');
      const D = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${Y}-${M}-${D} ${hh}:${mm}`;
    }
    if (/T\d{2}$/.test(key)) {
      const D = String(d.getDate()).padStart(2, '0');
      const M = String(d.getMonth() + 1).padStart(2, '0');
      const Y = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      return `${D}.${M}.${Y} ${hh}:00`;
    }
    return d.toLocaleString();
  } catch (e) {
    console.warn("formatPeriod parse error for key:", key, e);
    return key;
  }
}

//
// Breadcrumb label helper (top-level utility)
// Vrátí label pro breadcrumb podle úrovně řádku a lokálního klíče.
// Používat v table.js click handleru: const label = makeBreadcrumbLabelForRow(level, localKey);
function makeBreadcrumbLabelForRow(levelOfRow, localKey) {
  try {
    if (levelOfRow === 'monthly') {
      const parts = (localKey || '').split('-');
      return `Měsíc: ${parts[1] ? String(parts[1]).padStart(2, '0') : ''}`;
    }
    if (levelOfRow === 'daily') {
      const parts = (localKey || '').split('-');
      return `Den: ${parts[2] ? String(parts[2]).padStart(2, '0') : ''}`;
    }
    if (levelOfRow === 'hourly') {
      const hh = (localKey && localKey.includes('T')) ? localKey.split('T')[1].slice(0,2) : '00';
      return `Hodina: ${String(hh).padStart(2,'0')}`;
    }
    if (levelOfRow === 'minutely') {
      const mm = (localKey && localKey.includes('T')) ? (localKey.split('T')[1].split(':')[1] || '00') : '00';
      return `Minuta: ${String(mm).padStart(2,'0')}`;
    }
    return formatPeriod(localKey || '');
  } catch (e) {
    return formatPeriod(localKey || '');
  }
}


//
// Expose minimal API (global functions expected elsewhere)
//
window.getClientTzParams = getClientTzParams;
window.formatTime = formatTime;
window.formatFullLocalFromDate = formatFullLocalFromDate;
window.utcKeyToLocalKey = utcKeyToLocalKey;
window.normalizeLocalKeyForApi = normalizeLocalKeyForApi;
window.formatPeriod = formatPeriod;
window.makeBreadcrumbLabelForRow = makeBreadcrumbLabelForRow;
