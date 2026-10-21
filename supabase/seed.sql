-- Permanent games.
insert into public.games (slug, name, official_url, description, category, estimated_minutes, score_type, score_direction, max_score, result_parser_type, submission_methods, is_permanent, active, verified_at)
values
 ('krillion', 'Krillion', 'https://krillion.io/', 'Seven prompts. Rarer answers earn more.', 'Trivia', 5, 'points', 'higher_better', 700, 'krillion', '{share_text,screenshot,manual}', true, true, now()),
 ('fermi', 'Fermi', 'https://fermi.gg/', 'Estimate the unknowable. Closer is better.', 'Estimation', 5, 'multiplier', 'lower_better', null, 'fermi', '{share_text,screenshot,manual}', true, true, now())
on conflict (slug) do nothing;

-- Mystery-game CANDIDATES. All inactive and unverified: nothing here is selectable until a human
-- completes the checklist (free, mobile, daily/shared challenge, 2-10 min, stable URL, reliable
-- completion/score submission, no required account/subscription) and sets active=true + verified_at.
-- Notes record what was and wasn't confirmed from public sources at the time of writing.
insert into public.games (slug, name, official_url, description, category, estimated_minutes, score_type, score_direction, result_parser_type, submission_methods, mystery_eligible, active, verification_notes)
values
 ('timeguessr', 'TimeGuessr', 'https://timeguessr.com/', 'Guess where and when a historical photo was taken.', 'History & Geography', 5, 'points', 'higher_better', 'manual', '{manual}', true, false,
  'Public sources: free in browser, 5-photo daily challenge, up to 5000 pts/photo, share option exists. UNCONFIRMED: exact share-text format; whether any account is needed. Needs a real share sample.'),
 ('anything-grid', 'Anything Grid', 'https://anythinggrid.com/', 'Fill a 3x3 grid; the more obscure your answers, the lower your score.', 'Trivia', 6, 'points', 'lower_better', 'manual', '{manual}', true, false,
  'Only a Product Hunt listing found: free, no signup, new grid at midnight ET, lower is better. UNCONFIRMED: official URL and share format.'),
 ('globle', 'Globle', 'https://globle-game.com/', 'Find the mystery country using distance and colour clues.', 'Geography', 4, 'points', 'lower_better', 'manual', '{manual}', true, false,
  'Daily country; share button exists. UNCONFIRMED: official URL (several look-alikes exist), exact share text, mobile behaviour.'),
 ('minute-cryptic', 'Minute Cryptic', 'https://www.minutecryptic.com/', 'One handcrafted cryptic clue a day, with a spoiler-free share card.', 'Word Puzzle', 3, 'completion_only', 'none', 'manual', '{manual}', true, false,
  'Free daily clue; sources conflict on whether an account is needed. UNCONFIRMED: official URL, share format.')
on conflict (slug) do nothing;
