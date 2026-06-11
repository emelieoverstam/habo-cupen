-- Trupper: spelare med namn, nummer och bild per lag.
-- Bilderna lagras i en publik storage-bucket ("spelare").
-- Ersätter den oanvända players-kolumnen på teams.

create table players (
	id uuid primary key default gen_random_uuid(),
	team_id uuid not null references teams(id) on delete cascade,
	name text not null,
	number int,
	photo_url text,
	created_at timestamptz not null default now()
);

create index players_team_idx on players(team_id);

alter table players enable row level security;

create policy "Alla får läsa spelare" on players
	for select using (true);

create policy "Inloggade får ändra spelare" on players
	for all to authenticated using (true) with check (true);

-- Live-uppdatering till schemakanalen även för truppändringar
create trigger players_broadcast
	after insert or update or delete on players
	for each row execute function broadcast_events_changes();

-- Publik bucket för spelarbilder
insert into storage.buckets (id, name, public) values ('spelare', 'spelare', true);

create policy "Alla får läsa spelarbilder" on storage.objects
	for select using (bucket_id = 'spelare');

create policy "Inloggade får ladda upp spelarbilder" on storage.objects
	for insert to authenticated with check (bucket_id = 'spelare');

create policy "Inloggade får ändra spelarbilder" on storage.objects
	for update to authenticated using (bucket_id = 'spelare') with check (bucket_id = 'spelare');

create policy "Inloggade får ta bort spelarbilder" on storage.objects
	for delete to authenticated using (bucket_id = 'spelare');

-- Gamla trupplistan på teams används inte längre
alter table teams drop column players;
