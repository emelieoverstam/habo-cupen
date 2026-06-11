-- Habo-cupen 2026 – grundschema
-- Två tabeller: teams (lagen) och events (allt som händer under cupen).
-- team_id = null på ett event betyder att det gäller båda lagen.

create type event_type as enum ('match', 'mat', 'somn', 'hygien', 'samling', 'ovrigt');
create type event_status as enum ('confirmed', 'tbd', 'cancelled');

create table teams (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	color text not null,
	players text[] not null default '{}'
);

create table events (
	id uuid primary key default gen_random_uuid(),
	team_id uuid references teams(id) on delete cascade,
	type event_type not null,
	title text not null,
	starts_at timestamptz,
	location text,
	status event_status not null default 'confirmed',
	note text,
	sort_hint int,
	day date not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index events_day_idx on events(day);
create index events_team_idx on events(team_id);

-- Håll updated_at aktuell vid varje ändring
create function set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger events_updated_at
	before update on events
	for each row execute function set_updated_at();

-- RLS: öppen läsning för alla, skrivning bara för inloggade (alla inloggade är admins)
alter table teams enable row level security;
alter table events enable row level security;

create policy "Alla får läsa lag" on teams
	for select using (true);

create policy "Alla får läsa events" on events
	for select using (true);

create policy "Inloggade får ändra lag" on teams
	for all to authenticated using (true) with check (true);

create policy "Inloggade får ändra events" on events
	for all to authenticated using (true) with check (true);

-- Realtime: klienterna prenumererar på ändringar i events
alter publication supabase_realtime add table events;
