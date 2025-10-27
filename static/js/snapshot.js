// static/js/snapshot.js
import { formatKeyForCzechDisplay } from './utils.js';

export function updateSnapshotFromIso(isoString) {
  const tEl = document.getElementById('snapshot-time');
  if (!tEl) return;
  // Pokud backend posílá ISO s offsetem, necháme Date to parsenout
  const dateKey = (() => {
    // chceme string ve tvaru vhodném pro parseLocalKey v utils.js
    // pokud už posíláš přesný key (např. '2025-10-27T21:29:49'), použij ho přímo
    // jinak vytvoříme ISO bez milisekund
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const pad = n => String(n).padStart(2,'0');
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch (e) {
      return isoString;
    }
  })();

  // Formátujeme čas 
  const formatted = formatKeyForCzechDisplay(dateKey, 'raw'); 
  tEl.textContent = formatted;
  // nastavíme strojově čitelný atribut
  try {
    const dt = new Date(isoString);
    if (!isNaN(dt.getTime())) tEl.setAttribute('datetime', dt.toISOString());
    else tEl.removeAttribute('datetime');
  } catch (e) {
    tEl.removeAttribute('datetime');
  }
}
