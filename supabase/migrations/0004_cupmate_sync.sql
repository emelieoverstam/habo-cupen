-- Cupmate-synk: matcher, gruppspelstabeller och synklås.
-- Datat hämtas från cupmate.nu (Habocupen 2026, klass F2013) av /api/sync
-- och skrivs med secret-nyckeln (förbi RLS). Klienter har bara läsrätt.

create table matches (
	id uuid primary key default gen_random_uuid(),
	cupmate_match_id int not null unique,
	match_no int,
	group_name text not null,
	stage text not null default 'group' check (stage in ('group', 'playoff')),
	home_team text not null,
	away_team text not null,
	home_score int,
	away_score int,
	starts_at timestamptz,
	day date,
	pitch text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index matches_day_idx on matches(day);

create table standings (
	id uuid primary key default gen_random_uuid(),
	group_name text not null,
	position int not null,
	team_name text not null,
	played int not null default 0,
	won int not null default 0,
	drawn int not null default 0,
	lost int not null default 0,
	goals text,
	goal_diff int,
	points int not null default 0,
	updated_at timestamptz not null default now(),
	unique (group_name, team_name)
);

-- Enradstabell som fungerar som lås så att synken inte stormkörs
create table sync_state (
	id int primary key default 1 check (id = 1),
	last_synced_at timestamptz,
	last_status text
);

insert into sync_state (id) values (1);

-- Håll updated_at aktuell
create trigger matches_updated_at
	before update on matches
	for each row execute function set_updated_at();

create trigger standings_updated_at
	before update on standings
	for each row execute function set_updated_at();

-- RLS: öppen läsning, inga skrivpolicies (bara secret-nyckeln skriver)
alter table matches enable row level security;
alter table standings enable row level security;
alter table sync_state enable row level security;

create policy "Alla får läsa matcher" on matches
	for select using (true);

create policy "Alla får läsa tabeller" on standings
	for select using (true);

-- Broadcast till schemakanalen vid ändringar (samma funktion som för events)
create trigger matches_broadcast
	after insert or update or delete on matches
	for each row execute function broadcast_events_changes();

create trigger standings_broadcast
	after insert or update or delete on standings
	for each row execute function broadcast_events_changes();
