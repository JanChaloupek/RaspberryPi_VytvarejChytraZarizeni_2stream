// breadcrumb.js
// Správa breadcrumb navigace: setBreadcrumbForLoad, renderBreadcrumb
// Očekává globální proměnné/functiony: breadcrumb (array), loadAggregate, updateAll, currentAggregate,
// normalizeLocalKeyForApi, setBreadcrumbForLoad volá se z main.js při navigaci/načtení.

// Inicializace
window.breadcrumb = window.breadcrumb || [];

// Definice pořadí úrovní
const LEVEL_ORDER = ['home', 'monthly', 'daily', 'hourly', 'minutely', 'raw'];

function _levelIndex(level) {
  const idx = LEVEL_ORDER.indexOf(level);
  return idx >= 0 ? idx : -1;
}

// setBreadcrumbForLoad: doplní/aktualizuje breadcrumb tak, aby obsahoval položky až do target level.
// Každá položka má tvar: { sensor_id, level, key, label }
function setBreadcrumbForLoad(sensor_id, level, key, label) {
  // fallback na DOM select pokud chybí sensor_id
  if (!sensor_id) {
    const sel = document.getElementById('sensor_select');
    sensor_id = sel ? sel.value : undefined;
  }
  if (!sensor_id) {
    console.warn('[setBreadcrumbForLoad] missing sensor_id, skipping breadcrumb update');
    return;
  }

  const targetIdx = _levelIndex(level);
  if (targetIdx === -1) {
    console.warn('[setBreadcrumbForLoad] unknown level', level);
    return;
  }

  // zachovej Home pokud je první položkou
  let startIdx = 0;
  if (breadcrumb.length > 0 && breadcrumb[0].level === 'home') startIdx = 1;

  // nové breadcrumb pole začne prefixem (např. Home)
  const newCr = breadcrumb.slice(0, startIdx);

  // doplň úrovně od startIdx do targetIdx
  for (let i = Math.max(startIdx, 1); i <= targetIdx; i++) {
    const lvl = LEVEL_ORDER[i];
    const existing = breadcrumb.find(b => b.level === lvl && b.sensor_id === sensor_id);
    if (existing) {
      newCr.push(existing);
    } else {
      if (i === targetIdx) {
        newCr.push({ sensor_id: sensor_id, level: level, key: key, label: label });
      } else {
        newCr.push({ sensor_id: sensor_id, level: lvl, key: '', label: lvl });
      }
    }
  }

  breadcrumb = newCr;
  console.debug('[setBreadcrumbForLoad] new breadcrumb=', JSON.parse(JSON.stringify(breadcrumb)));
}

// helper: vytvoří element s bootstrap home ikonou + skrytým popiskem pro čtečky obrazovky
function createHomeIconWithLabel(labelText = 'Home') {
  const container = document.createElement('span');
  container.className = 'breadcrumb-home';

  const icon = document.createElement('i');
  icon.className = 'bi bi-house';
  icon.setAttribute('aria-hidden', 'true');
  container.appendChild(icon);

  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = labelText;
  container.appendChild(sr);

  return container;
}

// renderBreadcrumb: vykreslí breadcrumb do elementu s id="breadcrumb"
function renderBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  if (!el) {
    console.warn('[renderBreadcrumb] #breadcrumb element not found');
    return;
  }

  el.innerHTML = '';

  // prázdný breadcrumb => aktivní home ikona
  if (!breadcrumb || breadcrumb.length === 0) {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item active';
    span.appendChild(createHomeIconWithLabel('Home'));
    el.appendChild(span);
    return;
  }

  for (let i = 0; i < breadcrumb.length; i++) {
    const item = breadcrumb[i];
    const isLast = (i === breadcrumb.length - 1);
    const wrapper = document.createElement('span');
    wrapper.className = 'breadcrumb-item-wrapper';

    if (isLast) {
      const span = document.createElement('span');
      span.className = 'breadcrumb-item active';
      if (item.level === 'home') {
        span.appendChild(createHomeIconWithLabel('Home'));
      } else {
        span.textContent = item.label || item.level || '...';
      }
      wrapper.appendChild(span);
    } else {
      // klikatelné položky
      if (item.level === 'home') {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'breadcrumb-item-link breadcrumb-item-home-link';
        a.appendChild(createHomeIconWithLabel('Home'));

        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const sid = item.sensor_id || document.getElementById('sensor_select')?.value;
          if (!sid) {
            console.warn('[renderBreadcrumb] click no sensor_id, abort');
            return;
          }
          if (typeof updateAll === 'function') {
            updateAll(sid);
          } else {
            // fallback: load monthly for current year
            const now = new Date();
            const y = String(now.getFullYear());
            setBreadcrumbForLoad(sid, 'monthly', y, `Rok: ${y}`);
            currentAggregate = { sensor_id: sid, level: 'monthly', key: y, label: `Rok: ${y}` };
            loadAggregate(sid, 'monthly', y, `Rok: ${y}`).catch(()=>{});
          }
        });

        wrapper.appendChild(a);
      } else {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'breadcrumb-item-link';
        a.textContent = item.label || item.level || '...';
        a.addEventListener('click', (ev) => {
          ev.preventDefault();
          const sid = item.sensor_id || document.getElementById('sensor_select')?.value;
          if (!sid) {
            console.warn('[renderBreadcrumb] click no sensor_id, abort');
            return;
          }
          try {
            setBreadcrumbForLoad(sid, item.level, item.key, item.label);
            currentAggregate = { sensor_id: sid, level: item.level, key: item.key, label: item.label };
            const apiKey = normalizeLocalKeyForApi(item.level, item.key || '');
            loadAggregate(sid, item.level, apiKey, item.label).catch(()=>{});
          } catch (e) {
            console.warn('[renderBreadcrumb] click handler error', e);
          }
        });
        wrapper.appendChild(a);
      }
    }

    el.appendChild(wrapper);

    if (i < breadcrumb.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '›';
      el.appendChild(sep);
    }
  }

  console.debug('[renderBreadcrumb] breadcrumb=', JSON.parse(JSON.stringify(breadcrumb)));
}

// Expose functions globally
window.setBreadcrumbForLoad = setBreadcrumbForLoad;
window.renderBreadcrumb = renderBreadcrumb;
