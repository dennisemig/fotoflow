-- Mails på sager: manuelle tilknytninger og mails, der er skjult fra en sag.
-- Køres én gang i Supabase → SQL Editor. Kan godt køres igen uden skade.

create table if not exists mail_tilknytninger (
  id uuid primary key default gen_random_uuid(),
  sag_id uuid not null references sager(id) on delete cascade,
  message_id text not null,   -- mailens Message-ID, fx <abc@nybolig.dk>
  mappe text,                 -- IMAP-mappe da den blev tilknyttet (fx INBOX)
  uid integer,
  emne text,
  fra text,
  dato timestamptz,
  skjult boolean not null default false, -- true = vis ikke mailen på sagen, selvom den matcher
  created_at timestamptz default now(),
  unique (sag_id, message_id)
);

create index if not exists mail_tilknytninger_message_idx on mail_tilknytninger (message_id);

-- Kun indloggede brugere. Ingen anonym adgang.
alter table mail_tilknytninger enable row level security;
drop policy if exists "auth_all" on mail_tilknytninger;
create policy "auth_all" on mail_tilknytninger for all to authenticated using (true) with check (true);
