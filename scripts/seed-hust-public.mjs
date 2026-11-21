import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Run from repository root. Dry run by default; credentials stay backend-only.
process.loadEnvFile('backend/.env');
const manifest = JSON.parse(await readFile('data/hust-public.json', 'utf8'));
const apply = process.argv.includes('--apply');
const owner = process.argv.find(x => x.startsWith('--owner='))?.slice(8);
const id = key => {
  const h = createHash('sha256').update(`hust-public-v1:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const sourceText = item => `${item.text}\n\nNguồn: ${item.sources.join('\n')}\nBiên soạn từ nguồn công khai ngày ${manifest.researched_at}.`;
const stamp = '2026-11-15T12:00:00+07:00';
const note = 'hust-public-v1: Nội dung tham khảo nhập từ nguồn công khai; không đại diện quản trị CLB.';
const tables = {
  clubs: manifest.clubs.map(c => ({ club_id: id(c.key), name: c.name, summary: c.summary,
    description: sourceText(c), mission: c.mission, cover_url: c.cover_url,
    logo_url: c.logo_url, contact_email: c.contact_email ?? null,
    status: 'published', created_by: owner, published_at: stamp,
    reviewed_by: owner, reviewed_at: stamp, review_note: note })),
  club_activities: manifest.activities.map(a => ({ activity_id: id(a.key), club_id: id(a.club),
    title: a.title, summary: a.summary, description: sourceText(a), cover_url: a.cover_url,
    starts_at: a.starts_at, ends_at: a.ends_at, format: a.format,
    location_name: a.location_name, location_address: 'Đại học Bách khoa Hà Nội, số 1 Đại Cồ Việt, Hà Nội',
    publication_status: 'published', lifecycle_status: 'completed',
    registration_opens_at: a.registration_opens_at, registration_closes_at: a.registration_closes_at,
    created_by: owner, submitted_at: stamp, reviewed_by: owner, reviewed_at: stamp,
    published_at: stamp, review_note: note })),
  club_posts: manifest.posts.map(p => ({ post_id: id(p.key), club_id: id(p.club), author_id: owner,
    title: p.title, summary: p.summary, content: sourceText(p), cover_url: p.cover_url,
    visibility: 'public', publication_status: 'published', submitted_at: stamp,
    reviewed_by: owner, reviewed_at: stamp, published_at: stamp, review_note: note })),
};

async function api(path, options = {}) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options, headers: { apikey: process.env.SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json', ...options.headers }, signal: AbortSignal.timeout(30000),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`Database HTTP ${r.status}: ${body.code ?? 'unknown'} ${body.message ?? ''}`);
  return body;
}

try {
  for (const item of [...manifest.clubs, ...manifest.activities, ...manifest.posts]) {
    if (!item.sources?.length || !item.text) throw new Error('Missing source or text');
    for (const field of ['cover_url', 'logo_url']) if (item[field]) {
      if (!item[field].startsWith('/images/hust/')) throw new Error('Unexpected asset path');
      await access(`frontend/public${item[field]}`);
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', counts: Object.fromEntries(
    Object.entries(tables).map(([t, rows]) => [t, rows.length])) }));
  if (apply) {
    if (!owner || !/^[a-f0-9-]{36}$/i.test(owner)) throw new Error('Provide an existing owner UUID with --owner=');
    const users = await api(`users?select=user_id&user_id=eq.${owner}`);
    if (users.length !== 1) throw new Error('Owner does not exist');
    const existing = await api('clubs?select=club_id,name');
    for (const c of tables.clubs) if (existing.some(x => x.name === c.name && x.club_id !== c.club_id)) {
      throw new Error(`Existing club name conflict: ${c.name}`);
    }
    // Each table is one atomic batch. Never overwrite existing rows on a rerun.
    // Cross-table REST calls are not one transaction; a failed run can be resumed.
    for (const [table, rows] of Object.entries(tables)) {
      const pk = { clubs: 'club_id', club_activities: 'activity_id', club_posts: 'post_id' }[table];
      // Content triggers require a draft to exist before publication.
      const inserts = table === 'clubs' ? rows : rows.map(row => ({ ...row,
        publication_status: 'draft', submitted_at: null, reviewed_by: null,
        reviewed_at: null, published_at: null }));
      const inserted = await api(`${table}?on_conflict=${pk}&select=${pk}`, {
        method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
        body: JSON.stringify(inserts),
      });
      console.log(`${table}: inserted ${inserted.length}`);
      if (table !== 'clubs') for (const row of rows) {
        const ownerKey = table === 'club_posts' ? 'author_id' : 'created_by';
        const [current] = await api(`${table}?${pk}=eq.${row[pk]}&select=publication_status,title,${table === 'club_posts' ? 'content' : 'description'},${ownerKey}`);
        if (current?.publication_status === 'published') continue;
        const textKey = table === 'club_posts' ? 'content' : 'description';
        if (current?.title !== row.title || current[textKey] !== row[textKey] || current[ownerKey] !== owner) {
          throw new Error(`${table}: existing draft was edited; refusing to publish it`);
        }
        if (current.publication_status === 'draft') await api(`${table}?${pk}=eq.${row[pk]}&select=${pk}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ publication_status: 'pending_review', submitted_at: stamp }),
        });
        await api(`${table}?${pk}=eq.${row[pk]}&select=${pk}`, {
          method: 'PATCH', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ publication_status: 'published', submitted_at: stamp,
            reviewed_by: owner, reviewed_at: stamp, published_at: stamp, review_note: note }),
        });
      }
    }
    for (const [table, rows] of Object.entries(tables)) {
      const pk = { clubs: 'club_id', club_activities: 'activity_id', club_posts: 'post_id' }[table];
      const publicRows = await api(`public_${table}?select=${pk}&${pk}=in.(${rows.map(x => x[pk]).join(',')})`);
      if (publicRows.length !== rows.length) throw new Error(`${table}: public visibility mismatch ${publicRows.length}/${rows.length}`);
      console.log(`public_${table}: verified ${publicRows.length}`);
    }
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
