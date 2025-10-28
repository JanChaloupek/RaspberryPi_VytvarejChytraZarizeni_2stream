// static/js/utils.js

export function isoLocalString(dt) {
  // dt = Date objekt v lokálním čase nebo ISO string parse
  const d = (dt instanceof Date) ? dt : new Date(dt);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Robustní parser klíče -> Date (lokální)
export function parseLocalKey(key) {
  // Přijme různé tvary: YYYY, YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH:MM, YYYY-MM-DDTHH:MM:SS
  // Vrátí Date (lokální) reprezentující začátek zadaného intervalu
  if (!key) return new Date();
  const t = String(key).replace(' ', 'T');

  if (/^\d{4}$/.test(t)) return new Date(`${t}-01-01T00:00:00`);
  if (/^\d{4}-\d{2}$/.test(t)) return new Date(`${t}-01-01T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return new Date(`${t}:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t)) return new Date(t);
  // fallback: let browser try to parse
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

// Lokalizované české zobrazení podle úrovně
// Vychází z parseLocalKey (lokální Date) a zachovává konzistentní formáty:
// monthly -> "mm.yyyy" ), daily -> "dd.mm.yyyy", hourly -> "dd.mm.yyyy  HH", ...
export function formatKeyForCzechDisplay(key, level) {
  if (!key) return '--';
  const d = parseLocalKey(key);
  const pad = (n) => String(n).padStart(2, '0');

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hour = pad(d.getHours());
  const minute = pad(d.getMinutes());
  const second = pad(d.getSeconds());

  switch (level) {
    case 'monthly': return `${month}.${year}`;            // mm.yyyy 
    case 'daily': return `${day}.${month}.${year}`;        // dd.mm.yyyy
    case 'hourly': return `${day}.${month}.${year}  ${hour}`; // dd.mm.yyyy  HH
    case 'minutely': return `${day}.${month}.${year}  ${hour}:${minute}`; // dd.mm.yyyy  HH:MM
    case 'raw': return `${day}.${month}.${year}  ${hour}:${minute}:${second}`; // dd.mm.yyyy  HH:MM:SS
    default: return `${day}.${month}.${year}`;
  }
}

// Pořadí úrovní: monthly, daily, hourly, minutely, raw
export const LEVELS = ['monthly', 'daily', 'hourly', 'minutely', 'raw'];

export function nextLevel(level) {
  const idx = LEVELS.indexOf(level);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}

export function parentLevel(level) {
  const idx = LEVELS.indexOf(level);
  return idx > 0 ? LEVELS[idx - 1] : null;
}

// Krátké/ne-lokalizované zobrazení vhodné pro strojové řetězce nebo export
export function formatKeyForDisplay(key, level) {
  // Ořízne/zkrátí key pro zobrazení v tabulce podle úrovně
  if (!key) return '--';
  // očekáváme ISO tvar 'YYYY-MM-DDTHH:MM:SS' nebo ekvivalent
  const t = String(key).replace(' ', 'T');
  switch (level) {
    case 'monthly': return t.slice(0,7);                      // YYYY-MM
    case 'daily': return t.slice(0,10);                       // YYYY-MM-DD
    case 'hourly': return t.slice(0,13).replace('T',' ');     // YYYY-MM-DD HH
    case 'minutely': return t.slice(0,16).replace('T',' ');   // YYYY-MM-DD HH:MM
    case 'raw': return t.replace('T',' ').slice(0,19);        // YYYY-MM-DD HH:MM:SS
    default: return key;
  }
}
