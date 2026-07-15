'use strict';
const fs = require('fs');
const path = require('path');

async function main() {
    const res = await fetch('https://api.jikan.moe/v4/anime/57555');
    const json = await res.json();
    const d = json.data;
    const jikanJson = JSON.stringify(d).replace(/'/g, "''");
    const poster = d.images?.jpg?.large_image_url || d.images?.jpg?.image_url || '';
    const sql = `-- Исправление: 59062 = Gachiakuta, фильм Reze = 57555
DELETE FROM public.catalog_4k_anime WHERE mal_id = 59062;

INSERT INTO public.catalog_4k_anime (mal_id, jikan, title_ru, poster_url, published)
VALUES (
  57555,
  '${jikanJson}'::jsonb,
  'Человек-бензопила. Фильм: История Резе',
  '${poster.replace(/'/g, "''")}',
  true
)
ON CONFLICT (mal_id) DO UPDATE SET
  jikan = EXCLUDED.jikan,
  title_ru = EXCLUDED.title_ru,
  poster_url = EXCLUDED.poster_url,
  published = EXCLUDED.published;
`;
    const out = path.join(__dirname, '..', '..', '..', 'sql', 'pending', '20260715_catalog_4k_fix_reze_mal_id.sql');
    fs.writeFileSync(out, sql, 'utf8');
    console.log('OK', out, sql.length);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
