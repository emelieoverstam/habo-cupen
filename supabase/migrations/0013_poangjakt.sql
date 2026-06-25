-- Poängjakt: uppdrag med poäng, grupper, godkända uppdrag per grupp, samt ett
-- singleton-tillstånd för timern (90 min) och publicering av uppdragen.

create table quest_tasks (
	id uuid primary key default gen_random_uuid(),
	title text not null,
	points int not null default 0,
	sort_hint int,
	created_at timestamptz not null default now()
);

create table quest_groups (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	color text,
	sort_hint int,
	created_at timestamptz not null default now()
);

-- En rad = uppdraget godkänt för gruppen. Unikt per grupp+uppdrag.
create table quest_completions (
	id uuid primary key default gen_random_uuid(),
	group_id uuid not null references quest_groups(id) on delete cascade,
	task_id uuid not null references quest_tasks(id) on delete cascade,
	created_at timestamptz not null default now(),
	unique (group_id, task_id)
);

create index quest_completions_group_idx on quest_completions(group_id);
create index quest_completions_task_idx on quest_completions(task_id);

-- Singleton: timerns starttid, längd och om uppdragen är publicerade
create table quest_state (
	id uuid primary key default gen_random_uuid(),
	started_at timestamptz,
	duration_minutes int not null default 90,
	tasks_published boolean not null default false,
	updated_at timestamptz not null default now()
);

alter table quest_tasks enable row level security;
alter table quest_groups enable row level security;
alter table quest_completions enable row level security;
alter table quest_state enable row level security;

create policy "Alla får läsa uppdrag" on quest_tasks
	for select using (true);
create policy "Inloggade får ändra uppdrag" on quest_tasks
	for all to authenticated using (true) with check (true);

create policy "Alla får läsa grupper" on quest_groups
	for select using (true);
create policy "Inloggade får ändra grupper" on quest_groups
	for all to authenticated using (true) with check (true);

create policy "Alla får läsa godkännanden" on quest_completions
	for select using (true);
create policy "Inloggade får ändra godkännanden" on quest_completions
	for all to authenticated using (true) with check (true);

create policy "Alla får läsa poängjaktsläget" on quest_state
	for select using (true);
create policy "Inloggade får ändra poängjaktsläget" on quest_state
	for all to authenticated using (true) with check (true);

-- Live-uppdatering via samma broadcast-kanal som övriga tabeller
create trigger quest_tasks_broadcast
	after insert or update or delete on quest_tasks
	for each row execute function broadcast_events_changes();
create trigger quest_groups_broadcast
	after insert or update or delete on quest_groups
	for each row execute function broadcast_events_changes();
create trigger quest_completions_broadcast
	after insert or update or delete on quest_completions
	for each row execute function broadcast_events_changes();
create trigger quest_state_broadcast
	after insert or update or delete on quest_state
	for each row execute function broadcast_events_changes();

-- Håll updated_at aktuell på state-raden
create trigger quest_state_updated_at
	before update on quest_state
	for each row execute function set_updated_at();

-- En tom state-rad så att timern/publicering alltid finns att uppdatera
insert into quest_state default values;
