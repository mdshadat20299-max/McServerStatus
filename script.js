const btn = document.getElementById('checkBtn');
const ipInput = document.getElementById('serverIp');
const result = document.getElementById('result');
const statusText = document.getElementById('statusText');
const motd = document.getElementById('motd');
const version = document.getElementById('version');
const players = document.getElementById('players');
const playersList = document.getElementById('playersList');
const faviconImg = document.getElementById('faviconImg');
const faviconCard = document.getElementById('faviconCard');
const software = document.getElementById('software');
const plugins = document.getElementById('plugins');
const otherInfo = document.getElementById('otherInfo');
const rawJson = document.getElementById('rawJson');
const themeBtn = document.getElementById('themeBtn');

function clearDisplay() {
  statusText.textContent = '';
  motd.textContent = '';
  version.textContent = '';
  players.textContent = '';
  playersList.textContent = '—';
  faviconImg.src = '';
  faviconCard.style.display = 'block';
  software.textContent = '';
  plugins.textContent = '';
  otherInfo.textContent = '';
  rawJson.textContent = '';
}

function prettifyMotd(m) {
  if (!m) return '—';
  if (typeof m === 'string') return m;
  if (Array.isArray(m)) return m.join('\n');
  if (m.clean) return m.clean.join('\n');
  if (m.raw) return m.raw;
  return JSON.stringify(m);
}

async function checkServer(ip) {
  clearDisplay();
  result.style.display = 'block';
  statusText.textContent = 'Checking...';

  ip = ip.trim();
  if (!ip) {
    statusText.textContent = 'Enter a server IP';
    return;
  }

  const endpoint = 'https://api.mcsrvstat.us/2/' + encodeURIComponent(ip);
  try {
    const res = await fetch(endpoint);
    if (!res.ok) throw new Error('Network error: ' + res.status);
    const data = await res.json();

    rawJson.textContent = JSON.stringify(data, null, 2);

    if (data.online) {
      statusText.innerHTML = '<span style="color:#7ee787">Online</span>';
    } else {
      statusText.innerHTML = '<span style="color:#ff7b7b">Offline or not responding</span>';
    }

    motd.textContent = prettifyMotd(data.motd && (data.motd.clean || data.motd.raw || data.motd));

    version.textContent = data.version
      ? data.version + (data.protocol ? ` (protocol: ${data.protocol})` : '')
      : '—';

    if (data.players) {
      const online = data.players.online ?? '—';
      const max = data.players.max ?? '—';
      players.textContent = `${online} / ${max}`;

      if (Array.isArray(data.players.list) && data.players.list.length) {
        playersList.innerHTML = '';
        data.players.list.forEach(p => {
          const el = document.createElement('div');
          el.textContent = p;
          playersList.appendChild(el);
        });
      } else if (data.players.sample?.length) {
        playersList.innerHTML = '';
        data.players.sample.forEach(p =>
          playersList.appendChild(Object.assign(document.createElement('div'), { textContent: p.name || JSON.stringify(p) }))
        );
      } else {
        playersList.textContent = 'Player list not exposed.';
      }
    }

    software.textContent = data.software || '—';

    if (Array.isArray(data.plugins) && data.plugins.length) {
      plugins.textContent = data.plugins.join(', ');
    } else {
      plugins.textContent = '—';
    }

    if (data.icon || data.favicon) {
      faviconImg.src = data.icon || data.favicon;
    } else {
      faviconImg.src = '';
      faviconCard.style.display = 'none';
    }

    const extras = [];
    if (data.hostname) extras.push('Hostname: ' + data.hostname);
    if (data.port) extras.push('Port: ' + data.port);
    if (data.players?.online === 0) extras.push('Note: server reports 0 players online');
    otherInfo.textContent = extras.join(' • ') || '—';
  } catch (err) {
    statusText.innerHTML = '<span style="color:#ffb86b">Error</span>';
    rawJson.textContent = 'Fetch error: ' + err.message;
  }
}

// theme toggle
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('light');
  themeBtn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
});

btn.addEventListener('click', () => checkServer(ipInput.value));
ipInput.addEventListener('keydown', e => { if (e.key === 'Enter') checkServer(ipInput.value); });