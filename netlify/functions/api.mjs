import { getStore } from '@netlify/blobs';

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const KINDS = ['trades', 'weeks', 'days'];

export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const TEAM = Netlify.env.get('TEAM_KEY') || '';
  const key = req.headers.get('x-team-key') || url.searchParams.get('k') || '';
  if (!TEAM || key !== TEAM) return json({ error: 'clave' }, 401);

  const store = getStore({ name: 'diario', consistency: 'strong' });
  const shots = getStore({ name: 'capturas', consistency: 'strong' });
  const m = req.method;

  try {
    if (parts[0] === 'ping') return json({ ok: 1, t: Date.now() });

    if (parts[0] === 'profiles') {
      if (m === 'GET') return json((await store.get('profiles', { type: 'json' })) || []);
      if (m === 'PUT') { await store.setJSON('profiles', await req.json()); return json({ ok: 1 }); }
    }

    if (parts[0] === 'p' && parts[1]) {
      const pid = parts[1], kind = parts[2], id = parts[3]; const k = `p/${pid}/${kind}`;
      if (kind === 'all' && m === 'GET') {
        const [trades, settings, weeks, days] = await Promise.all(['trades', 'settings', 'weeks', 'days'].map(x => store.get(`p/${pid}/${x}`, { type: 'json' })));
        return json({ trades: trades || {}, settings: settings || null, weeks: weeks || {}, days: days || {} });
      }
      if (KINDS.includes(kind)) {
        if (m === 'GET') return json((await store.get(k, { type: 'json' })) || {});
        const map = (await store.get(k, { type: 'json' })) || {};
        if (m === 'PUT' && id) { map[id] = await req.json(); await store.setJSON(k, map); return json({ ok: 1 }); }
        if (m === 'DELETE' && id) { delete map[id]; await store.setJSON(k, map); return json({ ok: 1 }); }
        if (m === 'PUT' && !id) { Object.assign(map, await req.json()); await store.setJSON(k, map); return json({ ok: 1, n: Object.keys(map).length }); }
      }
      if (kind === 'settings') {
        if (m === 'GET') return json((await store.get(k, { type: 'json' })) || null);
        if (m === 'PUT') { await store.setJSON(k, await req.json()); return json({ ok: 1 }); }
      }
    }

    if (parts[0] === 'empresa') {
      const EK = ['accounts', 'costs', 'payouts', 'invest'];
      const kind = parts[1], id = parts[2];
      if (kind === 'all' && m === 'GET') {
        const [cfg, accounts, costs, payouts, invest] = await Promise.all(['cfg', ...EK].map(x => store.get(`empresa/${x}`, { type: 'json' })));
        return json({ cfg: cfg || null, accounts: accounts || {}, costs: costs || {}, payouts: payouts || {}, invest: invest || {} });
      }
      if (kind === 'cfg') {
        if (m === 'GET') return json((await store.get('empresa/cfg', { type: 'json' })) || null);
        if (m === 'PUT') { await store.setJSON('empresa/cfg', await req.json()); return json({ ok: 1 }); }
      }
      if (EK.includes(kind)) {
        const k = `empresa/${kind}`; const map = (await store.get(k, { type: 'json' })) || {};
        if (m === 'GET') return json(map);
        if (m === 'PUT' && id) { map[id] = await req.json(); await store.setJSON(k, map); return json({ ok: 1 }); }
        if (m === 'DELETE' && id) { delete map[id]; await store.setJSON(k, map); return json({ ok: 1 }); }
      }
    }

    if (parts[0] === 'shot' && parts[1]) {
      const id = parts[1];
      if (m === 'PUT') { const buf = await req.arrayBuffer(); await shots.set(id, buf); return json({ ok: 1, id }); }
      if (m === 'GET') { const buf = await shots.get(id, { type: 'arrayBuffer' }); if (!buf) return new Response('no existe', { status: 404 }); return new Response(buf, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000' } }); }
      if (m === 'DELETE') { await shots.delete(id); return json({ ok: 1 }); }
    }

    return json({ error: 'ruta' }, 404);
  } catch (e) {
    return json({ error: String(e && e.message || e) }, 500);
  }
};

export const config = { path: '/api/*' };
