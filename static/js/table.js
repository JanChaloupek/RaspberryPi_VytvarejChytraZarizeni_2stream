// table.js - tabulka historie a drill logika (opraveno: správné friendly labely pro breadcrumb při drill)

// pomocná: převede DB timestamp (např. "2025-10-25 22:00:12" nebo "2025-10-25 22:00") na Date objekt (UTC assumed)
function parseDbTimestampToDate(ts) {
  if (!ts) return null;
  const iso = ts.endsWith('Z') ? ts : ts.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

// pomocná: formát YYYY-MM-DD HH:MM:SS pro zobrazení (lokální)
function formatFullLocal(d) {
  if (!d) return '--';
  const D = String(d.getDate()).padStart(2, '0');
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const Y = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${D}.${M}.${Y} ${hh}:${mm}:${ss}`;
}

// helper: map current level -> next level (same as other modules)
const NEXT_LEVEL = {
  monthly: 'daily',
  daily: 'hourly',
  hourly: 'minutely',
  minutely: 'raw'
};

// Nový helper: vrátí pole měsíců pro zobrazení pro daný rok s pravidlem:
// pokud je aktuální měsíc 1-3 (leden až březen), zahrne i měsíce z předchozího roku.
// Pořadí: nejnovější první (např. 12.targetYear ... 01.targetYear, 12.prevYear ... 01.prevYear)
function getMonthsForYearView(targetYear, currentDate = new Date()) {
  const ty = typeof targetYear === 'number' ? targetYear : parseInt(targetYear, 10);
  if (isNaN(ty)) return [];

  const curMonth = currentDate.getMonth() + 1;
  const includePrevYear = (curMonth >= 1 && curMonth <= 3);

  const months = [];

  // přidáme měsíce cílového roku od 12 do 1
  for (let m = curMonth; m >= 1; m--) {
    months.push({
      year: ty,
      month: String(m).padStart(2, '0'),
      key: `${ty}-${String(m).padStart(2,'0')}`,
      label: `${String(m).padStart(2,'0')}.${ty}`
    });
  }

  // přidáme celý předchozí rok pokud je třeba
  if (includePrevYear) {
    const prevYear = ty - 1;
    for (let m = 12; m >= 1; m--) {
      months.push({
        year: prevYear,
        month: String(m).padStart(2, '0'),
        key: `${prevYear}-${String(m).padStart(2,'0')}`,
        label: `${String(m).padStart(2,'0')}.${prevYear}`
      });
    }
  }

  return months;
}

// Helper: extrahuje rok z API měsíčních dat (pokud jsou) nebo fallback na aktuální rok
function inferYearFromMonthlyData(data) {
  if (!Array.isArray(data) || data.length === 0) return (new Date()).getFullYear();
  // najdeme první item, který má key ve formátu YYYY-MM
  for (const r of data) {
    if (r && typeof r.key === 'string') {
      const m = r.key.match(/^(\d{4})-\d{2}$/);
      if (m) return parseInt(m[1], 10);
    }
  }
  // fallback
  return (new Date()).getFullYear();
}

// Předpokládáme, že existuje funkce formatPeriod(key) jinde v kódu.
// Pokud neexistuje, definujme jednoduchou náhradu:
if (typeof formatPeriod !== 'function') {
  function formatPeriod(key) {
    if (!key) return '--';
    // měsíc YYYY-MM -> MM.YYYY, hour YYYY-MM-DDTHH -> HH:00 YYYY-MM-DD, day YYYY-MM-DD -> DD.MM.YYYY
    if (/^\d{4}-\d{2}$/.test(key)) {
      const parts = key.split('-');
      return `${parts[1]}.${parts[0]}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(key)) {
      const [dpart, hpart] = [key.slice(0,10), key.slice(11)];
      const dt = new Date(dpart + 'T00:00:00Z');
      const D = String(dt.getDate()).padStart(2,'0');
      const M = String(dt.getMonth()+1).padStart(2,'0');
      const Y = dt.getFullYear();
      return `Hodina ${hpart} ${D}.${M}.${Y}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
      const parts = key.split('-');
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return key;
  }
}

// hlavní funkce
function renderHistoryTable(data, level, sensor_id) {
  console.info("[renderHistoryTable] level:", level, "sensor:", sensor_id, "rows from API:", Array.isArray(data) ? data.length : data);

  // diagnostika: vypiš první 20 klíčů z API dat a level
  console.debug('[diagnostics] renderHistoryTable level=', level, 'sensor=', sensor_id, 'apiRows=', Array.isArray(data) ? data.length : data);
  if (Array.isArray(data)) {
    console.debug('[diagnostics] sample keys:', data.slice(0,20).map(r => r.key ?? r.timestamp ?? '(no-key)').join(', '));
  }

  const head = document.getElementById('history-head');
  const body = document.getElementById('history-body');
  if (!head || !body) {
    console.warn('[renderHistoryTable] missing table elements');
    return;
  }
  head.innerHTML = '';
  body.innerHTML = '';

  const headerRow = document.createElement('tr');
  ['', 'Období', 'Teplota', 'Vlhkost', 'Vzorků'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  head.appendChild(headerRow);

  let rowsToRender = [];

  if (level === 'raw') {
    const groups = new Map();
    for (const r of data) {
      const tsStr = r.timestamp;
      const d = parseDbTimestampToDate(tsStr);
      const groupKey = (d ? d.toISOString().slice(0,19) : tsStr);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { sumT:0, sumH:0, count:0, sampleTs: [], sampleDates: [] });
      }
      const g = groups.get(groupKey);
      const t = (r.temperature === null || r.temperature === undefined) ? NaN : Number(r.temperature);
      const h = (r.humidity === null || r.humidity === undefined) ? NaN : Number(r.humidity);
      if (!isNaN(t)) g.sumT += t;
      if (!isNaN(h)) g.sumH += h;
      g.count += 1;
      g.sampleTs.push(tsStr);
      g.sampleDates.push(d);
    }

    const sortedKeys = Array.from(groups.keys()).sort().reverse();
    for (const k of sortedKeys) {
      const g = groups.get(k);
      const avgT = g.count > 0 ? (isNaN(g.sumT) ? null : (g.sumT / g.count)) : null;
      const avgH = g.count > 0 ? (isNaN(g.sumH) ? null : (g.sumH / g.count)) : null;
      let reprDate = g.sampleDates.find(x => x instanceof Date && !isNaN(x.getTime()));
      if (!reprDate) reprDate = parseDbTimestampToDate(g.sampleTs[0]);
      rowsToRender.push({
        key: k,
        avg_temp: avgT,
        avg_hum: avgH,
        count: g.count,
        raw: true,
        reprDate: reprDate
      });
    }
  } else if (level === 'monthly') {
    // Special: zobrazíme měsíce cílového roku a případně z předchozího roku pokud je aktuální měsíc 1-3
    // Nejprve vytvoříme mapu apiData pro rychlé nalezení údajů podle key (YYYY-MM)
    const apiMap = new Map();
    if (Array.isArray(data)) {
      for (const r of data) {
        if (r && r.key) apiMap.set(r.key, r);
      }
    }

    // infer target year z API dat nebo fallback na current year
    const targetYear = inferYearFromMonthlyData(data);
    const monthsToShow = getMonthsForYearView(targetYear, new Date());

    // pro každý month z monthsToShow vytvoříme řádek s hodnotami pokud existují, jinak placeholder
    for (const m of monthsToShow) {
      const apiRow = apiMap.get(m.key);
      rowsToRender.push({
        key: m.key,
        avg_temp: apiRow ? apiRow.avg_temp : null,
        avg_hum: apiRow ? apiRow.avg_hum : null,
        count: apiRow ? (apiRow.count ?? null) : null,
        raw: false,
        // přidej label pro zobrazení (formatPeriod to zpracuje, ale dáváme přátelské labely)
        label: m.label
      });
    }
  } else {
    rowsToRender = (Array.isArray(data) ? data.slice() : []).map(r => ({
      key: r.key,
      avg_temp: r.avg_temp,
      avg_hum: r.avg_hum,
      count: r.count ?? null,
      raw: false,
      reprDate: null
    })).sort((a,b)=>{
      if (a.key === b.key) return 0;
      return a.key < b.key ? 1 : -1;
    });
  }

  console.debug('[renderHistoryTable] rowsToRender count:', rowsToRender.length);

  for (const row of rowsToRender) {
    const tr = document.createElement('tr');

    if (!row.raw) {
      tr.addEventListener('click', () => {
        const currentLevel = level;
        const targetLevel = NEXT_LEVEL[currentLevel] || 'daily';
        const localKey = row.local_key || row.key;
        const apiKeyForTarget = normalizeLocalKeyForApi(targetLevel, localKey);
        const explicitLabel = (currentLevel === 'yearly') ? `Rok: ${localKey}` : (row.label || makeBreadcrumbLabelForRow(currentLevel, localKey));

        console.info('[row click] level=', currentLevel, 'targetLevel=', targetLevel, 'apiKey=', apiKeyForTarget, 'label=', explicitLabel);

        // ensure breadcrumb records this drilldown (must include sensor_id)
        try {
          // setBreadcrumbForLoad musí existovat globálně a ukládat sensor_id do položky
          setBreadcrumbForLoad(sensor_id, targetLevel, apiKeyForTarget, explicitLabel);
        } catch (e) {
          console.warn('[row click] setBreadcrumbForLoad failed', e);
        }

        // update currentAggregate to reflect the new view before loading
        currentAggregate = { sensor_id, level: targetLevel, key: apiKeyForTarget, label: explicitLabel };

        // finally load the data
        loadAggregate(sensor_id, targetLevel, apiKeyForTarget, explicitLabel);
      });
    }

    const iconCell = document.createElement('td');
    if (!row.raw) {
      const icon = document.createElement('i');
      icon.className = 'bi bi-chevron-right';
      iconCell.appendChild(icon);
    }
    tr.appendChild(iconCell);

    const labelCell = document.createElement('td');
    if (row.raw) {
      const display = row.reprDate ? formatFullLocal(row.reprDate) : (row.key || '--');
      if (row.count && row.count > 1) {
        labelCell.innerHTML = `<div>${display}</div><div class="text-muted small">vzorků: ${row.count}</div>`;
      } else {
        labelCell.textContent = display;
      }
    } else {
      labelCell.textContent = formatPeriod(row.key || row.label);
    }
    tr.appendChild(labelCell);

    const tempCell = document.createElement('td');
    const humCell = document.createElement('td');
    const countCell = document.createElement('td');

    tempCell.textContent = (row.avg_temp === null || row.avg_temp === undefined || isNaN(Number(row.avg_temp))) ? '--' : Number(row.avg_temp).toFixed(1);
    humCell.textContent = (row.avg_hum === null || row.avg_hum === undefined || isNaN(Number(row.avg_hum))) ? '--' : Number(row.avg_hum).toFixed(1);
    countCell.textContent = (row.count === null || row.count === undefined) ? '--' : String(row.count);

    tr.appendChild(tempCell);
    tr.appendChild(humCell);
    tr.appendChild(countCell);

    body.appendChild(tr);
  }

  console.debug('[renderHistoryTable] final rendered rows:', rowsToRender.length);
}

// drill: očekává že key je lokální API-formát (normalizeLocalKeyForApi dělá úpravy)
function drill(currentLevel, key, _, sensor_id, explicitLabel = null) {
  const next = {
    monthly: 'daily',
    daily: 'hourly',
    hourly: 'minutely',
    minutely: 'raw'
  };
  const nextLevel = next[currentLevel];
  if (!nextLevel) return;

  const normalizedKey = normalizeLocalKeyForApi(nextLevel, key);
  const label = explicitLabel || (function(){ try { return formatPeriod(key); } catch { return key; } })();

  console.info('[drill] currentLevel:', currentLevel, 'nextLevel:', nextLevel, 'key(api):', normalizedKey, 'label:', label);
  loadAggregate(sensor_id, nextLevel, normalizedKey, label);
}
