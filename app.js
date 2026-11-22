// Salve Uma Música — v2
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const CLIP_AUTO = 5, CLIP_FULL = 20;           // segundos: trecho automático e trecho ao clicar no play
const audio = new Audio(); audio.preload = 'auto';
let CATS = [], CAT = null, YEARS = [], yi = 0, prog = null;
let seq = 0;                                     // token da sequência automática (muda para cancelar)
let clip = null;                                 // {card, timer, raf}
let lastVote = null;
const trackCache = {};

// ---------- armazenamento local ----------
const ls = {
  get(k, d) { try { const v = localStorage.getItem('sum_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sum_' + k, JSON.stringify(v)); } catch {} },
};
const settings = ls.get('settings', { fast: false, muted: false, cat: 'all' });
const saveSettings = () => ls.set('settings', settings);
const loadProg = id => ls.get('prog_' + id, { picks: {} });
const saveProg = () => ls.set('prog_' + CAT.id, prog);

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2400);
}
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id));
  document.body.classList.toggle('on-home', id === 'scrHome');
  window.scrollTo(0, 0);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Deezer (via /api/track) ----------
let active = 0; const queue = [];
function limited(fn) {                            // no máximo 4 buscas ao mesmo tempo (limite do Deezer)
  return new Promise(res => {
    const run = () => { active++; fn().then(res, () => res(null)).finally(() => { active--; queue.length && queue.shift()(); }); };
    active < 4 ? run() : queue.push(run);
  });
}
function track(song) {
  const key = song.id || song.t + '|' + song.a;
  if (!trackCache[key]) {
    const q = encodeURIComponent(`${song.t} ${song.a}`);
    const url = song.id ? `/api/track?id=${song.id}&q=${q}` : `/api/track?q=${q}`;
    trackCache[key] = limited(() => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null));
  }
  return trackCache[key];
}

// ---------- áudio ----------
function stopClip() {
  if (!clip) return;
  clearTimeout(clip.timer); cancelAnimationFrame(clip.raf);
  audio.pause();
  clip.card.classList.remove('playing');
  clip.card.querySelector('.play').textContent = '▶';
  clip.card.querySelector('.prog').style.width = '0';
  const done = clip.resolve; clip = null; done && done();
}
function playClip(card, song, secs) {
  stopClip();
  return new Promise(async resolve => {
    const d = await track(song);
    if (!d || !d.preview) { resolve(false); return; }
    clip = { card, resolve: () => resolve(true) };
    card.classList.add('playing');
    card.querySelector('.play').textContent = '❚❚';
    audio.src = d.preview; audio.currentTime = 0; audio.muted = settings.muted; audio.volume = 1;
    audio.play().catch(() => {});
    const t0 = performance.now(), bar = card.querySelector('.prog');
    const tick = () => {
      if (!clip || clip.card !== card) return;
      const el = (performance.now() - t0) / 1000;
      bar.style.width = Math.min(100, 100 * el / secs) + '%';
      if (el > secs - 0.6) audio.volume = Math.max(0, (secs - el) / 0.6);   // fade out
      clip.raf = requestAnimationFrame(tick);
    };
    tick();
    clip.timer = setTimeout(stopClip, secs * 1000);
    audio.onended = stopClip;
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- home ----------
function renderCats(el, active, onPick) {
  el.innerHTML = CATS.map(c => `<button data-id="${c.id}" class="${c.id === active ? 'on' : ''}">${esc(c.nome)}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => onPick(b.dataset.id));
}
function home() {
  seq++; stopClip();
  CAT = CATS.find(c => c.id === settings.cat) || CATS[0];
  YEARS = Object.keys(CAT.years).sort();
  prog = loadProg(CAT.id);
  renderCats($('#cats'), CAT.id, id => { settings.cat = id; saveSettings(); home(); });
  const n = Object.keys(prog.picks).length;
  $('#mContinue').classList.toggle('hidden', n === 0 || n === YEARS.length);
  $('#mContinue').textContent = `Continuar (${n}/${YEARS.length})`;
  $('#mNew').classList.toggle('gold', n === 0);
  $('#catInfo').textContent = `${CAT.nome}: ${CAT.ini}–${CAT.fim} · ${YEARS.length} anos · 10 músicas por ano`;
  history.replaceState(null, '', location.pathname);
  show('scrHome');
}
$('#mNew').onclick = () => {
  if (Object.keys(prog.picks).length && !confirm('Começar de novo? Suas escolhas desta categoria serão apagadas (os votos já enviados continuam no ranking).')) return;
  prog = { picks: {} }; saveProg(); startYear(0);
};
$('#mContinue').onclick = () => { const i = YEARS.findIndex(y => !(y in prog.picks)); startYear(i < 0 ? 0 : i); };
$('#mYear').onclick = () => {
  $('#yearsSub').textContent = CAT.nome;
  $('#years').innerHTML = YEARS.map((y, i) => {
    const p = prog.picks[y];
    return `<button data-i="${i}" class="${p !== undefined ? 'done' : ''}">${y}${p !== undefined ? `<small>${esc(CAT.years[y][p].t)}</small>` : ''}</button>`;
  }).join('');
  $$('#years button').forEach(b => b.onclick = () => startYear(+b.dataset.i));
  show('scrYears');
};
$('#mRank').onclick = () => rankings(CAT.id);
$$('[data-home]').forEach(b => b.onclick = home);

// ---------- ano ----------
function cardHTML(s, i) {
  return `<div class="card" data-i="${i}">
    <div class="cover"><button class="play" aria-label="Ouvir trecho">▶</button><div class="prog"></div></div>
    <div class="info"><div class="t">${esc(s.t)}</div><div class="a">${esc(s.a)}</div>
      <button class="save">Salvar</button><div class="na"></div></div></div>`;
}
async function startYear(i) {
  const my = ++seq; stopClip();
  yi = i; const y = YEARS[yi], songs = CAT.years[y];
  show('scrGame');
  history.replaceState(null, '', `#/${CAT.id}/${y}`);
  $('#prevYear').disabled = yi === 0;
  $('#fast').checked = settings.fast;
  $('#mute').textContent = settings.muted ? '🔇' : '🔊';
  $('#yearTitle').textContent = y; $('#yearTitle').classList.remove('show');
  $('#hint').textContent = '';
  const grid = $('#grid'); grid.innerHTML = songs.map(cardHTML).join('');
  const cards = $$('#grid .card');
  songs.forEach((s, j) => {
    const c = cards[j];
    track(s).then(d => {
      if (d && d.cover) c.querySelector('.cover').style.backgroundImage = `url("${d.cover}")`;
      if (!d || !d.preview) { c.querySelector('.play').disabled = true; c.querySelector('.na').textContent = 'Trecho indisponível'; }
    });
    c.querySelector('.play').onclick = e => {
      e.stopPropagation();
      if (clip && clip.card === c) { stopClip(); return; }
      seq++; revealAll(cards);                     // interrompe a sequência automática
      playClip(c, s, CLIP_FULL);
    };
    c.querySelector('.save').onclick = e => { e.stopPropagation(); save(j); };
  });
  // intro do ano
  const intro = $('#yearIntro');
  intro.textContent = y; intro.classList.remove('show'); void intro.offsetWidth;
  if (!settings.fast) { intro.classList.add('show'); await wait(1150); }
  if (my !== seq) return;
  $('#yearTitle').classList.add('show');
  if (settings.fast) { revealAll(cards); $('#hint').textContent = 'Clique no ▶ para ouvir 20 segundos de cada música.'; return; }
  for (let j = 0; j < cards.length; j++) {
    if (my !== seq) return;
    cards[j].classList.add('in');
    const rc = cards[j].getBoundingClientRect();
    if (rc.bottom > innerHeight || rc.top < 0) cards[j].scrollIntoView({ block: 'center', behavior: 'smooth' });
    const ok = await playClip(cards[j], songs[j], CLIP_AUTO);
    if (!ok) await wait(700);
    if (my !== seq) return;
  }
  $('#hint').textContent = 'Clique no ▶ para ouvir de novo (20 segundos) e salve a sua favorita.';
}
function revealAll(cards) { cards.forEach((c, j) => setTimeout(() => c.classList.add('in'), settings.fast ? j * 45 : 0)); }

$('#prevYear').onclick = () => { if (yi > 0) startYear(yi - 1); };
$('#fast').onchange = e => { settings.fast = e.target.checked; saveSettings(); if (settings.fast) { seq++; stopClip(); revealAll($$('#grid .card')); $('#yearTitle').classList.add('show'); } };
$('#mute').onclick = () => { settings.muted = !settings.muted; audio.muted = settings.muted; saveSettings(); $('#mute').textContent = settings.muted ? '🔇' : '🔊'; };

// ---------- salvar + ranking do ano ----------
async function save(j) {
  seq++; stopClip();
  const y = YEARS[yi], prev = prog.picks[y];
  prog.picks[y] = j; saveProg();
  let counts = null;
  try {
    const r = await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cat: CAT.id, year: +y, idx: j, prev: prev ?? null }) });
    const d = await r.json(); counts = d.disabled ? null : d.counts;
  } catch {}
  showResult(y, j, counts);
}
function pctMap(counts) {
  const tot = Object.values(counts || {}).reduce((a, b) => a + Math.max(0, b), 0);
  return { tot, pct: i => tot ? (100 * Math.max(0, counts[i] || 0) / tot) : 0 };
}
function fmtPct(p) { return (p >= 10 || p === 0 ? p.toFixed(0) : p.toFixed(1)).replace('.', ',') + '%'; }
function showResult(y, mine, counts) {
  const songs = CAT.years[y], { tot, pct } = pctMap(counts);
  const best = counts ? Math.max(...songs.map((_, i) => pct(i))) : -1;
  $('#resultSub').textContent = counts ? `${y} · ${tot.toLocaleString('pt-BR')} votos · clique para continuar` : `${y} · o ranking geral será ativado em breve · clique para continuar`;
  $('#resultGrid').innerHTML = songs.map((s, i) => `<div class="card in${i === mine ? ' mine' : ''}${counts && pct(i) === best && best > 0 ? ' top' : ''}">
      <div class="cover" data-pct="${counts ? fmtPct(pct(i)) : (i === mine ? '✓' : '')}"></div>
      <div class="info"><div class="t">${esc(s.t)}</div><div class="a">${esc(s.a)}</div></div></div>`).join('');
  $$('#resultGrid .card').forEach((c, i) => track(songs[i]).then(d => { if (d && d.cover) c.querySelector('.cover').style.backgroundImage = `url("${d.cover}")`; }));
  show('scrResult');
}
$('#scrResult').onclick = e => {
  if (e.target.closest('[data-home]')) return;
  const next = YEARS.findIndex((y, i) => i > yi && !(y in prog.picks));
  if (next >= 0) startYear(next);
  else if (YEARS.every(y => y in prog.picks)) done();
  else if (yi + 1 < YEARS.length) startYear(yi + 1);
  else done();
};

// ---------- fim ----------
function encode(p) { return YEARS.map(y => (y in p ? String(p[y]) : '-')).join(''); }
function decode(s) { const p = {}; YEARS.forEach((y, i) => { if (s[i] && s[i] !== '-') p[y] = +s[i]; }); return p; }
function done(shared) {
  seq++; stopClip();
  const p = shared || prog.picks, n = Object.keys(p).length;
  $('#doneSub').textContent = shared ? `Lista de alguém em ${CAT.nome} (${n} anos). Monte a sua!` : `${CAT.nome}: você salvou ${n} de ${YEARS.length} anos.`;
  $('#shareBtn').classList.toggle('hidden', !!shared);
  $('#picks').innerHTML = YEARS.filter(y => y in p).map(y => {
    const s = CAT.years[y][p[y]];
    return `<li data-y="${y}"><span class="y">${y}</span><img alt="" loading="lazy"><div><div class="t">${esc(s.t)}</div><div class="a">${esc(s.a)}</div></div></li>`;
  }).join('');
  $$('#picks li').forEach(li => {
    const y = li.dataset.y; track(CAT.years[y][p[y]]).then(d => { if (d && d.cover) li.querySelector('img').src = d.cover; });
    if (!shared) li.onclick = () => startYear(YEARS.indexOf(y));
  });
  if (!shared) history.replaceState(null, '', `#/${CAT.id}/fim`);
  show('scrDone');
}
$('#doneRank').onclick = () => rankings(CAT.id);
$('#shareBtn').onclick = async () => {
  const url = `${location.origin}/#/${CAT.id}/lista/${encode(prog.picks)}`;
  const txt = `Minhas músicas salvas — ${CAT.nome} (Salve Uma Música)\n` +
    YEARS.filter(y => y in prog.picks).map(y => `${y}: ${CAT.years[y][prog.picks[y]].t} — ${CAT.years[y][prog.picks[y]].a}`).join('\n');
  if (navigator.share) { try { await navigator.share({ title: 'Salve Uma Música', text: txt, url }); return; } catch {} }
  try { await navigator.clipboard.writeText(txt + '\n\n' + url); toast('Lista copiada!'); } catch { prompt('Copie o link:', url); }
};

// ---------- rankings ----------
const lazyObs = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; lazyObs.unobserve(e.target);
  const [y, i] = e.target.dataset.s.split(':');
  track(CAT.years[y][+i]).then(d => { if (d && d.cover) e.target.src = d.cover; });
}), { rootMargin: '300px' }) : null;
function lazy(root) { root.querySelectorAll('img[data-s]').forEach(img => lazyObs ? lazyObs.observe(img) : null); }

async function rankings(id) {
  seq++; stopClip();
  CAT = CATS.find(c => c.id === id); YEARS = Object.keys(CAT.years).sort(); prog = loadProg(CAT.id);
  renderCats($('#rankCats'), id, rankings);
  show('scrRank');
  history.replaceState(null, '', `#/${id}/rankings`);
  $('#decades').innerHTML = ''; $('#yearlist').innerHTML = ''; $('#rankSub').textContent = 'Carregando…';
  let data = null;
  try { const r = await fetch(`/api/stats?cat=${id}&years=${YEARS.join(',')}`); const d = await r.json(); data = d.disabled ? null : d.data; } catch {}
  if (!data) { $('#rankSub').textContent = 'O ranking geral será ativado em breve.'; return; }
  const all = Object.values(data).reduce((a, c) => a + Object.values(c).reduce((x, v) => x + Math.max(0, v), 0), 0);
  $('#rankSub').textContent = `${CAT.nome} · ${all.toLocaleString('pt-BR')} votos no total`;
  // líderes por década
  const dec = {};
  YEARS.forEach(y => CAT.years[y].forEach((s, i) => {
    const n = Math.max(0, (data[y] || {})[i] || 0), d = y.slice(0, 3) + '0';
    if (n && (!dec[d] || n > dec[d].n)) dec[d] = { y, i, n, s };
  }));
  $('#decades').innerHTML = Object.keys(dec).sort().map(d => { const x = dec[d];
    return `<div class="dec"><h3>Anos ${d.slice(2)}</h3><img data-s="${x.y}:${x.i}" alt=""><div class="t">${esc(x.s.t)} — ${esc(x.s.a)}</div><div class="n">${x.y} · ${x.n.toLocaleString('pt-BR')} votos</div></div>`; }).join('');
  // lista por ano
  $('#yearlist').innerHTML = YEARS.map(y => {
    const c = data[y] || {}, { tot, pct } = pctMap(c);
    if (!tot) return '';
    const order = CAT.years[y].map((s, i) => ({ s, i, p: pct(i), n: Math.max(0, c[i] || 0) })).sort((a, b) => b.n - a.n);
    const row = (o, k) => `<div class="ritem${k >= 7 ? ' extra hidden' : ''}"><span class="pos">${k + 1}</span><img data-s="${y}:${o.i}" alt="">
      <div><div class="nm">${esc(o.s.t)} — ${esc(o.s.a)}${prog.picks[y] === o.i ? '<em>(seu voto)</em>' : ''}</div><div class="bar"><i style="width:${o.p}%"></i></div></div>
      <span class="pc">${fmtPct(o.p)} (${o.n})</span></div>`;
    return `<div class="yblock"><div><div class="yy">${y}</div><div class="tot">${tot.toLocaleString('pt-BR')} votos</div></div>
      <div>${order.map(row).join('')}<button class="more">▸ Mostrar mais 3 músicas</button></div></div>`;
  }).join('') || '<p class="sub center">Ainda não há votos nesta categoria.</p>';
  $$('#yearlist .more').forEach(b => b.onclick = () => { b.parentElement.querySelectorAll('.extra').forEach(e => e.classList.remove('hidden')); b.remove(); lazy(b.parentElement || document); lazy($('#yearlist')); });
  lazy($('#decades')); lazy($('#yearlist'));
}

// ---------- rotas (#/cat/ano, #/cat/rankings, #/cat/lista/xxxx) ----------
function route() {
  const [id, a, b] = location.hash.replace(/^#\/?/, '').split('/');
  const c = CATS.find(x => x.id === id);
  if (!c) return home();
  settings.cat = id; saveSettings();
  CAT = c; YEARS = Object.keys(c.years).sort(); prog = loadProg(id);
  if (a === 'rankings') return rankings(id);
  if (a === 'lista' && b) return done(decode(b));
  if (a === 'fim') return done();
  if (a && YEARS.includes(a)) return home();   // não toca áudio sem clique: volta para a home da categoria
  home();
}
window.addEventListener('hashchange', () => { if (!route._self) route(); });
fetch('/data/catalog.json').then(r => r.json()).then(d => { CATS = d.categorias; route(); });
