// BugBucket frontend - plain JavaScript, no libraries.
// Online (or served by Flask) -> same website address. Opened as a file -> local backend.
const API = location.protocol.startsWith('http') ? '/predict' : 'http://localhost:5000/predict';
const R = JSON.parse(sessionStorage.getItem('bb_result') || 'null');
if (document.body.dataset.needs && !R) location.replace('index.html');   // no result yet -> go home

const INFO = {
  'User Interface': 'Menus, toolbars, address bar, windows, and other things you click.',
  'Graphics': 'How pages are drawn: layout, CSS, fonts, canvas, WebGL, and SVG.',
  'Media': 'Audio, video, camera, microphone, and WebRTC calls.',
  'Networking': 'Connections: HTTP, DNS, proxies, email protocols, and websockets.',
  'Security and Privacy': 'Certificates, tracking protection, sandboxing, and encryption.',
  'Accessibility': 'Screen readers and other tools that help people use the software.',
  'Performance': 'Slowness, high memory use, and timing problems.',
  'Storage and Data': 'Saved data: databases, autofill, contacts, and address books.'
};
const ICONS = { 'User Interface': '🖥️', 'Graphics': '🎨', 'Media': '🎬', 'Networking': '🌐', 'Security and Privacy': '🔒', 'Accessibility': '♿', 'Performance': '⚡', 'Storage and Data': '💾' };
const COLORS = { 'User Interface': '#3b82f6', 'Graphics': '#a855f7', 'Media': '#ec4899', 'Networking': '#06b6d4', 'Security and Privacy': '#22c55e', 'Accessibility': '#f59e0b', 'Performance': '#ef4444', 'Storage and Data': '#14b8a6' };
const col = n => COLORS[n] || '#3b82f6';
const fmt = p => p < 0.1 ? '<0.1' : p.toFixed(1);
const $ = id => document.getElementById(id);
// the ring is an SVG circle; changing its dash offset fills it
function setRing(id, pct, color) {
  $(id).closest('.ring').style.setProperty('--c', color);
  setTimeout(() => $(id).style.strokeDashoffset = 100 - pct, 80);
}
function countUp(id, to) {
  const t0 = performance.now();
  (function tick(now) {
    const t = Math.min((now - t0) / 1200, 1);
    $(id).textContent = (to * t).toFixed(1);
    if (t < 1) requestAnimationFrame(tick);
  })(t0);
}

// ---------- Page 1: input ----------
const box = $('report');
if (box) {
  const btn = $('predict'), err = $('error');
  box.addEventListener('input', () => $('chars').textContent = box.value.length);
  box.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) btn.click(); });   // Ctrl+Enter submits
  document.querySelectorAll('.ex').forEach(b => b.onclick = () => {   // example chips fill the box
    box.value = b.dataset.text; box.dispatchEvent(new Event('input')); box.focus();
  });
  btn.addEventListener('click', async () => {
    const text = box.value.trim();
    if (!text) { err.textContent = 'Type or paste a bug report first.'; return; }
    err.textContent = ''; btn.disabled = true; btn.classList.add('loading'); btn.textContent = 'Analyzing...';
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      sessionStorage.setItem('bb_result', JSON.stringify(data));
      location.href = 'result.html';
    } catch (e) {
      err.textContent = e instanceof TypeError ? 'Cannot reach the server. Start it with: python backend.py' : e.message;
      btn.disabled = false; btn.classList.remove('loading'); btn.textContent = 'Predict';
    }
  });
}

// ---------- Page 2: predicted category ----------
if (R && $('category')) {
  const score = R.percentages[R.category], c = col(R.category);
  $('category').innerHTML = `<span class="ico" style="--c:${c}">${ICONS[R.category] || ''}</span><span>${R.category}</span>`;
  $('desc').textContent = INFO[R.category] || '';
  const lv = score >= 70 ? ['hi', 'High confidence'] : score >= 40 ? ['mid', 'Medium confidence'] : ['lo', 'Low confidence'];
  $('desc').insertAdjacentHTML('afterend', `<span class="level ${lv[0]}">${lv[1]}</span>`);
  if ($('copy')) $('copy').onclick = async () => {   // copy the result as text
    try { await navigator.clipboard.writeText(`BugBucket: ${R.category} (${score.toFixed(1)}%)`); $('copy').textContent = 'Copied!'; }
    catch (e) { $('copy').textContent = 'Copy not supported'; }
    setTimeout(() => $('copy').textContent = 'Copy result', 1800);
  };
  setRing('ring', score, c); countUp('conf', score);
  if (score < 40 && $('notice')) {   // low confidence -> friendly warning
    $('notice').hidden = false;
    $('notice').textContent = 'We are not very sure about this one. Try adding more detail, such as what you did and what went wrong.';
  }
  Object.entries(R.percentages).filter(([n]) => n !== R.category).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([n, p]) => {
    const d = document.createElement('div'); d.className = 'mini';
    d.innerHTML = `${ICONS[n] || ''} ${n} <b style="float:right">${fmt(p)}%</b><div class="track"><div class="fill" style="background:${col(n)}"></div></div>`;
    $('runners').appendChild(d);
    setTimeout(() => d.querySelector('.fill').style.width = Math.max(p, 1) + '%', 300);
  });
}

// ---------- Page 3: all eight categories ----------
if (R && $('chart')) {
  let boost = false;
  const cols = Object.entries(R.percentages).sort((a, b) => b[1] - a[1]).map(([name, pct]) => {
    const c = document.createElement('button'); c.className = 'col'; c.style.setProperty('--c', col(name));
    c.innerHTML = `<span class="val">${fmt(pct)}%</span><div class="well"><div class="bar"></div></div><span class="lab"><span class="ic">${ICONS[name] || ''}</span>${name}</span>`;
    c.onclick = () => select(name);
    $('chart').appendChild(c);
    return { c, name, pct };
  });
  const draw = () => cols.forEach(({ c, pct }, i) => setTimeout(() =>
    c.querySelector('.bar').style.height = Math.max(boost ? Math.sqrt(pct) * 10 : pct, 2) + '%', 100 + i * 90));
  function select(name) {
    cols.forEach(o => o.c.classList.toggle('sel', o.name === name));
    const p = R.percentages[name];
    $('dname').textContent = `${ICONS[name] || ''} ${name}`; $('ddesc').textContent = INFO[name] || '';
    $('tag').textContent = name === R.category ? 'Predicted category' : 'Other category';
    setRing('ring2', p, col(name)); countUp('pct2', p);
  }
  $('boost').onclick = () => {
    boost = !boost; $('boost').textContent = 'Boost small values: ' + (boost ? 'on' : 'off'); draw();
  };
  draw(); select(R.category);
}

// ---------- About page ----------
if ($('cats')) Object.entries(INFO).forEach(([n, d]) => {
  $('cats').insertAdjacentHTML('beforeend', `<div class="panel cat" style="--c:${col(n)}"><span class="ico">${ICONS[n]}</span><br><b>${n}</b><p class="muted" style="font-size:13px;margin-top:6px">${d}</p></div>`);
});
// sections fade in when scrolled into view
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')));
document.querySelectorAll('.sec').forEach(s => { s.classList.add('rv'); io.observe(s); });
