-- Matchgenomgångar: en mall per lag (match_id är null) och en rad per match.
-- Uppställningen lagras som jsonb: lineup = placerade spelare med x/y (0–1),
-- bench = avbytarnas spelar-id. Offensiva/defensiva punkter lagras som text
-- där en rad = en punkt.

create table match_briefings (
	id uuid primary key default gen_random_uuid(),
	team_id uuid not null references teams(id) on delete cascade,
	match_id uuid references matches(id) on delete cascade,
	formation text,
	lineup jsonb not null default '[]'::jsonb,
	bench jsonb not null default '[]'::jsonb,
	offensive text,
	defensive text,
	note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- En mall per lag (raden där match_id är null)
create unique index match_briefings_template_idx
	on match_briefings (team_id)
	where match_id is null;

-- En genomgång per match och lag
create unique index match_briefings_match_idx
	on match_briefings (team_id, match_id)
	where match_id is not null;

-- Uppslag från schemat
create index match_briefings_match_lookup_idx on match_briefings (match_id);

alter table match_briefings enable row level security;

create policy "Alla får läsa matchgenomgångar" on match_briefings
	for select using (true);

create policy "Inloggade får ändra matchgenomgångar" on match_briefings
	for all to authenticated using (true) with check (true);

-- Live-uppdatering till schemakanalen även för genomgångar
create trigger match_briefings_broadcast
	after insert or update or delete on match_briefings
	for each row execute function broadcast_events_changes();
