-- Lagindelning i poängjakten: vilka spelare som ingår i varje grupp. Lagras som
-- en jsonb-array med spelar-id, fylls och blandas om från admin ("Lotta om").
-- quest_groups har redan en broadcast-trigger, så ändringar uppdateras live.

alter table quest_groups
	add column member_ids jsonb not null default '[]'::jsonb;
