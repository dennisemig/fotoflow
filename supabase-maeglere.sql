-- Mæglere pr. kunde (kundeprofil → "Mæglere")
-- Køres én gang i Supabase → SQL Editor. Kan godt køres igen uden skade.

create table if not exists kunde_maeglere (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid not null references kunder(id) on delete cascade,
  navn text not null,
  email text,            -- gemmes altid med små bogstaver
  telefon text,
  created_at timestamptz default now(),
  unique (kunde_id, email)
);

create index if not exists kunde_maeglere_kunde_idx on kunde_maeglere (kunde_id);

-- Kun indloggede brugere (dig) kan se og rette mæglerlisten. Ingen anonym adgang.
alter table kunde_maeglere enable row level security;
drop policy if exists "auth_all" on kunde_maeglere;
create policy "auth_all" on kunde_maeglere for all to authenticated using (true) with check (true);

-- Udfyld listen med de mæglere, der allerede står på kundens sager
-- (nyeste navn pr. email). Eksisterende rækker røres ikke.
insert into kunde_maeglere (kunde_id, navn, email)
select distinct on (s.kunde_id, lower(trim(s.maegler_email)))
  s.kunde_id,
  coalesce(nullif(trim(s.maegler_navn), ''), lower(trim(s.maegler_email))),
  lower(trim(s.maegler_email))
from sager s
where s.kunde_id is not null
  and nullif(trim(s.maegler_email), '') is not null
order by s.kunde_id, lower(trim(s.maegler_email)), s.created_at desc
on conflict (kunde_id, email) do nothing;

-- Tjek: antal mæglere pr. kunde
select k.navn as kunde, count(m.id) as maeglere
from kunder k left join kunde_maeglere m on m.kunde_id = k.id
group by k.navn order by k.navn;
