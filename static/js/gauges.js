// static/js/gauges.js
// Robustní semi-gauge renderer založený na starém fungujícím kódu.
// Exportuje setGaugeValue (hlavní API) a setSemiGaugeArc (volitelně).

function getColor(value, min = 0, max = 100) {
  const v = Number.isFinite(Number(value)) ? Number(value) : NaN;
  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
  if (!Number.isFinite(v)) return '#9e9e9e';
  if (hi === lo) return v >= hi ? '#4caf50' : '#9e9e9e';
  let ratio = (v - lo) / (hi - lo);
  ratio = Math.max(0, Math.min(1, ratio));
  if (ratio < 0.33) return '#4caf50';
  if (ratio < 0.66) return '#ffeb3b';
  return '#f44336';
}

function safeSetArcAndLabels(id, value, max, min = 0, attempt = 0) {
  const arc = document.getElementById(id);
  if (!arc) return;
  try {
    const lenFn = typeof arc.getTotalLength === 'function';
    const len = lenFn ? arc.getTotalLength() : 0;
    if (!len) {
      if (attempt < 10) setTimeout(() => safeSetArcAndLabels(id, value, max, min, attempt + 1), 40);
      return;
    }

    const bg = arc.parentElement ? arc.parentElement.querySelector('.gauge-bg') : null;
    if (bg) {
      const computedBgWidth = getComputedStyle(bg).strokeWidth;
      if (computedBgWidth) {
        const px = parseFloat(computedBgWidth);
        if (!isNaN(px)) {
          arc.setAttribute('stroke-width', String(px));
          bg.setAttribute('stroke-width', String(px));
        }
      }
    }

    const v = Number.isFinite(Number(value)) ? Number(value) : 0;
    const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
    const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
    const range = (hi - lo) || 1;
    let pct = (v - lo) / range;
    pct = Math.max(0, Math.min(1, pct));

    const prevLineCap = getComputedStyle(arc).strokeLinecap || '';
    try { arc.style.strokeLinecap = 'butt'; } catch(e){}

    arc.setAttribute('stroke-dasharray', String(len));
    arc.setAttribute('stroke-dashoffset', String(Math.round(len * (1 - pct))));
    arc.style.stroke = getColor(v, lo, hi);

    setTimeout(() => {
      try { arc.style.strokeLinecap = prevLineCap || 'round'; } catch(e){}
    }, 60);

    try {
      const startPt = arc.getPointAtLength(0);
      const endPt = arc.getPointAtLength(Math.max(len - 0.1, 0));
      const minEl = document.getElementById(id + '-min');
      const maxEl = document.getElementById(id + '-max');
      if (minEl) {
        minEl.setAttribute('x', String(startPt.x));
        minEl.setAttribute('y', String(startPt.y + 6));
        minEl.textContent = String(lo);
      }
      if (maxEl) {
        maxEl.setAttribute('x', String(endPt.x));
        maxEl.setAttribute('y', String(endPt.y + 6));
        maxEl.textContent = String(hi);
      }
    } catch (e) { /* safe ignore positioning errors */ }
  } catch (err) {
    if (attempt < 10) setTimeout(() => safeSetArcAndLabels(id, value, max, min, attempt + 1), 60);
  }
}

export function setSemiGaugeArc(id, value, max, min = 0) {
  const v = Number.isFinite(Number(value)) ? Number(value) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;
  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  safeSetArcAndLabels(id, v, hi, lo);
}

export function setGaugeValue(arcId, valueId, value, min = null, max = null) {
  const valEl = document.getElementById(valueId);
  if (!valEl) {
    console.warn('[gauges] value element not found for', valueId);
    return;
  }

  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    valEl.textContent = '--';
    const arc = document.getElementById(arcId);
    if (arc) {
      try {
        const len = arc.getTotalLength();
        arc.setAttribute('stroke-dasharray', String(len));
        arc.setAttribute('stroke-dashoffset', String(len));
      } catch (e) {
        arc.style.strokeDasharray = '';
        arc.style.strokeDashoffset = '';
      }
    }
    // set min/max labels if present
    const minEl = document.getElementById(`${arcId}-min`);
    const maxEl = document.getElementById(`${arcId}-max`);
    if (minEl) minEl.textContent = (min === null || min === undefined) ? '--' : String(min);
    if (maxEl) maxEl.textContent = (max === null || max === undefined) ? '--' : String(max);
    return;
  }

  const v = Number(value);
  valEl.textContent = v.toFixed(1);

  // ensure min/max are numbers for renderer
  const lo = Number.isFinite(Number(min)) ? Number(min) : 0;
  const hi = Number.isFinite(Number(max)) ? Number(max) : 100;

  setSemiGaugeArc(arcId, v, hi, lo);
}
