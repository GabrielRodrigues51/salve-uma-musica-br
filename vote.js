import { enabled, pipeline, CATS, toCounts } from './_redis.js';
// POST { cat, year, song, prev } -> registra o voto na música (chave estável: nome-da-musica--artista)
// e tira o voto anterior, se a pessoa trocou de música naquele ano
const KEY = /^[a-z0-9-]{1,80}$/;
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!enabled) return res.json({ disabled: true });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const cat = String(b.cat), year = parseInt(b.year, 10), song = String(b.song || ''), prev = b.prev ? String(b.prev) : null;
  if (!CATS.includes(cat) || !(year >= 1950 && year <= 2030) || !KEY.test(song) || (prev && !KEY.test(prev))) return res.status(400).json({ error: 'bad_request' });
  const key = `s:${cat}:${year}`;
  const cmds = [];
  if (prev && prev !== song) cmds.push(['HINCRBY', key, prev, '-1']);
  if (prev !== song) cmds.push(['HINCRBY', key, song, '1']);
  cmds.push(['HGETALL', key]);
  try {
    const out = await pipeline(cmds);
    return res.json({ counts: toCounts(out[out.length - 1]) });
  } catch (e) { return res.status(500).json({ error: 'db_error' }); }
}
