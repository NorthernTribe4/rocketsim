// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════
const SHEET_URL = 'https://script.google.com/macros/s/AKfycbyUeJp715nu9vANzQ3XhHc3aAEMFA_HKd91QSL05eLSNlk0-NLnyECMnkiTtNX9BUn5/exec';

// ══════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════
let currentUnits   = 'metric';
let currentRating  = 0;
let lastFlightData = null;
let aiHistory      = [];

// ══════════════════════════════════════
// PARACHUTE HELPERS
// ══════════════════════════════════════
function toggleParachuteInputs() {
  const enabled = document.getElementById('use-parachute').checked;
  document.getElementById('parachute-inputs').style.display = enabled ? 'block' : 'none';
  if (enabled) autoCalculateChute();
}

function autoCalculateChute() {
  const massEl  = document.getElementById('mass');
  const massG   = parseFloat(massEl ? massEl.value : 150) || 150;
  const massKg  = currentUnits === 'imperial' ? massG * 0.0283495 : massG / 1000;
  const rho     = 1.225;
  const cd      = parseFloat(document.getElementById('chute-cd').value) || 0.75;
  const vTarget = 5.0;
  const g       = 9.81;
  const A       = (2 * massKg * g) / (rho * cd * vTarget * vTarget);
  const diam    = Math.sqrt(A * 4 / Math.PI) * 100;
  document.getElementById('chute-diameter').value = diam.toFixed(1);
  document.getElementById('chute-recommendation').innerHTML =
    `✅ Recommended diameter for ${massG}${currentUnits==='imperial'?'oz':'g'} rocket: <strong>${diam.toFixed(1)} cm</strong> — targets a safe landing speed of ~5 m/s. You can override this value above.`;
}

// ══════════════════════════════════════
// UNIT SYSTEM
// ══════════════════════════════════════
function setUnits(system) {
  currentUnits = system;
  document.getElementById('btn-metric').classList.toggle('active', system === 'metric');
  document.getElementById('btn-imperial').classList.toggle('active', system === 'imperial');
  const m = system === 'metric';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('label-mass',     m ? 'Rocket Mass (g)'       : 'Rocket Mass (oz)');
  set('label-impulse',  m ? 'Total Impulse (Ns)'    : 'Total Impulse (lbf·s)');
  set('label-burntime', 'Burn Time (s)');
  set('label-diameter', m ? 'Body Diameter (mm)'    : 'Body Diameter (in)');
  set('label-noselen',  m ? 'Nose Cone Length (mm)' : 'Nose Cone Length (in)');
  set('label-bodylen',  m ? 'Body Tube Length (mm)' : 'Body Tube Length (in)');
  set('label-finspan',  m ? 'Fin Span (mm)'         : 'Fin Span (in)');
  set('label-finroot',  m ? 'Fin Root Chord (mm)'   : 'Fin Root Chord (in)');
  set('label-fintip',   m ? 'Fin Tip Chord (mm)'    : 'Fin Tip Chord (in)');
  set('alt-unit-label', m ? '(m)'   : '(ft)');
  set('vel-unit-label', m ? '(m/s)' : '(ft/s)');
}

// ══════════════════════════════════════
// COLLAPSIBLE SECTIONS
// ══════════════════════════════════════
function toggleSection(id) {
  const body  = document.getElementById(id);
  const arrow = document.getElementById('arrow-' + id);
  if (!body) return;
  const collapsed = body.classList.toggle('collapsed');
  if (arrow) arrow.classList.toggle('collapsed', collapsed);
}

// ══════════════════════════════════════
// WEATHER
// ══════════════════════════════════════
async function fetchWeather() {
  const status = document.getElementById('weather-status');
  status.textContent = 'Fetching location...';
  if (!navigator.geolocation) { status.textContent = 'Geolocation not supported.'; return; }
  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude.toFixed(4);
    const lon = pos.coords.longitude.toFixed(4);
    status.textContent = 'Location found. Fetching weather...';
    try {
      const url  = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m&wind_speed_unit=ms`;
      const res  = await fetch(url);
      const data = await res.json();
      const c    = data.current;
      document.getElementById('temperature').value = c.temperature_2m.toFixed(1);
      document.getElementById('humidity').value    = c.relative_humidity_2m;
      document.getElementById('pressure').value    = c.surface_pressure.toFixed(0);
      document.getElementById('windspeed').value   = c.wind_speed_10m.toFixed(1);
      status.textContent = `✅ ${c.temperature_2m.toFixed(1)}°C · ${c.relative_humidity_2m}% humidity · ${c.wind_speed_10m.toFixed(1)} m/s wind`;
    } catch (e) { status.textContent = '❌ Could not fetch weather. Enter values manually.'; }
  }, () => { status.textContent = '❌ Location access denied. Enter values manually.'; });
}

// ══════════════════════════════════════
// PHYSICS HELPERS
// ══════════════════════════════════════
function calcAirDensity(tempC, humidityPct, pressureHPa, altitudeM, useHumidity, useAltitude) {
  const T    = tempC + 273.15;
  const P    = pressureHPa * 100;
  const Rd   = 287.058, Rv = 461.495;
  const pSat = 611.2 * Math.exp(17.67 * tempC / (tempC + 243.5));
  const pV   = useHumidity ? (humidityPct / 100) * pSat : 0;
  const pD   = P - pV;
  const rho  = (pD / (Rd * T)) + (pV / (Rv * T));
  return useAltitude ? rho * Math.exp(-altitudeM / 8500) : rho;
}

function calcStability(diamM, noseLenM, bodyLenM, finSpanM, finRootM, finTipM, nFins) {
  const r      = diamM / 2;
  const xNose  = noseLenM / 2;
  const cNNose = 2;
  const cNFin  = (1 + r / (finSpanM + r)) *
    (4 * nFins * Math.pow(finSpanM / diamM, 2)) /
    (1 + Math.sqrt(1 + Math.pow(2 * finSpanM / (finRootM + finTipM), 2)));
  const xFin   = noseLenM + bodyLenM - (finRootM / 3) * ((finRootM + 2 * finTipM) / (finRootM + finTipM));
  const cp     = (cNNose * xNose + cNFin * xFin) / (cNNose + cNFin);
  const cg     = (noseLenM + bodyLenM) * 0.60;
  return { cp, cg, margin: (cp - cg) / diamM, totalLen: noseLenM + bodyLenM };
}

function getMotorClass(ns) {
  if (ns<=1.25) return '1/4A'; if (ns<=2.5)  return '1/2A';
  if (ns<=5)    return 'A';    if (ns<=10)   return 'B';
  if (ns<=20)   return 'C';    if (ns<=40)   return 'D';
  if (ns<=80)   return 'E';    if (ns<=160)  return 'F';
  if (ns<=320)  return 'G';    return 'H+';
}

// ══════════════════════════════════════
// AI HELPER
// ══════════════════════════════════════
async function callAI(system, messages) {
  const response = await fetch(SHEET_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'ai', system, messages })
  });
  const data = await response.json();
  return data.reply || 'No response generated.';
}

// ══════════════════════════════════════
// SAVE DESIGN
// ══════════════════════════════════════
async function saveDesign() {
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!user) { alert('Please sign in to save designs.'); return; }
  const name = document.getElementById('design-name').value.trim();
  if (!name) { document.getElementById('save-design-status').textContent = 'Please enter a name.'; return; }
  const design = {
    name,
    mass:     document.getElementById('mass').value,
    diameter: document.getElementById('diameter').value,
    noselen:  document.getElementById('noselen').value,
    bodylen:  document.getElementById('bodylen').value,
    finspan:  document.getElementById('finspan').value,
    finroot:  document.getElementById('finroot').value,
    fintip:   document.getElementById('fintip').value,
    nfins:    document.getElementById('nfins').value,
    cd:       document.getElementById('cd').value,
    impulse:  document.getElementById('impulse').value,
    burntime: document.getElementById('burntime').value,
    savedAt:  new Date().toISOString()
  };
  try {
    const { saveUserDesign } = await import('./auth.js');
    await saveUserDesign(user.uid, design);
    document.getElementById('save-design-status').textContent = '✅ Design saved!';
    setTimeout(() => { document.getElementById('save-design-status').textContent = ''; }, 3000);
  } catch (e) {
    document.getElementById('save-design-status').textContent = '❌ Could not save.';
  }
}

// ══════════════════════════════════════
// MAIN SIMULATION
// ══════════════════════════════════════
function simulate() {
  const useDrag      = document.getElementById('factor-drag').checked;
  const useWind      = document.getElementById('factor-wind').checked;
  const useHumidity  = document.getElementById('factor-humidity').checked;
  const useAltitude  = document.getElementById('factor-altitude').checked;
  const useStability = document.getElementById('factor-stability').checked;
  const useWeather   = document.getElementById('factor-weather').checked;

  let massRaw    = parseFloat(document.getElementById('mass').value);
  let impulseRaw = parseFloat(document.getElementById('impulse').value);
  let burnTime   = parseFloat(document.getElementById('burntime').value);
  let diamRaw    = parseFloat(document.getElementById('diameter').value);
  let angleDeg   = parseFloat(document.getElementById('angle').value);
  let cd         = useDrag ? parseFloat(document.getElementById('cd').value) : 0;
  let noseLenRaw = parseFloat(document.getElementById('noselen').value);
  let bodyLenRaw = parseFloat(document.getElementById('bodylen').value);
  let finSpanRaw = parseFloat(document.getElementById('finspan').value);
  let finRootRaw = parseFloat(document.getElementById('finroot').value);
  let finTipRaw  = parseFloat(document.getElementById('fintip').value);
  let nFins      = parseInt(document.getElementById('nfins').value);
  const tempC    = useWeather ? parseFloat(document.getElementById('temperature').value) : 15;
  const humidity = parseFloat(document.getElementById('humidity').value);
  const pressure = useWeather ? parseFloat(document.getElementById('pressure').value) : 1013;
  const windSpeed= useWind    ? parseFloat(document.getElementById('windspeed').value) : 0;
  const windDir  = document.getElementById('winddir').value;
  const launchAlt= parseFloat(document.getElementById('launchalt').value);
  const noseShape= document.getElementById('noseShape') ? document.getElementById('noseShape').value : 'ogive';
  const bodyColour= document.getElementById('bodyColour') ? document.getElementById('bodyColour').value : 'orange';

  // ── Parachute settings ──
  const useChute     = document.getElementById('use-parachute') ? document.getElementById('use-parachute').checked : false;
  const chuteDiamCm  = useChute ? (parseFloat(document.getElementById('chute-diameter').value) || 30) : 0;
  const chuteCd      = useChute ? (parseFloat(document.getElementById('chute-cd').value) || 0.75) : 0;
  const chuteColour  = useChute ? (document.getElementById('chute-colour') ? document.getElementById('chute-colour').value : 'red') : 'none';
  const chuteAreaM2  = useChute ? Math.PI * Math.pow(chuteDiamCm / 200, 2) : 0;

  const imp      = currentUnits === 'imperial';
  const massKg   = imp ? massRaw    * 0.0283495 : massRaw    / 1000;
  const impNs    = imp ? impulseRaw * 4.44822   : impulseRaw;
  const diamM    = imp ? diamRaw    * 0.0254    : diamRaw    / 1000;
  const noseLenM = imp ? noseLenRaw * 0.0254    : noseLenRaw / 1000;
  const bodyLenM = imp ? bodyLenRaw * 0.0254    : bodyLenRaw / 1000;
  const finSpanM = imp ? finSpanRaw * 0.0254    : finSpanRaw / 1000;
  const finRootM = imp ? finRootRaw * 0.0254    : finRootRaw / 1000;
  const finTipM  = imp ? finTipRaw  * 0.0254    : finTipRaw  / 1000;

  const g        = 9.81;
  const dt       = 0.01;
  const angleRad = angleDeg * Math.PI / 180;
  const thrust   = impNs / burnTime;
  const area     = Math.PI * Math.pow(diamM / 2, 2);
  const rhoAir   = calcAirDensity(tempC, humidity, pressure, launchAlt, useHumidity, useAltitude);

  let windVx = 0;
  if (useWind) {
    if (windDir === 'headwind')  windVx = -windSpeed * Math.cos(angleRad);
    if (windDir === 'tailwind')  windVx =  windSpeed * Math.cos(angleRad);
    if (windDir === 'crosswind') windVx =  windSpeed * 0.3;
  }

  let vx = windVx, vy = 0, x = 0, y = 0, t = 0;
  const timeData = [], altData = [], velData = [], thrustData = [];
  let maxAlt = 0, maxVel = 0, apogeeTime = 0;
  let apogeeReached = false, chuteDeployed = false;

  while (y >= 0 || t < dt) {
    const speed     = Math.sqrt(vx*vx + vy*vy);
    const thrustNow = t <= burnTime ? thrust : 0;

    // Deploy chute when rocket starts descending after burnout
    if (!apogeeReached && t > burnTime && vy < 0) {
      apogeeReached = true;
      if (useChute) chuteDeployed = true;
    }

    const rocketDrag = useDrag ? 0.5*rhoAir*cd*area*speed*speed : 0;
    const chuteDragF = chuteDeployed ? 0.5*rhoAir*chuteCd*chuteAreaM2*speed*speed : 0;
    const totalDrag  = rocketDrag + chuteDragF;

    const forceX = thrustNow*Math.cos(angleRad) - (speed>0 ? totalDrag*(vx/speed) : 0);
    const forceY = thrustNow*Math.sin(angleRad) - massKg*g - (speed>0 ? totalDrag*(vy/speed) : 0);
    vx += (forceX/massKg)*dt;
    vy += (forceY/massKg)*dt;
    x  += vx*dt; y += vy*dt; t += dt;
    if (y < 0) break;
    if (y > maxAlt) { maxAlt = y; apogeeTime = t; }
    if (speed > maxVel) maxVel = speed;
    if (Math.round(t/dt) % 10 === 0) {
      timeData.push(parseFloat(t.toFixed(2)));
      altData.push(y); velData.push(speed); thrustData.push(thrustNow);
    }
  }

  // Landing velocity (terminal velocity under chute or free-fall)
  const landingVel = useChute
    ? Math.sqrt((2 * massKg * g) / (rhoAir * chuteCd * chuteAreaM2))
    : null;
  const landSafe = landingVel ? landingVel < 7 : null;

  const totalTime  = t;
  const range      = x;
  const twr        = (thrust / (massKg * g)).toFixed(1) + ':1';
  const motorClass = getMotorClass(impNs);
  const isImp      = currentUnits === 'imperial';
  const dispAlt    = isImp ? (maxAlt*3.28084).toFixed(1) : maxAlt.toFixed(1);
  const dispVel    = isImp ? (maxVel*3.28084).toFixed(1) : maxVel.toFixed(1);
  const dispRange  = isImp ? (range*3.28084).toFixed(1)  : range.toFixed(1);
  const altUnit    = isImp ? 'ft'   : 'm';
  const velUnit    = isImp ? 'ft/s' : 'm/s';
  const rangeUnit  = isImp ? 'ft'   : 'm';
  const dispLand   = landingVel ? (isImp ? (landingVel*3.28084).toFixed(1) : landingVel.toFixed(1)) : null;

  lastFlightData = {
    maxAlt:     maxAlt.toFixed(1),
    apogeeTime: apogeeTime.toFixed(1),
    totalTime:  totalTime.toFixed(1),
    maxVel:     maxVel.toFixed(1),
    thrust:     thrust.toFixed(1),
    range:      range.toFixed(1),
    motorClass, twr,
    massKg:     massKg.toFixed(4),
    impulseNs:  impNs.toFixed(1),
    burnTime, cd,
    diamMm:     (diamM*1000).toFixed(1),
    rhoAir:     rhoAir.toFixed(4),
    tempC, windSpeed, launchAlt, angleDeg,
    factorsUsed: { useDrag, useWind, useHumidity, useAltitude, useStability, useWeather },
    parachute: useChute ? {
      enabled:    true,
      diamCm:     chuteDiamCm.toFixed(1),
      cd:         chuteCd,
      colour:     chuteColour,
      areaM2:     chuteAreaM2,
      landingVel: landingVel ? landingVel.toFixed(2) : null,
      safe:       landSafe
    } : { enabled: false },
    design: {
      noseShape,
      bodyColour,
      noseLenMm:  (noseLenM * 1000).toFixed(1),
      bodyLenMm:  (bodyLenM * 1000).toFixed(1),
      diamMm:     (diamM    * 1000).toFixed(1),
      finSpanMm:  (finSpanM * 1000).toFixed(1),
      finRootMm:  (finRootM * 1000).toFixed(1),
      finTipMm:   (finTipM  * 1000).toFixed(1),
      nFins:      nFins
    }
  };
  aiHistory = [];

  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (user) document.getElementById('save-design-bar').style.display = 'flex';

  document.getElementById('results-card').style.display = 'block';

  // Parachute result cards
  const chuteResultHtml = useChute ? `
    <div class="result-item" style="border-color:${landSafe?'rgba(63,185,80,0.4)':'rgba(255,165,0,0.4)'};">
      <div class="result-value" style="color:${landSafe?'#3fb950':'orange'}">${dispLand} ${velUnit}</div>
      <div class="result-label">Landing Speed</div>
    </div>
    <div class="result-item">
      <div class="result-value" style="font-size:14px;">${chuteDiamCm.toFixed(1)} cm</div>
      <div class="result-label">Chute Diameter</div>
    </div>
    <div class="result-item">
      <div class="result-value" style="color:${landSafe?'#3fb950':'orange'};font-size:16px;">${landSafe?'✅ Safe':'⚠️ Fast'}</div>
      <div class="result-label">Landing Safety</div>
    </div>
  ` : '';

  document.getElementById('results').innerHTML = `
    <div class="result-item"><div class="result-value">${dispAlt} ${altUnit}</div><div class="result-label">Max Altitude</div></div>
    <div class="result-item"><div class="result-value">${apogeeTime.toFixed(1)} s</div><div class="result-label">Time to Apogee</div></div>
    <div class="result-item"><div class="result-value">${totalTime.toFixed(1)} s</div><div class="result-label">Total Flight Time</div></div>
    <div class="result-item"><div class="result-value">${dispVel} ${velUnit}</div><div class="result-label">Max Velocity</div></div>
    <div class="result-item"><div class="result-value">${thrust.toFixed(1)} N</div><div class="result-label">Average Thrust</div></div>
    <div class="result-item"><div class="result-value">${dispRange} ${rangeUnit}</div><div class="result-label">Horizontal Range</div></div>
    <div class="result-item"><div class="result-value">${motorClass}</div><div class="result-label">Motor Class</div></div>
    <div class="result-item"><div class="result-value">${twr}</div><div class="result-label">Thrust-to-Weight</div></div>
    <div class="result-item"><div class="result-value">${rhoAir.toFixed(4)}</div><div class="result-label">Air Density (kg/m³)</div></div>
    <div class="result-item"><div class="result-value">${tempC}°C</div><div class="result-label">Temperature</div></div>
    <div class="result-item"><div class="result-value">${windSpeed} m/s</div><div class="result-label">Wind Speed</div></div>
    <div class="result-item"><div class="result-value">${launchAlt} m</div><div class="result-label">Launch Altitude</div></div>
    ${chuteResultHtml}
  `;

  // Parachute deployment note
  if (useChute) {
    const note = document.createElement('div');
    note.style.cssText = `margin-top:10px;padding:12px 16px;border-radius:8px;font-size:13px;background:${landSafe?'rgba(63,185,80,0.08)':'rgba(255,165,0,0.08)'};border:1px solid ${landSafe?'rgba(63,185,80,0.3)':'rgba(255,165,0,0.35)'};color:${landSafe?'#3fb950':'orange'};`;
    note.innerHTML = landSafe
      ? `🪂 Parachute deploys at apogee (${apogeeTime.toFixed(1)}s, ${parseFloat(maxAlt).toFixed(0)}m). Landing speed: <strong>${dispLand} ${velUnit}</strong> — safe for recovery.`
      : `🪂 Parachute deploys at apogee (${apogeeTime.toFixed(1)}s, ${parseFloat(maxAlt).toFixed(0)}m). Landing speed: <strong>${dispLand} ${velUnit}</strong> — consider a larger chute for safer landing.`;
    document.getElementById('results').appendChild(note);
  }

  const stabCard = document.getElementById('stability-results-card');
  if (useStability) {
    stabCard.style.display = 'block';
    const s = calcStability(diamM, noseLenM, bodyLenM, finSpanM, finRootM, finTipM, nFins);
    let cls, msg;
    if (s.margin >= 1.5)      { cls='stable';   msg=`✅ <strong>Stable</strong> — Margin: ${s.margin.toFixed(2)} cal.`; }
    else if (s.margin >= 0.5) { cls='marginal'; msg=`⚠️ <strong>Marginally Stable</strong> — Margin: ${s.margin.toFixed(2)} cal.`; }
    else                      { cls='unstable'; msg=`❌ <strong>Unstable</strong> — Margin: ${s.margin.toFixed(2)} cal.`; }
    document.getElementById('stability-result').innerHTML =
      `<div class="stability-box ${cls}">${msg}<br><br>Est. CG: ${(s.cg*1000).toFixed(0)} mm · Est. CP: ${(s.cp*1000).toFixed(0)} mm · Length: ${(s.totalLen*1000).toFixed(0)} mm</div>`;
    lastFlightData.stability = { margin: s.margin.toFixed(2), cls };
  } else { stabCard.style.display = 'none'; }

  const altDisp = isImp ? altData.map(v=>v*3.28084) : altData;
  const velDisp = isImp ? velData.map(v=>v*3.28084) : velData;
  drawGraph('canvas-alt',    timeData, altDisp,    '#ff4d1c', `Altitude (${altUnit})`);
  drawGraph('canvas-vel',    timeData, velDisp,    '#4d9fff', `Velocity (${velUnit})`);
  drawGraph('canvas-thrust', timeData, thrustData, '#ffcc00', 'Thrust (N)');

  const watchBtn = document.getElementById('watch-launch-btn');
  if (watchBtn) watchBtn.style.display = 'block';

  if (user) {
    import('./auth.js').then(({ saveSimHistory }) => {
      saveSimHistory(user.uid, lastFlightData);
    });
  }

  document.getElementById('results-card').scrollIntoView({ behavior: 'smooth' });
}

// ══════════════════════════════════════
// GRAPH DRAWING
// ══════════════════════════════════════
function drawGraph(id, xData, yData, colour, yLabel) {
  const canvas = document.getElementById(id);
  const ctx    = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top:18, right:18, bottom:38, left:55 };
  ctx.clearRect(0, 0, W, H);
  if (!xData.length) return;
  const maxX = Math.max(...xData);
  const maxY = Math.max(...yData) * 1.1 || 1;
  const toX  = x => pad.left + (x/maxX)*(W-pad.left-pad.right);
  const toY  = y => H-pad.bottom-(y/maxY)*(H-pad.top-pad.bottom);
  ctx.fillStyle = '#08080f'; ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='rgba(42,42,58,0.5)'; ctx.lineWidth=0.5;
  for (let i=0;i<=4;i++) {
    const y=pad.top+i*(H-pad.top-pad.bottom)/4;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(W-pad.right,y); ctx.stroke();
  }
  ctx.strokeStyle='#2a2a3a'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(pad.left,pad.top); ctx.lineTo(pad.left,H-pad.bottom); ctx.lineTo(W-pad.right,H-pad.bottom); ctx.stroke();
  ctx.fillStyle='#6e6e8a'; ctx.font='10px Arial'; ctx.textAlign='right';
  for (let i=0;i<=4;i++) {
    const val=maxY*(1-i/4), y=pad.top+i*(H-pad.top-pad.bottom)/4;
    ctx.fillText(val.toFixed(0), pad.left-5, y+3);
  }
  ctx.textAlign='center';
  for (let i=0;i<=4;i++) ctx.fillText((maxX*i/4).toFixed(1)+'s', toX(maxX*i/4), H-pad.bottom+14);
  ctx.beginPath();
  xData.forEach((x,i)=>i===0?ctx.moveTo(toX(x),toY(yData[i])):ctx.lineTo(toX(x),toY(yData[i])));
  ctx.lineTo(toX(xData[xData.length-1]),H-pad.bottom);
  ctx.lineTo(toX(xData[0]),H-pad.bottom);
  ctx.closePath(); ctx.fillStyle=colour+'18'; ctx.fill();
  ctx.shadowColor=colour; ctx.shadowBlur=6;
  ctx.strokeStyle=colour; ctx.lineWidth=2;
  ctx.beginPath();
  xData.forEach((x,i)=>i===0?ctx.moveTo(toX(x),toY(yData[i])):ctx.lineTo(toX(x),toY(yData[i])));
  ctx.stroke(); ctx.shadowBlur=0;
}

// ══════════════════════════════════════
// AI PANEL
// ══════════════════════════════════════
function openAI() {
  document.getElementById('aiPanel').classList.add('open');
  document.getElementById('aiOverlay').classList.add('open');
  if (lastFlightData && aiHistory.length === 0) generateAISummary();
}

function closeAI() {
  document.getElementById('aiPanel').classList.remove('open');
  document.getElementById('aiOverlay').classList.remove('open');
}

function buildSystemPrompt() {
  const d = lastFlightData;
  return `You are an expert model rocket engineer built into RocketSim by Aarush, a Year 11 student at Doha College, Qatar.
Flight data: Motor ${d.motorClass}, Impulse ${d.impulseNs}Ns, Thrust ${d.thrust}N, Burn ${d.burnTime}s, Mass ${d.massKg}kg, Diameter ${d.diamMm}mm, Cd ${d.cd}, Max Alt ${d.maxAlt}m, Apogee ${d.apogeeTime}s, Flight ${d.totalTime}s, Max Vel ${d.maxVel}m/s, Range ${d.range}m, TWR ${d.twr}, Air density ${d.rhoAir}kg/m³, Temp ${d.tempC}°C, Wind ${d.windSpeed}m/s${d.stability ? `, Stability ${d.stability.margin} cal (${d.stability.cls})` : ''}${d.parachute && d.parachute.enabled ? `, Parachute: ${d.parachute.diamCm}cm chute, landing speed ${d.parachute.landingVel}m/s (${d.parachute.safe?'safe':'fast'})` : ', No parachute'}.
Give specific data-driven advice. Be concise, under 150 words unless more is needed.`;
}

async function generateAISummary() {
  const d    = lastFlightData;
  const chat = document.getElementById('aiChat');
  document.getElementById('aiSummary').innerHTML =
    `<strong>Flight loaded</strong> — ${d.motorClass} motor · ${d.maxAlt} m altitude · ${d.twr} TWR`;
  chat.innerHTML = `<div class="ai-msg loading" id="ai-loading">Analysing your flight data...</div>`;
  const prompt = `Analyse this rocket flight in under 120 words. Cover: overall performance, one positive, one specific improvement.
Motor: ${d.motorClass}, Impulse: ${d.impulseNs}Ns, Thrust: ${d.thrust}N, Burn: ${d.burnTime}s
Mass: ${d.massKg}kg, Diameter: ${d.diamMm}mm, Cd: ${d.cd}
Max altitude: ${d.maxAlt}m, Apogee: ${d.apogeeTime}s, Total flight: ${d.totalTime}s
Max velocity: ${d.maxVel}m/s, TWR: ${d.twr}, Air density: ${d.rhoAir}kg/m³
${d.stability ? `Stability: ${d.stability.margin} cal (${d.stability.cls})` : 'Stability not checked'}
${d.parachute && d.parachute.enabled ? `Parachute: ${d.parachute.diamCm}cm diameter, landing speed ${d.parachute.landingVel}m/s (${d.parachute.safe?'safe':'potentially fast'})` : 'No parachute recovery'}`;
  try {
    const reply = await callAI('', [{ role:'user', content:prompt }]);
    aiHistory = [{ role:'assistant', content:reply }];
    document.getElementById('ai-loading').remove();
    chat.innerHTML  = `<div class="ai-msg assistant">${reply.replace(/\n/g,'<br>')}</div>`;
    chat.innerHTML += `<div class="ai-msg assistant" style="font-size:11px;opacity:0.6;">💡 Try: "How do I get higher altitude?" · "Is my motor right?" · "How can I improve stability?"</div>`;
    chat.scrollTop  = chat.scrollHeight;
    const user = window.getCurrentUser ? window.getCurrentUser() : null;
    if (user) {
      import('./auth.js').then(({ saveAIChat }) => {
        saveAIChat(user.uid, { flightData: lastFlightData, firstReply: reply, savedAt: new Date().toISOString() });
      });
    }
  } catch (e) {
    document.getElementById('ai-loading').remove();
    chat.innerHTML = `<div class="ai-msg assistant">Could not connect to AI. Check your API key in Apps Script and redeploy.</div>`;
  }
}

async function sendAI() {
  if (!lastFlightData) return;
  const input = document.getElementById('aiInput');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = '';
  const chat = document.getElementById('aiChat');
  aiHistory.push({ role:'user', content:msg });
  chat.innerHTML += `<div class="ai-msg user">${msg}</div>`;
  chat.innerHTML += `<div class="ai-msg loading" id="ai-loading">Thinking...</div>`;
  chat.scrollTop  = chat.scrollHeight;
  try {
    const reply = await callAI(buildSystemPrompt(), aiHistory);
    aiHistory.push({ role:'assistant', content:reply });
    document.getElementById('ai-loading').remove();
    chat.innerHTML += `<div class="ai-msg assistant">${reply.replace(/\n/g,'<br>')}</div>`;
    chat.scrollTop  = chat.scrollHeight;
  } catch (e) {
    document.getElementById('ai-loading').remove();
    chat.innerHTML += `<div class="ai-msg assistant">Error contacting AI. Please try again.</div>`;
  }
}

// ══════════════════════════════════════
// FEEDBACK
// ══════════════════════════════════════
function setRating(n) {
  currentRating = n;
  document.querySelectorAll('.star-btn').forEach((btn,i)=>btn.classList.toggle('active',i<n));
  const labels=['','Poor','Fair','Good','Very Good','Excellent'];
  const el=document.getElementById('rating-label');
  if (el) el.textContent=labels[n];
}

async function submitFeedback() {
  const name      = document.getElementById('fb-name').value.trim() || 'Anonymous';
  const usedFor   = document.getElementById('fb-usedfor').value;
  const comments  = document.getElementById('fb-comments').value.trim();
  const recommend = document.querySelector('input[name="recommend"]:checked')?.value || 'Not answered';
  const status    = document.getElementById('fb-status');
  if (!currentRating) { status.style.color='#ff4d1c'; status.textContent='Please select a star rating.'; return; }
  if (!usedFor)        { status.style.color='#ff4d1c'; status.textContent='Please select what you used RocketSim for.'; return; }
  status.style.color='var(--muted)'; status.textContent='Submitting...';
  fetch(SHEET_URL, {
    method:'POST', mode:'no-cors',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ type:'feedback', name, rating:currentRating, usedFor, comments, recommend })
  });
  setTimeout(() => {
    status.style.color='var(--green)';
    status.textContent='✅ Thank you! Your feedback has been submitted successfully.';
    document.getElementById('fb-name').value='';
    document.getElementById('fb-comments').value='';
    document.getElementById('fb-usedfor').value='';
    document.querySelectorAll('input[name="recommend"]').forEach(r=>r.checked=false);
    setRating(0);
  }, 1200);
}

// ══════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════
async function loadDashboard() {
  const container = document.getElementById('dash-responses');
  if (!container) return;
  container.innerHTML='<p style="color:var(--muted);font-size:13px;">Loading...</p>';
  try {
    const res  = await fetch(SHEET_URL);
    const data = await res.json();
    const rows = data.filter(r=>r.Timestamp);
    const total     = rows.length;
    const avgRating = total ? (rows.reduce((s,r)=>s+Number(r.Rating||0),0)/total).toFixed(1) : '—';
    const recYes    = rows.filter(r=>r['Would Recommend']==='Yes').length;
    const recPct    = total ? Math.round((recYes/total)*100)+'%' : '—';
    const setEl = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
    setEl('dash-total',total); setEl('dash-avg-rating',avgRating+' / 5'); setEl('dash-recommend',recPct);
    if (!total) { container.innerHTML='<p style="color:var(--muted);font-size:13px;">No responses yet.</p>'; return; }
    container.innerHTML=[...rows].reverse().map(r=>`
      <div class="dash-response">
        <div class="dash-response-header"><span class="dash-name">${r.Name||'Anonymous'}</span><span class="dash-meta">${r.Timestamp} · ${r['Used For']||'—'} · Recommend: ${r['Would Recommend']||'—'}</span></div>
        <div class="dash-stars">${'★'.repeat(Number(r.Rating||0))}${'☆'.repeat(5-Number(r.Rating||0))}</div>
        <div class="dash-comment">${r.Comments||'No comment left.'}</div>
      </div>`).join('');
  } catch(e) { container.innerHTML='<p style="color:var(--accent);font-size:13px;">Failed to load.</p>'; }
}

// ══════════════════════════════════════
// INLINE VISUALISER
// ══════════════════════════════════════
let vizFlightData  = null;
let vizFlightPts   = [];
let vizN           = 0;
let vizIdx         = 0;
let vizPlaying     = false;
let vizSpeed       = 1;
let vizRafId       = null;
let vizLastTs      = null;
let vizTimeAcc     = 0;
let vizCdActive    = false;
let vizCanvas      = null;
let vizCtx         = null;
let camY           = 0;
let camYTarget     = 0;
let camZoom        = 1;
let camZoomTarget  = 1;

function openVisualiser() {
  if (!lastFlightData) { alert('Please run a simulation first.'); return; }

  vizFlightData = lastFlightData;
  vizFlightPts  = buildVizFlight();
  vizN          = vizFlightPts.length;

  document.getElementById('viz-maxalt').textContent = parseFloat(vizFlightData.maxAlt).toFixed(1);
  document.getElementById('viz-cd-motor').textContent =
    `Motor: ${vizFlightData.motorClass} · Thrust: ${vizFlightData.thrust} N · Burn: ${vizFlightData.burnTime} s${vizFlightData.parachute && vizFlightData.parachute.enabled ? ` · 🪂 ${vizFlightData.parachute.diamCm}cm chute` : ''}`;

  document.getElementById('sim-content').style.display = 'none';
  const footer = document.getElementById('sim-footer');
  if (footer) footer.style.display = 'none';

  const overlay = document.getElementById('viz-overlay');
  overlay.style.display = 'flex';

  vizCanvas = document.getElementById('viz-canvas');
  vizCtx    = vizCanvas.getContext('2d');

  vizIdx=0; vizPlaying=false; vizTimeAcc=0; vizLastTs=null; vizCdActive=false;
  camY=0; camYTarget=0; camZoom=1; camZoomTarget=1;

  document.getElementById('viz-play-btn').textContent = '▶ Play';
  setVizPhase('ready');
  document.querySelectorAll('.viz-etag').forEach(e => e.classList.remove('show'));
  document.getElementById('viz-summary').style.display = 'none';

  const cd = document.getElementById('viz-countdown');
  cd.style.opacity='1'; cd.style.pointerEvents='auto'; cd.style.display='flex';

  setTimeout(() => { vizResizeCanvas(); vizRenderFrame(0); }, 100);
}

function closeVisualiser() {
  vizPlaying = false;
  if (vizRafId) cancelAnimationFrame(vizRafId);
  document.getElementById('viz-overlay').style.display  = 'none';
  document.getElementById('sim-content').style.display  = 'block';
  const footer = document.getElementById('sim-footer');
  if (footer) footer.style.display = 'block';
}

function vizResizeCanvas() {
  const wrap = document.getElementById('viz-canvas-wrap');
  if (!wrap) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (W < 10 || H < 10) return;
  vizCanvas.width=W; vizCanvas.height=H;
  vizCanvas.style.width=W+'px'; vizCanvas.style.height=H+'px';
}

window.addEventListener('resize', () => {
  const overlay = document.getElementById('viz-overlay');
  if (overlay && overlay.style.display !== 'none') { vizResizeCanvas(); vizRenderFrame(vizIdx); }
});

// ── Build flight trajectory WITH parachute physics ──
function buildVizFlight() {
  const dt      = 0.02;
  const g       = 9.81;
  const rho     = 1.225;
  const maxAlt  = parseFloat(vizFlightData.maxAlt);
  const thrust  = parseFloat(vizFlightData.thrust);
  const burnT   = parseFloat(vizFlightData.burnTime);
  const totalT  = parseFloat(vizFlightData.totalTime);
  const massKg  = parseFloat(vizFlightData.massKg);
  const cd      = parseFloat(vizFlightData.cd) || 0.75;
  const diamM   = parseFloat(vizFlightData.diamMm) / 1000;
  const angleDeg= parseFloat(vizFlightData.angleDeg) || 90;
  const area    = Math.PI * Math.pow(diamM / 2, 2);
  const angleRad= angleDeg * Math.PI / 180;

  // Parachute
  const chute       = vizFlightData.parachute || { enabled: false };
  const chuteAreaM2 = chute.enabled ? Math.PI * Math.pow(parseFloat(chute.diamCm) / 200, 2) : 0;
  const chuteCd     = chute.enabled ? parseFloat(chute.cd) : 0;

  let vx=0, vy=0, x=0, y=0, t=0;
  let apogeeReached=false, chuteDeployed=false;
  const pts = [];

  while (true) {
    const thrustNow = t <= burnT ? thrust : 0;
    const spd       = Math.sqrt(vx*vx + vy*vy);

    if (!apogeeReached && t > burnT && vy < 0) {
      apogeeReached = true;
      if (chute.enabled) chuteDeployed = true;
    }

    const rocketDrag = 0.5*rho*cd*area*spd*spd;
    const chuteDragF = chuteDeployed ? 0.5*rho*chuteCd*chuteAreaM2*spd*spd : 0;
    const totalDrag  = rocketDrag + chuteDragF;

    const fx = thrustNow*Math.cos(angleRad) - (spd>0 ? totalDrag*(vx/spd) : 0);
    const fy = thrustNow*Math.sin(angleRad) - massKg*g - (spd>0 ? totalDrag*(vy/spd) : 0);
    const ax=fx/massKg, ay=fy/massKg;
    vx+=ax*dt; vy+=ay*dt; x+=vx*dt; y+=vy*dt; t+=dt;

    pts.push({
      t:             parseFloat(t.toFixed(3)),
      y:             Math.max(y, 0),
      x,
      vel:           Math.sqrt(vx*vx + vy*vy),
      thrust:        thrustNow,
      accel:         Math.sqrt(ax*ax + ay*ay),
      chuteDeployed: chuteDeployed
    });

    if (y < 0 && t > burnT + 0.5) { pts[pts.length-1].y = 0; break; }
    if (t > 600) break;
  }

  const rawMax  = Math.max(...pts.map(p => p.y)) || 1;
  const rawTime = pts[pts.length-1].t || 1;
  const aScale  = maxAlt / rawMax;
  const tScale  = totalT / rawTime;

  return pts.map(p => ({
    t:             p.t * tScale,
    y:             p.y * aScale,
    x:             p.x * aScale * 0.3,
    vel:           p.vel,
    thrust:        p.thrust,
    accel:         p.accel,
    chuteDeployed: p.chuteDeployed
  }));
}

// ── Countdown ──
function vizStartCountdown() {
  vizCdActive = true;
  const cd=document.getElementById('viz-countdown');
  const numEl=document.getElementById('viz-cd-num');
  const lblEl=document.getElementById('viz-cd-label');
  const fill=document.getElementById('viz-cd-fill');
  cd.style.opacity='1'; cd.style.pointerEvents='auto'; cd.style.display='flex';

  const steps=[
    {num:'5',lbl:'T-MINUS',w:'100%'},{num:'4',lbl:'T-MINUS',w:'80%'},
    {num:'3',lbl:'T-MINUS',w:'60%'},{num:'2',lbl:'T-MINUS',w:'40%'},
    {num:'1',lbl:'T-MINUS',w:'20%'},{num:'🔥',lbl:'IGNITION',w:'0%'},
  ];
  let i=0;
  function tick() {
    if (i>=steps.length) {
      cd.style.opacity='0'; cd.style.pointerEvents='none';
      setTimeout(()=>{ cd.style.display='none'; },500);
      vizCdActive=false; setTimeout(vizBeginFlight,600); return;
    }
    const s=steps[i];
    numEl.textContent=s.num; lblEl.textContent=s.lbl; fill.style.width=s.w;
    numEl.style.transform='scale(1.2)'; setTimeout(()=>{ numEl.style.transform='scale(1)'; },150);
    i++; setTimeout(tick,i===steps.length?600:900);
  }
  tick();
}

function vizBeginFlight() {
  vizPlaying=true; vizIdx=0; vizTimeAcc=0; vizLastTs=null;
  document.getElementById('viz-play-btn').textContent='⏸ Pause';
  vizRafId=requestAnimationFrame(vizAnimLoop);
}

// ── Animation loop ──
function vizAnimLoop(ts) {
  if (!vizPlaying) return;
  if (vizLastTs===null) vizLastTs=ts;
  const wallDt=(ts-vizLastTs)/1000; vizLastTs=ts; vizTimeAcc+=wallDt*vizSpeed;
  while (vizIdx<vizN-1 && vizFlightPts[vizIdx].t<vizTimeAcc) vizIdx++;
  vizUpdateCamera(vizIdx); vizRenderFrame(vizIdx); vizUpdateHUD(vizIdx);
  if (vizIdx>=vizN-1) {
    vizPlaying=false;
    document.getElementById('viz-play-btn').textContent='▶ Replay';
    setVizPhase('landed'); vizShowTag('viz-tag-landed');
    setTimeout(vizShowSummary,1400); return;
  }
  vizRafId=requestAnimationFrame(vizAnimLoop);
}

// ── Camera ──
function vizUpdateCamera(idx) {
  const p=vizFlightPts[idx];
  const maxAlt=parseFloat(vizFlightData.maxAlt);
  const burnT=parseFloat(vizFlightData.burnTime);
  const totalT=parseFloat(vizFlightData.totalTime);
  const altFrac=p.y/maxAlt;
  camYTarget=p.y;
  if (p.t<0.3)                              camZoomTarget=0.35;
  else if (p.t<burnT+1.5)                   camZoomTarget=1.0;
  else if (altFrac>0.65)                    camZoomTarget=0.55;
  else if (p.y<maxAlt*0.1&&p.t>totalT*0.5) camZoomTarget=1.0;
  camY    += (camYTarget    - camY)    * 0.07;
  camZoom += (camZoomTarget - camZoom) * 0.04;
}

// ── HUD ──
function vizUpdateHUD(idx) {
  const p=vizFlightPts[idx];
  document.getElementById('viz-alt').textContent    = p.y.toFixed(1);
  document.getElementById('viz-vel').textContent    = p.vel.toFixed(1);
  document.getElementById('viz-thrust').textContent = p.thrust.toFixed(1);
  document.getElementById('viz-time').textContent   = p.t.toFixed(2);
  document.getElementById('viz-accel').textContent  = p.accel.toFixed(1);

  const burnT=parseFloat(vizFlightData.burnTime);
  const apogeeT=parseFloat(vizFlightData.apogeeTime);
  if      (p.thrust>0)   setVizPhase('launch');
  else if (p.t<apogeeT)  setVizPhase('coast');
  else if (p.y>0.5)      setVizPhase(p.chuteDeployed ? 'chute' : 'descent');

  const prevT=idx>0?vizFlightPts[idx-1].t:0;
  if (prevT<burnT   && p.t>=burnT)   vizShowTag('viz-tag-burnout');
  if (prevT<apogeeT && p.t>=apogeeT) vizShowTag('viz-tag-apogee');

  // Show chute deploy tag
  const prevChute = idx>0 ? vizFlightPts[idx-1].chuteDeployed : false;
  if (!prevChute && p.chuteDeployed) vizShowTag('viz-tag-chute');
}

function setVizPhase(phase) {
  const el=document.getElementById('viz-phase');
  if (!el) return;
  const map={
    launch:  ['phase-launch',  '🔥 Motor Burning'],
    coast:   ['phase-coast',   '🚀 Coasting Up'],
    descent: ['phase-descent', '⬇️ Descending'],
    chute:   ['phase-coast',   '🪂 Chute Deployed'],
    landed:  ['phase-landed',  '✅ Landed'],
    ready:   ['phase-ready',   'Ready']
  };
  el.className  = 'viz-phase-badge '+(map[phase]||map.ready)[0];
  el.textContent= (map[phase]||map.ready)[1];
}

function vizShowTag(id) {
  const el=document.getElementById(id);
  if (el) el.classList.add('show');
}

// ── Colour helpers ──
function getRocketColours(colourName) {
  const palettes = {
    orange: { body1:'#7a1c06', body2:'#ff4d1c', body3:'#c0390e', fin:'#9a2808', nose:'#ff4d1c', accent:'#ff7043' },
    white:  { body1:'#aaaaaa', body2:'#f0f0f0', body3:'#cccccc', fin:'#888888', nose:'#e8e8e8', accent:'#ffffff' },
    black:  { body1:'#0a0a0a', body2:'#2a2a2a', body3:'#181818', fin:'#0a0a0a', nose:'#222222', accent:'#444444' },
    blue:   { body1:'#0a2060', body2:'#1a50ee', body3:'#0a38bb', fin:'#082070', nose:'#1a50ee', accent:'#3070ff' },
    silver: { body1:'#445566', body2:'#aabbcc', body3:'#778899', fin:'#556677', nose:'#99aabb', accent:'#bbccdd' },
  };
  return palettes[colourName] || palettes.orange;
}

function getChuteColours(name) {
  const map = {
    red:    { main:'#ff2222', alt:'#ffffff' },
    orange: { main:'#ff6600', alt:'#ffffff' },
    yellow: { main:'#ffcc00', alt:'#ff4400' },
    green:  { main:'#22aa44', alt:'#ffffff' },
    blue:   { main:'#1166ff', alt:'#ffffff' },
    white:  { main:'#f0f0f0', alt:'#cccccc' },
    pink:   { main:'#ff66aa', alt:'#ffffff' },
  };
  return map[name] || map.red;
}

// ── Main render ──
function vizRenderFrame(idx) {
  if (!vizCanvas || !vizCtx) return;
  const W=vizCanvas.width, H=vizCanvas.height;
  if (W<10||H<10) return;

  const ctx     = vizCtx;
  const maxAlt  = parseFloat(vizFlightData.maxAlt);
  const THRUST  = parseFloat(vizFlightData.thrust);
  const burnT   = parseFloat(vizFlightData.burnTime);
  const apogeeT = parseFloat(vizFlightData.apogeeTime);
  const p       = vizFlightPts[Math.min(idx,vizN-1)];
  const altFrac = p.y/maxAlt;

  ctx.clearRect(0,0,W,H);

  const SCALE   = (H*0.55)/maxAlt*camZoom;
  const groundPx= H*0.82;
  const cx      = W/2;

  const toScreenY = (wy) => groundPx-(wy-camY)*SCALE;
  const toScreenX = (wx) => cx+wx*SCALE;

  const rScrY = toScreenY(p.y);
  const rScrX = toScreenX(p.x);

  // ── Sky ──
  const skyR=Math.max(3,Math.round(12-altFrac*10));
  const skyG=Math.max(5,Math.round(20-altFrac*17));
  const skyB=Math.max(15,Math.round(58+altFrac*55));
  const sky=ctx.createLinearGradient(0,0,0,H);
  sky.addColorStop(0,`rgb(${skyR},${skyG},${skyB})`);
  sky.addColorStop(0.55,`rgb(${skyR+3},${skyG+4},${Math.max(10,skyB-30)})`);
  sky.addColorStop(1,'#030310');
  ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

  // ── Stars ──
  if (altFrac>0.12) {
    const op=Math.min((altFrac-0.12)*2.8,0.95);
    for (let i=0;i<120;i++) {
      const bri=(Math.sin(i*0.7+Date.now()*0.0003)*0.15+0.85)*op;
      ctx.fillStyle=`rgba(255,255,255,${bri})`;
      ctx.beginPath(); ctx.arc((i*173.7+50)%W,(i*97.3+15)%(H*0.85),i%6===0?1.3:i%3===0?0.9:0.5,0,Math.PI*2); ctx.fill();
    }
  }

  // ── Clouds ──
  const cloudDefs=[
    {alt:maxAlt*0.05,opacity:0.20,scale:1.0},
    {alt:maxAlt*0.14,opacity:0.16,scale:0.85},
    {alt:maxAlt*0.25,opacity:0.12,scale:0.7},
  ];
  cloudDefs.forEach(cl=>{
    const cScrY=toScreenY(cl.alt);
    if (cScrY<-60||cScrY>H+60) return;
    const fade=Math.max(0,1-altFrac*3)*cl.opacity;
    if (fade<=0.005) return;
    ctx.fillStyle=`rgba(210,225,240,${fade})`;
    const cw=W*cl.scale;
    [[cx-cw*0.32,cScrY,cw*0.20,20*cl.scale],[cx+cw*0.12,cScrY+14,cw*0.22,18*cl.scale],
     [cx-cw*0.06,cScrY-10,cw*0.16,15*cl.scale],[cx+cw*0.35,cScrY-5,cw*0.18,16*cl.scale]].forEach(([ex,ey,ew,eh])=>{
      ctx.beginPath(); ctx.ellipse(ex,ey,ew,eh,0,0,Math.PI*2); ctx.fill();
    });
  });

  // ── Ground ──
  const gScrY=toScreenY(0);
  if (gScrY<H+60) {
    const drawGY=Math.min(gScrY,H);
    const gg=ctx.createLinearGradient(0,drawGY,0,H);
    gg.addColorStop(0,'#1a2a14'); gg.addColorStop(0.3,'#142010'); gg.addColorStop(1,'#080c08');
    ctx.fillStyle=gg; ctx.fillRect(0,drawGY,W,H-drawGY+2);
    ctx.strokeStyle='#2a4020'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(0,gScrY); ctx.lineTo(W,gScrY); ctx.stroke();
    const hg=ctx.createLinearGradient(0,gScrY-40,0,gScrY);
    hg.addColorStop(0,'rgba(30,60,20,0)'); hg.addColorStop(1,'rgba(40,90,25,0.25)');
    ctx.fillStyle=hg; ctx.fillRect(0,gScrY-40,W,40);
  }

  // ── Launch pad ──
  const padScrY=toScreenY(0);
  if (padScrY<H+40&&padScrY>-40) {
    const ps=Math.min(1,Math.max(0.3,camZoom));
    ctx.fillStyle='#1c1c1c'; ctx.fillRect(cx-36*ps,padScrY,72*ps,10*ps);
    ctx.fillStyle='#252525';
    ctx.beginPath(); ctx.moveTo(cx-20*ps,padScrY); ctx.lineTo(cx+20*ps,padScrY);
    ctx.lineTo(cx+40*ps,padScrY+30*ps); ctx.lineTo(cx-40*ps,padScrY+30*ps); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#333'; ctx.lineWidth=3*ps;
    ctx.beginPath(); ctx.moveTo(cx,padScrY); ctx.lineTo(cx,padScrY-50*ps); ctx.stroke();
    ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=2*ps;
    [[-36,10,-20,0],[36,10,20,0]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(cx+x1*ps,padScrY+y1*ps); ctx.lineTo(cx+x2*ps,padScrY+y2*ps); ctx.stroke();
    });
    ctx.strokeStyle='#2a2a30'; ctx.lineWidth=2*ps;
    const gx=cx+55*ps;
    ctx.beginPath(); ctx.moveTo(gx,padScrY+10*ps); ctx.lineTo(gx,padScrY-120*ps); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx-12*ps,padScrY+10*ps); ctx.lineTo(gx-12*ps,padScrY-120*ps); ctx.stroke();
    for (let i=0;i<6;i++) { const ry=padScrY-i*20*ps; ctx.beginPath(); ctx.moveTo(gx-12*ps,ry); ctx.lineTo(gx,ry); ctx.stroke(); }
    ctx.strokeStyle='#333'; ctx.lineWidth=2*ps;
    ctx.beginPath(); ctx.moveTo(gx,padScrY-60*ps); ctx.lineTo(cx+8*ps,padScrY-60*ps); ctx.stroke();
    if (p.thrust>0&&p.y<maxAlt*0.06) {
      const tf=p.thrust/THRUST;
      const pg=ctx.createRadialGradient(cx,padScrY,0,cx,padScrY,(90+tf*70)*ps);
      pg.addColorStop(0,`rgba(255,130,20,${0.4*tf})`); pg.addColorStop(0.4,`rgba(255,60,5,${0.2*tf})`); pg.addColorStop(1,'rgba(255,30,0,0)');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.ellipse(cx,padScrY,(90+tf*70)*ps,(35+tf*25)*ps,0,0,Math.PI*2); ctx.fill();
    }
  }

  // ── Ghost trajectory ──
  ctx.strokeStyle='rgba(255,77,28,0.10)'; ctx.lineWidth=1.5; ctx.setLineDash([5,9]);
  ctx.beginPath();
  vizFlightPts.forEach((fp,i)=>{ const fy=toScreenY(fp.y),fx=toScreenX(fp.x); i===0?ctx.moveTo(fx,fy):ctx.lineTo(fx,fy); });
  ctx.stroke(); ctx.setLineDash([]);

  // ── Completed path ──
  for (let i=1;i<=Math.min(idx,vizN-1);i++) {
    const prev=vizFlightPts[i-1],curr=vizFlightPts[i];
    const py=toScreenY(prev.y),cy2=toScreenY(curr.y);
    const px=toScreenX(prev.x),cx2=toScreenX(curr.x);
    ctx.strokeStyle = curr.thrust>0?'rgba(255,77,28,0.65)':curr.chuteDeployed?'rgba(63,185,80,0.55)':curr.t<apogeeT?'rgba(77,159,255,0.55)':'rgba(63,185,80,0.55)';
    ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(cx2,cy2); ctx.stroke();
  }

  // ── Smoke trail ──
  if (p.thrust>0&&idx>0) {
    const tLen=Math.min(idx,45);
    for (let i=Math.max(0,idx-tLen);i<idx;i++) {
      const tp=vizFlightPts[i]; const tScrY=toScreenY(tp.y); const tScrX=toScreenX(tp.x);
      const age=(idx-i)/tLen; const r=(3+age*16)*camZoom; const drift=(i%11-5)*age*2.5;
      ctx.beginPath(); ctx.arc(tScrX+drift,tScrY,r,0,Math.PI*2);
      ctx.fillStyle=`rgba(155,145,130,${(1-age)*0.18})`; ctx.fill();
    }
  }

  // ── Vapour trail ──
  if (p.thrust===0&&!p.chuteDeployed&&p.y>2&&idx>0) {
    const tLen=Math.min(idx,90);
    ctx.strokeStyle='rgba(140,165,200,0.08)'; ctx.lineWidth=1.5; ctx.setLineDash([3,9]);
    ctx.beginPath();
    for (let i=Math.max(0,idx-tLen);i<=idx;i++) {
      const tp=vizFlightPts[i]; const ty=toScreenY(tp.y),tx=toScreenX(tp.x);
      i===Math.max(0,idx-tLen)?ctx.moveTo(tx,ty):ctx.lineTo(tx,ty);
    }
    ctx.stroke(); ctx.setLineDash([]);
  }

  // ── Flame ──
  if (p.thrust>0) {
    const tf=p.thrust/THRUST;
    const fH=(22+tf*36)*camZoom, fW=(5+tf*7)*camZoom, fCY=rScrY+15*camZoom;
    const og=ctx.createRadialGradient(rScrX,fCY+fH*0.4,0,rScrX,fCY+fH*0.4,fH);
    og.addColorStop(0,'rgba(255,200,40,0.98)'); og.addColorStop(0.25,'rgba(255,130,15,0.85)');
    og.addColorStop(0.6,'rgba(255,60,5,0.5)'); og.addColorStop(1,'rgba(255,30,0,0)');
    ctx.fillStyle=og; ctx.beginPath(); ctx.ellipse(rScrX,fCY+fH*0.45,fW,fH,0,0,Math.PI*2); ctx.fill();
    const cg=ctx.createRadialGradient(rScrX,fCY+fH*0.25,0,rScrX,fCY+fH*0.25,fH*0.5);
    cg.addColorStop(0,'rgba(255,255,220,1)'); cg.addColorStop(0.4,'rgba(255,220,70,0.8)'); cg.addColorStop(1,'rgba(255,100,10,0)');
    ctx.fillStyle=cg; ctx.beginPath(); ctx.ellipse(rScrX,fCY+fH*0.28,fW*0.4,fH*0.42,0,0,Math.PI*2); ctx.fill();
  }

  // ── Parachute (drawn before rocket so rocket appears below chute) ──
  if (p.chuteDeployed && vizFlightData.parachute && vizFlightData.parachute.enabled) {
    vizDrawParachute(ctx, rScrX, rScrY, camZoom, vizFlightData.parachute.colour || 'red');
  }

  // ── Ejection charge flash at deployment moment ──
  const prevP = idx>0 ? vizFlightPts[idx-1] : null;
  if (prevP && !prevP.chuteDeployed && p.chuteDeployed) {
    const flash=ctx.createRadialGradient(rScrX,rScrY,0,rScrX,rScrY,50*camZoom);
    flash.addColorStop(0,'rgba(255,230,100,0.85)');
    flash.addColorStop(0.5,'rgba(255,160,30,0.4)');
    flash.addColorStop(1,'rgba(255,100,0,0)');
    ctx.fillStyle=flash; ctx.beginPath(); ctx.arc(rScrX,rScrY,50*camZoom,0,Math.PI*2); ctx.fill();
  }

  // ── Rocket body ──
  vizDrawRocket(ctx, rScrX, rScrY, camZoom);

  // ── Altitude readout ──
  ctx.font=`bold ${Math.max(10,12*camZoom)}px Arial`;
  ctx.fillStyle='rgba(255,77,28,0.85)'; ctx.textAlign='left';
  ctx.fillText(p.y.toFixed(0)+'m', rScrX+18*camZoom, rScrY-5*camZoom);
  ctx.fillStyle='rgba(77,159,255,0.7)';
  ctx.fillText(p.vel.toFixed(0)+'m/s', rScrX+18*camZoom, rScrY+10*camZoom);
  if (p.chuteDeployed) {
    ctx.fillStyle='rgba(63,185,80,0.8)';
    ctx.fillText('🪂', rScrX+18*camZoom, rScrY+24*camZoom);
  }

  // ── Scale bar ──
  const barM=Math.pow(10,Math.floor(Math.log10(maxAlt*0.15)))||10;
  const barPx=barM*SCALE, bx=20, by=H-20;
  ctx.strokeStyle='rgba(110,110,138,0.6)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+barPx,by); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx,by-4); ctx.lineTo(bx,by+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx+barPx,by-4); ctx.lineTo(bx+barPx,by+4); ctx.stroke();
  ctx.fillStyle='rgba(110,110,138,0.8)'; ctx.font='10px Arial'; ctx.textAlign='left';
  ctx.fillText(barM+'m', bx, by-8);
}

// ── Draw parachute canopy ──
function vizDrawParachute(ctx, cx, rocketTop, zoom, colour) {
  const chuteW  = (55+10*zoom)*zoom;
  const chuteH  = chuteW*0.55;
  const chuteY  = rocketTop-12*zoom-chuteH;
  const colours = getChuteColours(colour);

  // Rigging lines
  const lineCount=6;
  ctx.strokeStyle='rgba(220,220,220,0.55)'; ctx.lineWidth=0.7;
  for (let i=0;i<lineCount;i++) {
    const lx=cx-chuteW/2+(chuteW/(lineCount-1))*i;
    ctx.beginPath(); ctx.moveTo(lx,chuteY+chuteH*0.8); ctx.lineTo(cx,rocketTop-4*zoom); ctx.stroke();
  }

  // Canopy panels — alternating colours
  const panelCount=8;
  for (let i=0;i<panelCount;i++) {
    const startAngle=Math.PI+(Math.PI/panelCount)*i;
    const endAngle=Math.PI+(Math.PI/panelCount)*(i+1);
    ctx.fillStyle=i%2===0?colours.main:colours.alt;
    ctx.beginPath();
    ctx.moveTo(cx,chuteY+chuteH*0.85);
    ctx.arc(cx,chuteY+chuteH*0.85,chuteW/2,startAngle,endAngle);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.2)'; ctx.lineWidth=0.5; ctx.stroke();
  }

  // Canopy sheen
  const sheen=ctx.createRadialGradient(cx-chuteW*0.15,chuteY+chuteH*0.3,0,cx,chuteY+chuteH*0.5,chuteW*0.5);
  sheen.addColorStop(0,'rgba(255,255,255,0.2)');
  sheen.addColorStop(0.5,'rgba(255,255,255,0.06)');
  sheen.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=sheen;
  ctx.beginPath(); ctx.arc(cx,chuteY+chuteH*0.85,chuteW/2,Math.PI,Math.PI*2); ctx.closePath(); ctx.fill();

  // Vent hole
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.arc(cx,chuteY+chuteH*0.85-chuteW/2,chuteW*0.06,0,Math.PI*2); ctx.fill();
}

// ── Draw rocket from design params ──
function vizDrawRocket(ctx, cx, cy, zoom) {
  const d=vizFlightData&&vizFlightData.design;
  if (!d) { vizDrawDefaultRocket(ctx,cx,cy,zoom); return; }

  const colours  = getRocketColours(d.bodyColour||'orange');
  const pixDiam  = Math.max(10,18*zoom);
  const halfW    = pixDiam/2;
  const dimScale = pixDiam/parseFloat(d.diamMm);
  const noseH    = parseFloat(d.noseLenMm)*dimScale;
  const bodyH    = parseFloat(d.bodyLenMm)*dimScale;
  const finSpan  = parseFloat(d.finSpanMm)*dimScale;
  const finRoot  = parseFloat(d.finRootMm)*dimScale;
  const finTip   = parseFloat(d.finTipMm)*dimScale;
  const nFins    = parseInt(d.nFins)||3;

  const finTopY=cy+bodyH-finRoot, finBotY=cy+bodyH, offset=(finRoot-finTip)/2;

  // Fins
  ctx.fillStyle=colours.fin;
  ctx.beginPath(); ctx.moveTo(cx+halfW,finTopY); ctx.lineTo(cx+halfW+finSpan,finTopY+offset); ctx.lineTo(cx+halfW+finSpan,finBotY-offset); ctx.lineTo(cx+halfW,finBotY); ctx.closePath(); ctx.fill();
  ctx.strokeStyle=colours.accent+'55'; ctx.lineWidth=0.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-halfW,finTopY); ctx.lineTo(cx-halfW-finSpan,finTopY+offset); ctx.lineTo(cx-halfW-finSpan,finBotY-offset); ctx.lineTo(cx-halfW,finBotY); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (nFins>=4) {
    const sf=finSpan*0.5,sr=finRoot*0.65,st=finTip*0.5;
    ctx.fillStyle=colours.fin+'bb';
    ctx.beginPath(); ctx.moveTo(cx-halfW*0.4,cy+bodyH-sr); ctx.lineTo(cx,cy+bodyH-sr-sf); ctx.lineTo(cx,cy+bodyH-sr-sf+st); ctx.lineTo(cx+halfW*0.4,cy+bodyH-sr); ctx.closePath(); ctx.fill();
  }

  // Body
  const bg=ctx.createLinearGradient(cx-halfW,0,cx+halfW,0);
  bg.addColorStop(0,colours.body1); bg.addColorStop(0.28,colours.body2); bg.addColorStop(0.5,colours.body3); bg.addColorStop(0.72,colours.body2); bg.addColorStop(1,colours.body1);
  ctx.fillStyle=bg; ctx.fillRect(cx-halfW,cy,halfW*2,bodyH);
  ctx.fillStyle='rgba(255,255,255,0.07)'; ctx.fillRect(cx-halfW*0.25,cy,halfW*0.22,bodyH);
  ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(cx-halfW,cy+bodyH*0.5,halfW*2,halfW*0.18);
  ctx.fillStyle=colours.body1; ctx.fillRect(cx-halfW,cy-halfW*0.15,halfW*2,halfW*0.18);

  // Nose
  ctx.fillStyle=colours.nose;
  if (d.noseShape==='conical') {
    ctx.beginPath(); ctx.moveTo(cx,cy-noseH); ctx.lineTo(cx+halfW,cy); ctx.lineTo(cx-halfW,cy); ctx.closePath(); ctx.fill();
  } else if (d.noseShape==='ogive') {
    ctx.beginPath(); ctx.moveTo(cx,cy-noseH); ctx.quadraticCurveTo(cx+halfW*0.18,cy-noseH*0.4,cx+halfW,cy); ctx.lineTo(cx-halfW,cy); ctx.quadraticCurveTo(cx-halfW*0.18,cy-noseH*0.4,cx,cy-noseH); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.moveTo(cx,cy-noseH); ctx.quadraticCurveTo(cx+halfW*0.1,cy-noseH*0.35,cx+halfW*0.28,cy); ctx.lineTo(cx+halfW*0.05,cy); ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(cx,cy-noseH); ctx.quadraticCurveTo(cx+halfW*0.82,cy-noseH*0.32,cx+halfW,cy); ctx.lineTo(cx-halfW,cy); ctx.quadraticCurveTo(cx-halfW*0.82,cy-noseH*0.32,cx,cy-noseH); ctx.closePath(); ctx.fill();
  }

  // Window
  const winR=Math.max(halfW*0.3,2.5), winY=cy+bodyH*0.22;
  const wg=ctx.createRadialGradient(cx-winR*0.3,winY-winR*0.3,0,cx,winY,winR);
  wg.addColorStop(0,'rgba(200,235,255,0.75)'); wg.addColorStop(0.5,'rgba(100,185,255,0.4)'); wg.addColorStop(1,'rgba(50,130,220,0.25)');
  ctx.fillStyle=wg; ctx.strokeStyle='rgba(160,210,255,0.7)'; ctx.lineWidth=0.7;
  ctx.beginPath(); ctx.arc(cx,winY,winR,0,Math.PI*2); ctx.fill(); ctx.stroke();

  // Nozzle
  const nW=halfW*0.55, nH=Math.max(3.5,halfW*0.4);
  const ng=ctx.createLinearGradient(cx-nW,0,cx+nW,0);
  ng.addColorStop(0,'#111'); ng.addColorStop(0.5,'#3a3a3a'); ng.addColorStop(1,'#111');
  ctx.fillStyle=ng;
  ctx.beginPath(); ctx.moveTo(cx-nW*0.7,cy+bodyH); ctx.lineTo(cx-nW,cy+bodyH+nH); ctx.lineTo(cx+nW,cy+bodyH+nH); ctx.lineTo(cx+nW*0.7,cy+bodyH); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#080808'; ctx.fillRect(cx-nW*0.45,cy+bodyH,nW*0.9,nH*0.5);
}

function vizDrawDefaultRocket(ctx,cx,cy,zoom) {
  const rW=7*zoom,rH=24*zoom;
  const bg=ctx.createLinearGradient(cx-rW,0,cx+rW,0);
  bg.addColorStop(0,'#b03008'); bg.addColorStop(0.4,'#ff4d1c'); bg.addColorStop(1,'#7a1c06');
  ctx.fillStyle=bg; ctx.fillRect(cx-rW,cy,rW*2,rH);
  ctx.fillStyle='#ff4d1c';
  ctx.beginPath(); ctx.moveTo(cx,cy-13*zoom); ctx.quadraticCurveTo(cx+rW*1.1,cy-2*zoom,cx+rW,cy); ctx.lineTo(cx-rW,cy); ctx.quadraticCurveTo(cx-rW*1.1,cy-2*zoom,cx,cy-13*zoom); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(100,185,255,0.35)'; ctx.strokeStyle='rgba(100,185,255,0.65)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.arc(cx,cy+7*zoom,3*zoom,0,Math.PI*2); ctx.fill(); ctx.stroke();
  ctx.fillStyle='#b03008';
  ctx.beginPath(); ctx.moveTo(cx-rW,cy+rH-10*zoom); ctx.lineTo(cx-rW-10*zoom,cy+rH+5*zoom); ctx.lineTo(cx-rW,cy+rH); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+rW,cy+rH-10*zoom); ctx.lineTo(cx+rW+10*zoom,cy+rH+5*zoom); ctx.lineTo(cx+rW,cy+rH); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#111'; ctx.fillRect(cx-rW*0.5,cy+rH,rW,4*zoom);
}

// ── Controls ──
function vizTogglePlay() {
  if (vizCdActive) return;
  if (vizIdx>=vizN-1) { vizRestart(); return; }
  if (!vizPlaying) {
    if (vizIdx===0) { vizStartCountdown(); }
    else {
      vizPlaying=true; vizLastTs=null;
      document.getElementById('viz-play-btn').textContent='⏸ Pause';
      vizRafId=requestAnimationFrame(vizAnimLoop);
    }
  } else {
    vizPlaying=false;
    document.getElementById('viz-play-btn').textContent='▶ Play';
    if (vizRafId) cancelAnimationFrame(vizRafId);
  }
}

function vizRestart() {
  vizPlaying=false; vizIdx=0; vizTimeAcc=0; vizLastTs=null;
  camY=0; camYTarget=0; camZoom=1; camZoomTarget=1;
  if (vizRafId) cancelAnimationFrame(vizRafId);
  document.getElementById('viz-play-btn').textContent='▶ Play';
  setVizPhase('ready');
  document.querySelectorAll('.viz-etag').forEach(e=>e.classList.remove('show'));
  document.getElementById('viz-summary').style.display='none';
  const cd=document.getElementById('viz-countdown');
  cd.style.opacity='1'; cd.style.pointerEvents='auto'; cd.style.display='flex';
  document.getElementById('viz-cd-num').textContent='5';
  document.getElementById('viz-cd-label').textContent='T-MINUS';
  document.getElementById('viz-cd-fill').style.width='100%';
  vizResizeCanvas(); vizRenderFrame(0);
}

function vizShowSummary() {
  const d=vizFlightData;
  const chuteHtml = d.parachute && d.parachute.enabled ? `
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#3fb950;">${parseFloat(d.parachute.landingVel).toFixed(1)} m/s</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Landing Speed</div>
    </div>
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#3fb950;">${d.parachute.diamCm} cm</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Chute Diameter</div>
    </div>` : '';
  document.getElementById('viz-summary-grid').innerHTML = `
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#ff4d1c;">${parseFloat(d.maxAlt).toFixed(1)} m</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Max Altitude</div>
    </div>
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#ff4d1c;">${parseFloat(d.maxVel).toFixed(1)} m/s</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Max Velocity</div>
    </div>
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#ff4d1c;">${parseFloat(d.totalTime).toFixed(1)} s</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Total Flight</div>
    </div>
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#ff4d1c;">${d.motorClass}</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Motor Class</div>
    </div>
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#ff4d1c;">${d.twr}</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Thrust-to-Weight</div>
    </div>
    <div style="background:#08080f;border:1px solid #2a2a3a;border-radius:8px;padding:13px;text-align:center;">
      <div style="font-size:20px;font-weight:bold;color:#ff4d1c;">${parseFloat(d.apogeeTime).toFixed(1)} s</div>
      <div style="font-size:10px;color:#6e6e8a;text-transform:uppercase;">Time to Apogee</div>
    </div>
    ${chuteHtml}
  `;
  document.getElementById('viz-summary').style.display='flex';
}
