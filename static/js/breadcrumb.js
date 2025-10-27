// static/js/breadcrumb.js
// Render breadcrumb with only segments up to current level.
// Exports renderBreadcrumb(container, level, key, onNavigate)

function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

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

function addSeparator(ol) {
  const sep = document.createElement('span');
  sep.className = 'breadcrumb-sep';
  sep.textContent = '›';
  ol.appendChild(sep);
}

function formatPartsFromKey(key) {
  // key expected forms: YYYY, YYYY-MM, YYYY-MM-DD, YYYY-MM-DDTHH:MM, YYYY-MM-DDTHH:MM:SS
  // return object { year, month, day, hour, minute }
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

const LEVEL_TO_SEGMENTS = {
  monthly: ['year'],
  daily: ['year','month'],
  hourly: ['year','month','day'],
  minutely: ['year','month','day','hour'],
  raw: ['year','month','day','hour','minute']
};

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
