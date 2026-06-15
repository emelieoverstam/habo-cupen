-- Publicering av matchgenomgångar: ledare kan förbereda en genomgång (utkast)
-- och visa den för spelarna först när de publicerar. Nya genomgångar är utkast
-- som standard (published = false). Visningen i appen filtreras på klienten så
-- att bara publicerade genomgångar syns för spelarna.

alter table match_briefings
	add column published boolean not null default false;

-- Befintliga genomgångar var redan synliga i appen — behåll dem publicerade så
-- att inget försvinner oväntat när funktionen aktiveras.
update match_briefings set published = true;
