import { createClient } from '@supabase/supabase-js';

// Run from the repository root. Dry run by default; --apply only inserts missing rows.
const types = [
  ['Học thuật & công nghệ', 'Nghiên cứu, công nghệ, phân tích và đổi mới sáng tạo.'],
  ['Thể thao', 'Rèn luyện và thi đấu thể thao.'],
  ['Văn hóa & nghệ thuật', 'Âm nhạc, mỹ thuật, biểu diễn và các hoạt động văn hóa.'],
  ['Tình nguyện', 'Hoạt động cộng đồng và thiện nguyện.'],
  ['Kỹ năng', 'Rèn luyện kỹ năng và phát triển bản thân.'],
  ['Khác', 'Các câu lạc bộ thuộc lĩnh vực khác.'],
];
const assignments = [
  ['HUROS — Robotics và Thiết bị thông minh', 'Học thuật & công nghệ'],
  ['SINNO — Câu lạc bộ Sáng tạo SoICT', 'Học thuật & công nghệ'],
  ['HBAC — Câu lạc bộ Phân tích Kinh doanh', 'Học thuật & công nghệ'],
  ['Đá bóng', 'Thể thao'],
  ['AE siêu nhân', 'Thể thao'],
  ['testhai2', 'Khác'],
  ['testhai1', 'Khác'],
  ['AE 18', 'Khác'],
  ['aaaaaaaaaaaaaa', 'Khác'],
  ['sadsda', 'Khác'],
];
const apply = process.argv.includes('--apply');
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', types: types.map(([name]) => name), assignments }, null, 2));
if (apply) {
  process.loadEnvFile('backend/.env');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const check = (result, action) => {
    if (result.error) throw new Error(`${action} failed (${result.error.code || 'database error'})`);
    return result.data;
  };
  const published = check(await db.from('public_clubs').select('club_id,name'), 'Read public clubs');
  const byName = new Map(published.map(club => [club.name, club]));
  for (const [name] of assignments) {
    if (!byName.has(name)) throw new Error(`Published club missing: ${name}`);
  }
  const existing = check(await db.from('club_categories').select('category_id,name'), 'Read club types');
  const byType = new Map(existing.map(category => [category.name, category.category_id]));
  for (const [name, description] of types) {
    if (byType.has(name)) continue;
    const category = check(await db.from('club_categories')
      .insert({ name, description }).select('category_id').single(), 'Insert club type');
    byType.set(name, category.category_id);
    console.log(`Created type: ${name}`);
  }
  for (const [clubName, typeName] of assignments) {
    const club_id = byName.get(clubName).club_id;
    const category_id = byType.get(typeName);
    const linked = check(await db.from('club_category_links')
      .select('club_id').eq('club_id', club_id).eq('category_id', category_id), 'Read club type link');
    if (linked.length) continue;
    check(await db.from('club_category_links').insert({ club_id, category_id }), 'Insert club type link');
    console.log(`Linked: ${clubName} → ${typeName}`);
  }
  console.log('Club types ready.');
}
