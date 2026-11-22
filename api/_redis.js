// Upstash Redis via REST (integração gratuita da Vercel: Storage → Upstash Redis)
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const enabled = Boolean(URL && TOKEN);
export async function pipeline(cmds) {
  const r = await fetch(`${URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map(x => x.result);
}
export const CATS = ['all', 'rock', 'mpb', 'samba', 'pagode', 'sertanejo', 'funk', 'rap'];
export function toCounts(flat) {
  const o = {};
  for (let i = 0; i < (flat || []).length; i += 2) o[flat[i]] = +flat[i + 1];
  return o;
}
