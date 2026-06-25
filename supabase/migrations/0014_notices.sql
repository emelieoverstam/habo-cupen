-- Notiser: en anslagstavla där ledarna postar korta meddelanden under cupen.
-- team_id = null betyder att notisen gäller båda lagen (etikett, inte filter).

create table notices (
	id uuid primary key default gen_random_uuid(),
	team_id uuid references teams(id) on delete cascade,
	body text not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index notices_created_idx on notices (created_at desc);

alter table notices enable row level security;

create policy "Alla får läsa notiser" on notices
	for select using (true);

create policy "Inloggade får ändra notiser" on notices
	for all to authenticated using (true) with check (true);

-- Håll updated_at aktuell vid ändringar (samma mönster som events)
create trigger notices_updated_at
	before update on notices
	for each row execute function set_updated_at();

-- Live-uppdatering: sänd ändringar till schemakanalen (återanvänder den
-- generiska broadcast-funktionen). Ingen publication-ändring behövs.
create trigger notices_broadcast
	after insert or update or delete on notices
	for each row execute function broadcast_events_changes();
