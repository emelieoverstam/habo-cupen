-- Personliga ledar-konton: profiler (konto → namn) för "Vem är du?"-inloggning
-- och attribution ("senast ändrad av"). Själva auth-kontona skapas separat via
-- admin-API:t (PIN = lösenord).

create table profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	name text not null,
	login_email text not null
);

alter table profiles enable row level security;

-- Alla får läsa profiler (behövs för inloggnings-listan och "ändrad av")
create policy "Alla får läsa profiler" on profiles
	for select using (true);

-- Seeda profiler från befintliga konton (kopplar via e-post — inga hårdkodade id)
insert into profiles (id, name, login_email)
select u.id, x.name, u.email
from (values
	('emelie@reklamco.se', 'Emelie Överstam'),
	('orvar@habo-cupen.app', 'Örvar Kristinsson'),
	('therese@habo-cupen.app', 'Therese Carlsson'),
	('daniel@habo-cupen.app', 'Daniel Bergh'),
	('thomas@habo-cupen.app', 'Thomas Herbertsson'),
	('josefine@habo-cupen.app', 'Josefine Swärm')
) as x(email, name)
join auth.users u on u.email = x.email
on conflict (id) do nothing;

-- Vem som senast ändrade en hålltid / matchgenomgång
alter table events add column updated_by uuid references auth.users(id);
alter table match_briefings add column updated_by uuid references auth.users(id);

-- Sätt updated_by automatiskt till den inloggade ledaren vid skrivning
create or replace function set_updated_by()
returns trigger
language plpgsql
as $$
begin
	new.updated_by := auth.uid();
	return new;
end;
$$;

create trigger events_set_updated_by
	before insert or update on events
	for each row execute function set_updated_by();

create trigger match_briefings_set_updated_by
	before insert or update on match_briefings
	for each row execute function set_updated_by();
