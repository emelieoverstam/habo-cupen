-- Broadcast från databasen i stället för postgres_changes
-- (rekommenderat av Supabase och det enda som levereras i nya projekt).
-- Alla ändringar i events sänds till topicen "schedule".

create or replace function public.broadcast_events_changes()
returns trigger
security definer
set search_path = ''
language plpgsql
as $$
begin
	perform realtime.broadcast_changes(
		'schedule',      -- topic: en gemensam kanal för hela schemat
		TG_OP,           -- event
		TG_OP,           -- operation
		TG_TABLE_NAME,   -- tabell
		TG_TABLE_SCHEMA, -- schema
		NEW,             -- ny rad (null vid delete)
		OLD              -- gammal rad (null vid insert)
	);
	return null;
end;
$$;

create trigger events_broadcast
	after insert or update or delete on public.events
	for each row execute function public.broadcast_events_changes();

-- Realtime Authorization: alla, även anonyma besökare, får lyssna på schemakanalen
create policy "Alla får lyssna på schemat"
	on realtime.messages
	for select
	to anon, authenticated
	using (realtime.topic() = 'schedule');
