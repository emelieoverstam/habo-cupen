-- Spelare kan läggas in utan lag och placeras i Vit/Grön senare
alter table players alter column team_id drop not null;
