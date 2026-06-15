-- Kaptener: två utvalda kaptener per lag (is_captain på spelare), en matchkapten
-- per genomgång (captain_id) som visas som "C" på planen, samt en gemensam text
-- med vad lagkaptenen ansvarar för.

-- Utvalda kaptener (mjuk regel om max två per lag — hanteras i admin, inte i db)
alter table players
	add column is_captain boolean not null default false;

-- Matchkaptenen för en genomgång. set null om spelaren tas bort ur truppen.
alter table match_briefings
	add column captain_id uuid references players(id) on delete set null;

-- Gemensam text om kaptenens ansvar (en punkt per rad). Singleton-rad som
-- admin redigerar; saknas raden skapar admin den vid första sparningen.
create table captain_info (
	id uuid primary key default gen_random_uuid(),
	responsibilities text,
	updated_at timestamptz not null default now()
);

alter table captain_info enable row level security;

create policy "Alla får läsa kaptensinfo" on captain_info
	for select using (true);

create policy "Inloggade får ändra kaptensinfo" on captain_info
	for all to authenticated using (true) with check (true);

-- Håll updated_at aktuell vid ändringar (samma mönster som övriga tabeller)
create trigger captain_info_updated_at
	before update on captain_info
	for each row execute function set_updated_at();
