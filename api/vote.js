import { enabled, pipeline, CATS, toCounts } from './_redis.js';
// POST { cat, year, idx, prev } -> registra o voto (e tira o voto anterior, se a pessoa trocou)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!enabled) return res.json({ disabled: true });
  const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const cat = String(b.cat), year = parseInt(b.year, 10), idx = parseInt(b.idx, 10);
  const prev = b.prev === null || b.prev === undefined ? null : parseInt(b.prev, 10);
  if (!CATS.includes(cat) || !(year >= 1950 && year <= 2030) || !(idx >= 0 && idx <= 9)) return res.status(400).json({ error: 'bad_request' });
  const key = `v:${cat}:${year}`;
  const cmds = [];
  if (prev !== null && prev >= 0 && prev <= 9 && prev !== idx) cmds.push(['HINCRBY', key, String(prev), '-1']);
  if (prev !== idx) cmds.push(['HINCRBY', key, String(idx), '1']);
  cmds.push(['HGETALL', key]);
  try {
    const out = await pipeline(cmds);
    return res.json({ counts: toCounts(out[out.length - 1]) });
  } catch (e) { return res.status(500).json({ error: 'db_error' }); }
}
