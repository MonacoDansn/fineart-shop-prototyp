-- Einmal im Supabase SQL Editor ausführen (Supabase > SQL Editor > New query > Run).
-- Legt die Tabelle für Bewertungen an. Jeder darf bewerten und lesen,
-- aber niemand darf fremde Einträge ändern oder löschen.

create table if not exists public.bewertungen (
  id          bigint generated always as identity primary key,
  motiv_id    text        not null check (char_length(motiv_id) <= 8),
  note        smallint    not null check (note between 1 and 5),
  kommentar   text        check (char_length(kommentar) <= 1000),
  name        text        check (char_length(name) <= 60),
  geraet      text        check (char_length(geraet) <= 40),
  erstellt_am timestamptz not null default now()
);

alter table public.bewertungen enable row level security;

drop policy if exists "alle duerfen lesen" on public.bewertungen;
create policy "alle duerfen lesen" on public.bewertungen
  for select to anon using (true);

drop policy if exists "alle duerfen bewerten" on public.bewertungen;
create policy "alle duerfen bewerten" on public.bewertungen
  for insert to anon with check (true);

-- Neue Supabase Projekte vergeben keine Rechte automatisch
grant usage on schema public to anon;
grant select, insert on public.bewertungen to anon;

-- Übersicht pro Motiv (für die Auswertung)
create or replace view public.bewertung_uebersicht
with (security_invoker = true) as
select motiv_id,
       count(*)                         as anzahl,
       round(avg(note)::numeric, 2)     as schnitt,
       count(kommentar) filter (where kommentar <> '') as kommentare
from public.bewertungen
group by motiv_id;

grant select on public.bewertung_uebersicht to anon;
