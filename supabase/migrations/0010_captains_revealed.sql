-- Avslöjande av kaptener: ledare kan dölja vilka som är kaptener tills de väljer
-- att presentera dem ("kaptenerna presenteras senare"). Dolt som standard
-- (captains_revealed = false). Visningen filtreras på klienten/servern.

alter table captain_info
	add column captains_revealed boolean not null default false;
