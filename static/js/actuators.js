// static/js/actuators.js

const API_BASE = '/api/actuators';

function qs(id) { return document.getElementById(id); }

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function fetchWrappedJson(url, opts) {
  const res = await fetch(url, opts);
  console.debug('[fetchWrappedJson] raw response', res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text().catch(()=>null);
    throw new Error(`${res.status} ${res.statusText}${text ? ': '+text : ''}`);
  }
  const payload = await res.json();
  console.debug('[fetchWrappedJson] payload', payload);
  if (payload.error) {
    throw new Error(payload.error);
  }
  return payload.result;
}

/*
  actorForSensor vytváří jméno aktuátoru ze sensorId:
  - kind === 'led'  -> "led_<sensorId>"
  - kind === 'relay' -> "relay_<sensorId>"
  Pokud je poskytnut overrideActor (query param ?actor=...), ten má přednost.
*/
function actorForSensor(sensorId, kind = "led", overrideActor = null) {
  if (overrideActor) return overrideActor;
  if (!sensorId) return null;
  const safeKind = kind === "relay" ? "relay" : "led";
  // sanitize sensorId minimally (odstranit nežádoucí mezery)
  const sid = String(sensorId).trim();
  if (!sid) return null;
  return `${safeKind}_${sid}`;
}

async function callActorApi(actorName, method = "GET", body = null) {
  if (!actorName) throw new Error("No actor name provided");
  const url = `${API_BASE}/${encodeURIComponent(actorName)}`;
  const init = { method, headers: {} };
  if (body !== null) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  console.debug('[actuators] GET actor', actorName, method);
  return fetchWrappedJson(url, init);
}

async function callSetpointApi(actorName, method = "GET", body = null) {
  if (!actorName) throw new Error("No actor name provided for setpoint");
  const url = `${API_BASE}/${encodeURIComponent(actorName)}/setpoint`;
  const init = { method, headers: {} };
  if (body !== null) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  console.debug('[actuators] GET actor', actorName, method);
  return fetchWrappedJson(url, init);
}

async function init() {
  const ledToggle = qs('led-toggle');
  const ledStatus = qs('led-status');
  const relayOnBtn = qs('relay-on');
  const relayOffBtn = qs('relay-off');
  const relayAutoBtn = qs('relay-auto');
  const relayModeText = qs('relay-mode');
  const setpoint = qs('setpoint');
  const setpointValue = qs('setpoint-value');

  // strictly require select with id "sensor_select"
  let sensorSelect = qs('sensor_select');
  if (!sensorSelect) {
    console.error('actuators.js: required select with id "sensor_select" not found in DOM. Actuator UI disabled.');
    return; // do not proceed if required element missing
  }

  // helper: current sensor id from the required select
  function currentSensorId() {
    // query param 'actor' can override actor name, but we still require sensor_select to exist
    const override = getQueryParam('actor');
    if (override) return null;
    return sensorSelect.value || null;
  }

  function getActor(kind = "led") {
    const override = getQueryParam('actor');
    const sid = currentSensorId();
    return actorForSensor(sid, kind, override);
  }

  function setLedUI(on) {
    console.debug('[UI] setLedUI called with', on);
    if (ledStatus) {
      ledStatus.textContent = on ? 'Zapnuto' : 'Vypnuto';
      console.debug('[UI] setLedUI textContent', ledStatus.textContent);
    }else{
      console.debug('[UI] setLedUI ledStatus not exist');
    }
    if (ledToggle) {
      ledToggle.checked = !!on;
    }
  }

  function setRelayUI(mode) {
    console.debug('[UI] setRelayUI called with', mode);
    if (relayModeText) {
      relayModeText.textContent = `Režim: ${mode}`;
      console.debug('[UI] setLedUI textContent', relayModeText.textContent);
    }else{
      console.debug('[UI] setLedUI relayModeText not exist');
    }
    // ovládací tlačítka jen pokud existují
    [relayOnBtn, relayOffBtn, relayAutoBtn].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (mode === 'on' && relayOnBtn) relayOnBtn.classList.add('active');
    if (mode === 'off' && relayOffBtn) relayOffBtn.classList.add('active');
    if (mode === 'auto' && relayAutoBtn) relayAutoBtn.classList.add('active');
  }

  function setSetpointUI(v) {
    console.debug('[UI] setSetpointUI called with', v);
    if (setpointValue) {
      setpointValue.textContent = `${v} °C`;
      console.debug('[UI] setSetpointUI textContent', setpointValue.textContent);
    }else{
      console.debug('[UI] setSetpointUI setpointValue not exist');
    }
    if (setpoint) {
      setpoint.value = v;
    }
  }

  // load initial state for the sensor currently selected
  async function loadForCurrentSensor() {
    try {
      const actorLed = getActor("led");
      if (actorLed) {
        const ledState = await callActorApi(actorLed, "GET");
        console.debug('[actuators] LED actor', actorLed, 'state from API', ledState);
        if (ledState && typeof ledState.on !== 'undefined') {
          setLedUI(ledState.on);
        }
      } else {
        setLedUI(false);
      }
    } catch (e) {
      console.error('Load LED failed', e);
      setLedUI(false);
    }

    try {
      const actorRelay = getActor("relay");
      if (actorRelay) {
        const relayState = await callActorApi(actorRelay, "GET");
        console.debug('[actuators] Relay actor', actorRelay, 'state from API', relayState);
        if (relayState && relayState.mode) {
          setRelayUI(relayState.mode);
        }
      } else {
        setRelayUI('auto');
      }
    } catch (e) {
      console.error('Load relay failed for actor', actorRelay, e);
      setRelayUI('auto');
    }

    try {
      const actorRelay = getActor("relay");
      if (actorRelay) {
        const sp = await callSetpointApi(actorRelay, "GET");
        console.debug('[actuators] Setpoint actor', actorRelay, 'from API', sp);
        if (sp && typeof sp.value !== 'undefined') {
          setSetpointUI(sp.value);
        }
      } else {
        setSetpointUI(null);
      }
    } catch (e) {
      console.error('Load setpoint failed for actor', actorRelay, e);
      setSetpointUI(null);
    }
  }

  await loadForCurrentSensor();

  // event: led toggle
  if (ledToggle) {
    ledToggle.addEventListener('change', async (ev) => {
      const on = ev.target.checked;
      setLedUI(on); // optimistic
      try {
        const actor = getActor("led");
        if (!actor) throw new Error("No actor mapped for selected sensor");
        await callActorApi(actor, "POST", { on });
      } catch (err) {
        console.error('Set LED failed', err);
        setLedUI(!on); // revert
        alert('Chyba: nelze změnit stav LED');
      }
    });
  }

  // relay controls
  if (relayOnBtn) relayOnBtn.addEventListener('click', () => setRelayMode('on'));
  if (relayOffBtn) relayOffBtn.addEventListener('click', () => setRelayMode('off'));
  if (relayAutoBtn) relayAutoBtn.addEventListener('click', () => setRelayMode('auto'));

  async function setRelayMode(mode) {
    const prev = relayModeText ? relayModeText.textContent : '';
    setRelayUI(mode); // optimistic
    try {
      const actor = getActor("relay");
      if (!actor) throw new Error("No relay mapped for selected sensor");
      await callActorApi(actor, "POST", { mode });
    } catch (err) {
      console.error('Set relay failed', err);
      if (relayModeText) relayModeText.textContent = prev;
      alert('Chyba: nelze změnit režim rele');
      try {
        const actor = getActor("relay");
        if (actor) {
          const s = await callActorApi(actor, "GET");
          if (s && s.mode) setRelayUI(s.mode);
        }
      } catch (_) {}
    }
  }

  // debounce slider
  let spTimer = null;
  if (setpoint) {
    setpoint.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (setpointValue) setpointValue.textContent = `${v} °C`;
      if (spTimer) clearTimeout(spTimer);
      spTimer = setTimeout(()=> sendSetpoint(v), 600);
    });
  }

  async function sendSetpoint(value) {
    const prev = setpoint ? setpoint.value : null;
    try {
      const actor = getActor("relay");
      if (actor) {
        await callSetpointApi(actor, "POST", { value: parseFloat(value) });
      } else {
        await fetchWrappedJson(`${API_BASE}/setpoint`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ value: parseFloat(value) })
        });
      }
    } catch (err) {
      console.error('Set setpoint failed', err);
      alert('Chyba: nelze uložit setpoint');
      try {
        const actor = getActor("relay");
        if (actor) {
          const s = await callSetpointApi(actor, "GET");
          if (s && typeof s.value !== 'undefined') setSetpointUI(s.value);
          else if (setpoint) setpoint.value = prev;
        } else {
          const s = await fetchWrappedJson(`${API_BASE}/setpoint`);
          if (s && typeof s.value !== 'undefined') setSetpointUI(s.value);
          else if (setpoint) setpoint.value = prev;
        }
      } catch (_) {
        if (setpoint) setpoint.value = prev;
      }
    }
  }

  // when the required select changes, reload actor states
  sensorSelect.addEventListener('change', async (ev) => {
    await loadForCurrentSensor();
  });

  // observe DOM to detect if main.js replaces sensor_select and rebind
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        const newSelect = qs('sensor_select');
        if (newSelect && newSelect !== sensorSelect) {
          sensorSelect = newSelect;
          sensorSelect.addEventListener('change', async () => { await loadForCurrentSensor(); });
          loadForCurrentSensor().catch(e => console.error(e));
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', init);
export default {};
