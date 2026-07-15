-- ≈4K каталог: 1-й фильм CSM = сборник/компиляция 1 сезона (MAL 62352), не Reze (57555)
DELETE FROM public.catalog_4k_anime WHERE mal_id IN (57555, 59062);

INSERT INTO public.catalog_4k_anime (mal_id, jikan, title_ru, description_ru, poster_url, published)
VALUES (
  62352,
  '{
    "mal_id": 62352,
    "title": "Chainsaw Man Recap",
    "title_english": "Chainsaw Man: The Compilation",
    "title_japanese": "チェンソーマン 総集篇",
    "title_synonyms": ["CSM", "Chainsaw Man Soushuuhen"],
    "type": "ONA",
    "source": "Manga",
    "episodes": 2,
    "status": "Finished Airing",
    "aired": { "string": "Sep 5, 2025" },
    "duration": "1 hr 47 min per ep",
    "rating": "R - 17+ (violence & profanity)",
    "score": 7.79,
    "year": 2025,
    "synopsis": "Re-edited compilation of Chainsaw Man TV season 1 (two parts). Part 1 covers the first half of the story.",
    "studios": [{ "mal_id": 569, "name": "MAPPA" }],
    "genres": [{ "name": "Action" }, { "name": "Fantasy" }],
    "themes": [{ "name": "Gore" }, { "name": "Urban Fantasy" }],
    "demographics": [{ "name": "Shounen" }],
    "images": {
      "jpg": {
        "image_url": "https://shikimori.io/uploads/poster/animes/62352/ca67032240b9c2e5c5316dd266a32a4d.jpeg",
        "large_image_url": "https://shikimori.io/uploads/poster/animes/62352/ca67032240b9c2e5c5316dd266a32a4d.jpeg"
      }
    }
  }'::jsonb,
  'Человек-бензопила: Сборник (1-й фильм)',
  'Первая часть сборника по 1 сезону (компиляция MAPPA, 2025). Не путать с фильмом «История Резе».',
  'https://shikimori.io/uploads/poster/animes/62352/ca67032240b9c2e5c5316dd266a32a4d.jpeg',
  true
)
ON CONFLICT (mal_id) DO UPDATE SET
  jikan = EXCLUDED.jikan,
  title_ru = EXCLUDED.title_ru,
  description_ru = EXCLUDED.description_ru,
  poster_url = EXCLUDED.poster_url,
  published = EXCLUDED.published;
