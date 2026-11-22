import { enabled, pipeline, CATS, toCounts } from './_redis.js';
// GET ?cat=rock&year=1985  -> contagem do ano
// GET ?cat=rock&years=1980,1981,... -> contagem de vários anos (página de rankings)
export default async function handler(req, res) {
  if (!enabled) return res.json({ disabled: true });
  const cat = String(req.query.cat || '');
  if (!CATS.includes(cat)) return res.status(400).json({ error: 'bad_request' });
  const years = String(req.query.years || req.query.year || '').split(',').map(y => parseInt(y, 10)).filter(y => y >= 1950 && y <= 2030).slice(0, 60);
  if (!years.length) return res.status(400).json({ error: 'bad_request' });
  try {
    const out = await pipeline(years.map(y => ['HGETALL', `s:${cat}:${y}`]));
    const data = {}; years.forEach((y, i) => { data[y] = toCounts(out[i]); });
    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=60');
    return res.json({ data });
  } catch (e) { return res.status(500).json({ error: 'db_error' }); }
}
