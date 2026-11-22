// Busca dados frescos no Deezer (o link do trecho expira, por isso não fica salvo no site)
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function dz(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      const d = await r.json();
      if (d && d.error && d.error.code === 4) { await sleep(400 + i * 500); continue; }   // limite de requisições: tenta de novo
      return d;
    } catch { await sleep(300); }
  }
  return null;
}
export default async function handler(req, res) {
  const { id, q } = req.query;
  let t = null;
  if (id) {
    t = await dz(`https://api.deezer.com/track/${encodeURIComponent(id)}`);
    if (!t || t.error || !t.preview) t = null;
  }
  if (!t && q) {
    const d = await dz(`https://api.deezer.com/search?limit=5&q=${encodeURIComponent(q)}`);
    t = ((d && d.data) || []).find(x => x.preview) || null;
  }
  if (!t) { res.setHeader('Cache-Control', 's-maxage=300'); return res.status(404).json({ error: 'not_found' }); }
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
  return res.json({ id: t.id, preview: t.preview, link: t.link, cover: t.album?.cover_big || t.album?.cover_medium || '' });
}
