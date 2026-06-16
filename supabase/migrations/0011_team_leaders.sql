-- Ledare per lag: en enkel namnlista (en rad per namn) på teams. Visas på
-- Trupperna-sidan. Inga egna rader/tabell behövs — det räcker med namnen.

alter table teams add column leaders text;
