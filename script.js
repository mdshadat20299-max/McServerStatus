// site script: many features implemented
// Save as script.js, defer in HTML

const API_PREFIX = 'https://api.mcsrvstat.us/2/';

const btn = document.getElementById('checkBtn');
const ipInput = document.getElementById('serverIp');
const result = document.getElementById('result');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const motd = document.getElementById('motd');
const version = document.getElementById('version');
const versionBadge = document.getElementById('versionBadge');
const players = document.getElementById('players');
const playersList = document.getElementById('playersList');
const progressFill = document.getElementById('progressFill');
const playersChart = document.getElementById('playersChart');
const software = document.getElementById('software');
const plugins = document.getElementById('plugins');
const pluginCount = document.getElementById('pluginCount');
const faviconImg = document.getElementById('faviconImg');
const faviconCard = document.getElementById('faviconCard');
const otherInfo = document.getElementById('otherInfo');
const rawJson = document.getElementById('rawJson');
const spinner = document.getElementById('loadingSpinner');
const refreshBtn = document.getElementById('refreshBtn');
const copyBtn = document.getElementById('copyBtn');
const qrBtn = document.getElementById('qrBtn');
const qrCanvas = document.getElementById('qrCode');
const togglePlugins = document.getElementById('togglePlugins');
const collapsePlayers = document.getElementById('collapsePlayers');
const expandPlayers = document.getElementById('expandPlayers');
const copyJsonBtn = document.getElementById('copyJson');
const toggleJsonBtn = document.getElementById('toggleJson');
const checksList = document.getElementById('checksList');
const trendChart = document.getElementById('trendChart');
const historyDropdown = document.getElementById('historyDropdown');
const autoRefreshCheckbox = document.getElementById('autoRefresh');
const typingHeader = document.getElementById('typingHeader');
const footerClock = document.getElementById('footerClock');

let lastCheckedIp = '';
let lastData = null;
let checks = JSON.parse(localStorage.getItem('checks') || '[]'); // store last checks
let trendPoints = JSON.parse(localStorage.getItem('trend') || '[]'); // numeric online counts
let history = JSON.parse(localStorage.getItem('history') || '[]'); // recent IPs
let autoRefreshTimer = null;
let lastPingMs = null;

// Typing header effect
const typingText = "Minecraft Server Status Checker";
let tIdx = 0;
function typeEffect(){
  if(tIdx < typingText.length){
    typingHeader.textContent += typingText[tIdx++];
    setTimeout(typeEffect, 60);
  }
}
typeEffect();

// helper: shorten long text safely
function safeText(v){ return v==null || v===''? '—' : String(v) }

// helpers: store history
function pushHistory(ip){
  if(!ip) return;
  history = history.filter(x=>x!==ip);
  history.unshift(ip);
  if(history.length>10) history.pop();
  localStorage.setItem('history', JSON.stringify(history));
  renderHistory();
}
function renderHistory(){
  historyDropdown.innerHTML = '<option value="">Recent...</option>';
  history.forEach(h => {
    const o = document.createElement('option');
    o.value = h; o.textContent = h;
    historyDropdown.appendChild(o);
  });
}
renderHistory();

// render checks list
function renderChecks(){
  checksList.textContent = checks.slice().reverse().slice(0,6).map(s=>`${s.time} • ${s.ip} • ${s.status}`).join(' | ') || '—';
  localStorage.setItem('checks', JSON.stringify(checks));
}
renderChecks();

// mini util: update clock footer
function updateClock(){
  const d = new Date();
  footerClock.textContent = d.toLocaleString();
}
setInterval(updateClock,1000);
updateClock();

// draw simple trend chart
function drawTrend(){
  const ctx = trendChart.getContext('2d');
  ctx.clearRect(0,0,trendChart.width,trendChart.height);
  const pts = trendPoints.slice(-20);
  if(pts.length<2) return;
  const w = trendChart.width, h = trendChart.height;
  const max = Math.max(...pts), min = Math.min(...pts);
  ctx.beginPath(); ctx.lineWidth=2; ctx.strokeStyle='#3b82f6';
  pts.forEach((p,i)=>{
    const x = (i/(pts.length-1))*w;
    const y = h - ((p - min)/(max-min||1))*h;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

// players sparkline chart
function drawPlayersMiniChart(points){
  const ctx = playersChart.getContext('2d');
  ctx.clearRect(0,0,playersChart.width,playersChart.height);
  if(!points || points.length<2) return;
  const w = playersChart.width, h = playersChart.height;
  const max = Math.max(...points), min = Math.min(...points);
  ctx.beginPath(); ctx.lineWidth=2; ctx.strokeStyle='rgba(59,130,246,0.95)';
  points.forEach((p,i)=>{
    const x = (i/(points.length-1))*w;
    const y = h - ((p - min)/(max-min||1))*h;
    if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();
}

// ping helper (measure time for fetch)
async function fetchWithPing(url){
  const start = performance.now();
  const res = await fetch(url);
  const ms = Math.round(performance.now() - start);
  lastPingMs = ms;
  return {res, ms};
}

// prettify MOTD
function prettifyMotd(m){
  if(!m) return '—';
  if(typeof m === 'string') return m;
  if(Array.isArray(m)) return m.join('\n');
  if(m.clean) return m.clean.join('\n');
  if(m.raw) return m.raw;
  return JSON.stringify(m);
}

// confetti & sounds
function celebrateIfOnline(data){
  try{
    if(data && data.online){
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      const s = new Audio('data:audio/ogg;base64,T2dnUwACAAAAAAAAAAB...'); // placeholder (silent) to avoid CORS; using visual confetti primarily
      // s.play().catch(()=>{});
    }
  }catch(e){}
}

// copy helpers
async function copyToClipboard(text){
  try{ await navigator.clipboard.writeText(text); showToast('Copied!') } catch(e){ showToast('Copy failed') }
}

// small toast
function showToast(msg){
  const el = document.createElement('div'); el.className='toast'; el.textContent = msg;
  Object.assign(el.style,{position:'fixed',right:'18px',bottom:'90px',background:'#111',color:'#fff',padding:'10px 12px',borderRadius:'8px',zIndex:1000,boxShadow:'0 6px 20px rgba(0,0,0,0.6)'});
  document.body.appendChild(el);
  setTimeout(()=>el.style.opacity='0',2000);
  setTimeout(()=>el.remove(),2600);
}

// load QR
function makeQRCode(text){
  try{
    QRCode.toCanvas(qrCanvas, text || '', {width:128}, function (error) {
      if (error) console.error(error);
    });
  }catch(e){}
}

// clickable NameMC link for players
function makePlayerElement(name){
  const el = document.createElement('div');
  const img = document.createElement('img');
  img.src = `https://mc-heads.net/avatar/${name}/50`;
  img.alt = name;
  img.style.cursor='pointer';
  img.title = `Open ${name} on NameMC`;
  img.addEventListener('click', ()=> window.open(`https://namemc.com/profile/${name}`, '_blank'));
  const txt = document.createElement('span'); txt.textContent = name;
  el.appendChild(img); el.appendChild(txt);
  return el;
}

// handle toggle json collapse
let jsonCollapsed = false;
toggleJsonBtn && toggleJsonBtn.addEventListener('click', ()=>{
  jsonCollapsed = !jsonCollapsed;
  rawJson.style.display = jsonCollapsed ? 'none' : 'block';
  toggleJsonBtn.textContent = jsonCollapsed ? 'Expand' : 'Collapse';
});

// copy json
copyJsonBtn && copyJsonBtn.addEventListener('click', ()=> copyToClipboard(rawJson.textContent || ''));

// collapse/expand players
collapsePlayers && collapsePlayers.addEventListener('click', ()=> { playersList.style.display='none' });
expandPlayers && expandPlayers.addEventListener('click', ()=> { playersList.style.display='block' });

// toggle plugins
togglePlugins && togglePlugins.addEventListener('click', ()=>{
  plugins.textContent = fullPlugins.join(', ');
  togglePlugins.style.display = 'none';
});

// history dropdown
historyDropdown && historyDropdown.addEventListener('change', (e)=>{
  const v = e.target.value;
  if(v){ ipInput.value = v; checkServer(v); }
});

// QR button
qrBtn && qrBtn.addEventListener('click', ()=> {
  const ip = ipInput.value.trim();
  if(!ip){ showToast('Enter server IP first'); return; }
  makeQRCode(`minecraft://${ip}`);
  showToast('QR generated');
});

// copy ip
copyBtn && copyBtn.addEventListener('click', ()=> copyToClipboard(ipInput.value || ''));

// refresh
refreshBtn && refreshBtn.addEventListener('click', ()=> { if(lastCheckedIp) checkServer(lastCheckedIp); else showToast('No last server') });

// keyboard shortcut '/'
document.addEventListener('keydown', (e)=>{
  if(e.key === '/') { e.preventDefault(); ipInput.focus(); }
  if(e.key.toLowerCase()==='c' && e.ctrlKey) { copyToClipboard(lastCheckedIp || ''); }
});

// auto refresh toggle
autoRefreshCheckbox && autoRefreshCheckbox.addEventListener('change', (e)=>{
  if(e.target.checked){
    if(lastCheckedIp){ autoRefreshTimer = setInterval(()=> checkServer(lastCheckedIp), 30000); showToast('Auto-refresh enabled'); }
    else { showToast('Check one server first'); e.target.checked = false; }
  } else { clearInterval(autoRefreshTimer); autoRefreshTimer = null; showToast('Auto-refresh disabled'); }
});

// store last N trend points in localStorage
function pushTrend(val){
  trendPoints.push(val);
  if(trendPoints.length>40) trendPoints.shift();
  localStorage.setItem('trend', JSON.stringify(trendPoints));
  drawTrend();
  drawPlayersMiniChart(trendPoints.slice(-10));
}

// dynamic elements
let fullPlugins = [];

// check server
async function checkServer(ip){
  try{
    result.style.display = 'block';
    spinner.style.display = 'block';
    statusBadge.textContent = 'Checking...';
    statusText.textContent = 'Pinging...';
    rawJson.textContent = '';
    lastCheckedIp = ip;
    pushHistory(ip);

    // fetch with ping
    const endpoint = API_PREFIX + encodeURIComponent(ip);
    const {res, ms} = await fetchWithPing(endpoint);
    const data = await res.json();
    lastData = data;

    rawJson.textContent = JSON.stringify(data, null, 2);

    // online status
    if(data && data.online){
      statusBadge.textContent = 'Online';
      statusText.innerHTML = `🟢 Online • ${data.motd ? 'Visible' : 'No MOTD'}`;
      statusBadge.style.background = 'linear-gradient(90deg,#34d399,#10b981)';
      faviconImg.classList.add('online');
      celebrateIfOnline(data);
    } else {
      statusBadge.textContent = 'Offline';
      statusText.textContent = '🔴 Offline or not responding';
      statusBadge.style.background = 'linear-gradient(90deg,#fb7185,#ef4444)';
      faviconImg.classList.remove('online');
    }

    // ping
    document.getElementById('pingText').textContent = ms ? `Ping: ${ms} ms` : 'Ping: —';

    // motd
    motd.textContent = prettifyMotd(data.motd && (data.motd.clean || data.motd.raw || data.motd));

    // version
    version.textContent = data.version || '—';
    versionBadge.textContent = data.protocol ? `P:${data.protocol}` : '—';

    // players
    if(data.players){
      const onlineCount = data.players.online ?? 0;
      const maxCount = data.players.max ?? 1;
      players.textContent = `${onlineCount} / ${maxCount}`;
      playerBadgeUpdate(onlineCount, maxCount);

      // animate number count
      animateCount(onlineCount);

      // player list
      if(Array.isArray(data.players.list) && data.players.list.length){
        playersList.innerHTML = '';
        data.players.list.forEach(p=>{
          playersList.appendChild(makePlayerElement(p));
        });
      } else if(data.players.sample && Array.isArray(data.players.sample)){
        playersList.innerHTML = '';
        data.players.sample.forEach(s => {
          const name = s.name || (s.id ? s.id : JSON.stringify(s));
          playersList.appendChild(makePlayerElement(name));
        });
      } else {
        playersList.textContent = 'Player list not exposed.';
      }

      // progress bar + mini chart
      const pct = Math.round(((onlineCount/maxCount)||0)*100);
      progressFill.style.width = `${pct}%`;
      pushTrend(onlineCount);
    } else {
      players.textContent = '—';
      playersList.textContent = '—';
      progressFill.style.width = '0%';
    }

    // software
    software.textContent = data.software || '—';
    document.getElementById('softBadge').textContent = data.software ? data.software : '—';

    // plugins
    fullPlugins = Array.isArray(data.plugins) ? data.plugins : (data.plugins && Array.isArray(data.plugins.names) ? data.plugins.names : []);
    pluginCount.textContent = fullPlugins.length;
    if(fullPlugins.length>0){
      if(fullPlugins.length>6){
        plugins.textContent = fullPlugins.slice(0,6).join(', ') + ' ...';
        togglePlugins.style.display = 'inline-block';
      } else {
        plugins.textContent = fullPlugins.join(', ');
        togglePlugins.style.display = 'none';
      }
    } else {
      plugins.textContent = '—';
      togglePlugins.style.display = 'none';
    }

    // favicon
    if(data.icon || data.favicon){
      faviconImg.src = data.icon || data.favicon;
      faviconCard.style.display = 'block';
    } else {
      faviconImg.src = '';
      faviconCard.style.display = 'none';
    }

    // extras
    const extras = [];
    if(data.hostname) extras.push('Hostname: '+data.hostname);
    if(data.port) extras.push('Port: '+data.port);
    if(data.software) extras.push('Software: '+data.software);
    if(data.players && data.players.online === 0) extras.push('Server reports 0 players');
    otherInfo.textContent = extras.join(' • ') || '—';

    // QR code
    makeQRCode(`minecraft://${ip}`);

    // store check
    checks.push({time: new Date().toLocaleTimeString(), ip, status: data.online ? 'online' : 'offline', players: data.players?data.players.online:0});
    if(checks.length>50) checks.shift();
    localStorage.setItem('checks', JSON.stringify(checks));
    renderChecks();

    // trend points persist
    pushTrend(data.players?data.players.online:0);

  } catch(err){
    statusBadge.textContent = 'Error';
    statusText.textContent = 'Fetch error: ' + (err.message || err);
    rawJson.textContent = String(err);
  } finally {
    spinner.style.display = 'none';
  }
}

// small player badge update
function playerBadgeUpdate(online, max){
  const b = document.getElementById('playerBadge');
  b.textContent = `${online}/${max}`;
  const ratio = (max?online/max:0);
  if(ratio>0.7) b.style.background='linear-gradient(90deg,#34d399,#10b981)'; else if(ratio>0.3) b.style.background='linear-gradient(90deg,#f59e0b,#f97316)'; else b.style.background='linear-gradient(90deg,#ef4444,#fb7185)';
}

// animated number counter for players
function animateCount(final){
  const el = document.getElementById('players');
  const start = parseInt(el.getAttribute('data-last')||'0');
  const duration = 600;
  const startTime = performance.now();
  function step(now){
    const t = Math.min(1,(now-startTime)/duration);
    const val = Math.round(start + (final - start) * t);
    el.textContent = `${val} / ${el.textContent.split('/')[1] || ''}`.trim();
    if(t<1) requestAnimationFrame(step); else el.setAttribute('data-last', final);
  }
  requestAnimationFrame(step);
}

// draw trend & mini on load
drawTrend();
drawPlayersMiniChart(trendPoints.slice(-10));

// attach main events
btn.addEventListener('click', ()=> {
  const ip = ipInput.value.trim();
  if(!ip) { showToast('Enter server IP'); return; }
  spinner.style.display = 'block';
  checkServer(ip);
});

ipInput.addEventListener('keydown', (e)=> { if(e.key === 'Enter') btn.click(); });

// init: render history dropdown from storage
renderHistory();

// optional easter egg: type 'creeper' and press Enter
ipInput.addEventListener('input', (e)=>{
  if(e.target.value.trim().toLowerCase()==='creeper'){ // play small hiss sound and show boom toast
    showToast('s s s s s ... 💥 (creeper)');
    // small inline beep using WebAudio
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type='sine'; o.frequency.value=120; g.gain.value=0.001;
      o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 220);
    }catch(e){}
  }
});

// ensure rawJson doesn't overflow: already styled

// On load, if history exists select first
if(history && history[0]) ipInput.value = history[0];

// Accessibility: announce result
function announce(text){ /* left as placeholder for SR tools */ }

// window unload: save storage
window.addEventListener('beforeunload', ()=> {
  localStorage.setItem('history', JSON.stringify(history));
  localStorage.setItem('trend', JSON.stringify(trendPoints));
  localStorage.setItem('checks', JSON.stringify(checks));
});
