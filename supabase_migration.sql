-- ============================================
-- FotoFlow – Database Migration
-- Kør dette script i Supabase SQL Editor
-- ============================================

-- BRUGERE (udvider Supabase auth)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  navn text,
  email text,
  telefon text,
  rolle text default 'admin', -- admin | freelancer
  startadresse text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

-- KUNDER (CRM)
create table public.kunder (
  id uuid default gen_random_uuid() primary key,
  navn text not null,
  email text,
  telefon text,
  noter text,
  tags text[],
  created_at timestamp with time zone default now(),
  created_by uuid references public.profiles(id)
);

-- SAGER
create table public.sager (
  id uuid default gen_random_uuid() primary key,
  sagsnummer text unique,
  kunde_id uuid references public.kunder(id),
  adresse text not null,
  postnr text,
  by text,
  dato date,
  tidspunkt time,
  status text default 'ny', -- ny | aktiv | afventer | afsluttet | leveret
  type text, -- portræt | ejendom | bryllup | event | mode
  beskrivelse text,
  noter text,
  km numeric,
  minutter integer,
  -- BBR data
  boligareal integer,
  grundareal integer,
  etager integer,
  byggeaar integer,
  boligtype text,
  -- Pakke
  pakke_id uuid,
  tillaeg_ids uuid[],
  -- Freelancer
  freelancer_id uuid references public.profiles(id),
  -- Maks billeder
  max_billeder integer default 20,
  created_at timestamp with time zone default now(),
  created_by uuid references public.profiles(id)
);

-- FREELANCERE (ekstra info)
create table public.freelancere (
  id uuid references public.profiles(id) primary key,
  specialer text[],
  -- Adgangsrettigheder
  kan_uploade boolean default true,
  kan_se_sagsdetaljer boolean default true,
  kan_se_alle_sager boolean default false,
  kan_redigere_sager boolean default false,
  kan_se_crm boolean default false,
  aktiv boolean default true,
  invited_at timestamp with time zone default now()
);

-- UPLOADS (billeder på sager)
create table public.uploads (
  id uuid default gen_random_uuid() primary key,
  sag_id uuid references public.sager(id) on delete cascade,
  filnavn text not null,
  dropbox_path text,
  type text default 'raw', -- raw | leveret
  ai_tag text,
  bruger_tag text,
  sort_order integer default 0,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamp with time zone default now()
);

-- PAKKER
create table public.pakker (
  id uuid default gen_random_uuid() primary key,
  navn text not null,
  beskrivelse text,
  pris numeric not null,
  max_billeder integer not null,
  leveringstid text,
  features text[],
  popular boolean default false,
  aktiv boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default now()
);

-- TILLÆG
create table public.tillaeg (
  id uuid default gen_random_uuid() primary key,
  navn text not null,
  beskrivelse text,
  pris numeric not null,
  ikon text default '➕',
  aktiv boolean default true,
  created_at timestamp with time zone default now()
);

-- BOOKINGER (fra mæglere via portal)
create table public.bookinger (
  id uuid default gen_random_uuid() primary key,
  adresse text not null,
  dato date,
  tidspunkt time,
  maegler_navn text,
  maegler_email text,
  maegler_firma text,
  pakke_id uuid references public.pakker(id),
  tillaeg_ids uuid[],
  noter text,
  status text default 'afventer', -- afventer | godkendt | afvist
  sag_id uuid references public.sager(id),
  -- BBR
  boligareal integer,
  grundareal integer,
  etager integer,
  km numeric,
  created_at timestamp with time zone default now()
);

-- TO-DO
create table public.todos (
  id uuid default gen_random_uuid() primary key,
  tekst text not null,
  type text default 'generel', -- generel | sag
  sag_id uuid references public.sager(id) on delete cascade,
  prioritet text default 'med', -- high | med | low
  frist date,
  done boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone default now()
);

-- NOTIFIKATIONER
create table public.notifikationer (
  id uuid default gen_random_uuid() primary key,
  bruger_id uuid references public.profiles(id),
  titel text,
  besked text,
  type text, -- booking | upload | levering | system
  laest boolean default false,
  link text,
  created_at timestamp with time zone default now()
);

-- KOERSEL LOG
create table public.koersel (
  id uuid default gen_random_uuid() primary key,
  sag_id uuid references public.sager(id) on delete cascade,
  bruger_id uuid references public.profiles(id),
  fra_adresse text,
  til_adresse text,
  km numeric,
  minutter integer,
  dato date,
  created_at timestamp with time zone default now()
);

-- ============================================
-- ROW LEVEL SECURITY (GDPR)
-- ============================================

alter table public.profiles enable row level security;
alter table public.kunder enable row level security;
alter table public.sager enable row level security;
alter table public.freelancere enable row level security;
alter table public.uploads enable row level security;
alter table public.pakker enable row level security;
alter table public.tillaeg enable row level security;
alter table public.bookinger enable row level security;
alter table public.todos enable row level security;
alter table public.notifikationer enable row level security;
alter table public.koersel enable row level security;

-- Profiles: se egen profil
create policy "Se egen profil" on public.profiles for select using (auth.uid() = id);
create policy "Opdater egen profil" on public.profiles for update using (auth.uid() = id);

-- Admin ser alt
create policy "Admin ser alle kunder" on public.kunder for all using (
  exists (select 1 from public.profiles where id = auth.uid() and rolle = 'admin')
);
create policy "Admin ser alle sager" on public.sager for all using (
  exists (select 1 from public.profiles where id = auth.uid() and rolle = 'admin')
);

-- Freelancer ser kun egne sager
create policy "Freelancer ser egne sager" on public.sager for select using (
  freelancer_id = auth.uid()
);

-- Uploads: freelancer kan uploade til egne sager
create policy "Upload til egne sager" on public.uploads for insert with check (
  exists (select 1 from public.sager where id = sag_id and (
    created_by = auth.uid() or freelancer_id = auth.uid()
  ))
);
create policy "Se uploads på egne sager" on public.uploads for select using (
  exists (select 1 from public.sager where id = sag_id and (
    exists (select 1 from public.profiles where id = auth.uid() and rolle = 'admin')
    or freelancer_id = auth.uid()
  ))
);

-- Pakker og tillæg: alle kan se
create policy "Alle ser pakker" on public.pakker for select using (true);
create policy "Alle ser tillaeg" on public.tillaeg for select using (true);
create policy "Admin administrerer pakker" on public.pakker for all using (
  exists (select 1 from public.profiles where id = auth.uid() and rolle = 'admin')
);
create policy "Admin administrerer tillaeg" on public.tillaeg for all using (
  exists (select 1 from public.profiles where id = auth.uid() and rolle = 'admin')
);

-- Notifikationer: se egne
create policy "Se egne notifikationer" on public.notifikationer for all using (bruger_id = auth.uid());

-- Todos: se egne
create policy "Se egne todos" on public.todos for all using (created_by = auth.uid());

-- Koersel: admin ser alle, freelancer ser egne
create policy "Admin ser al koersel" on public.koersel for select using (
  exists (select 1 from public.profiles where id = auth.uid() and rolle = 'admin')
);
create policy "Freelancer ser egen koersel" on public.koersel for select using (bruger_id = auth.uid());

-- ============================================
-- SAMPLE DATA – Pakker
-- ============================================
insert into public.pakker (navn, beskrivelse, pris, max_billeder, leveringstid, features, popular, sort_order) values
('Basis', 'Perfekt til mindre ejendomme og lejligheder', 1995, 10, '24 timer', ARRAY['Op til 10 redigerede billeder', 'Standard HDR-behandling', 'Levering via Mindworking'], false, 1),
('Standard', 'Vores mest populære pakke til alle boligtyper', 2995, 20, '48 timer', ARRAY['Op til 20 redigerede billeder', 'HDR-behandling', 'Levering via Mindworking', 'Preview-link til sælger'], true, 2),
('Premium', 'Komplet løsning til større og eksklusive ejendomme', 4495, 35, '48 timer', ARRAY['Op til 35 redigerede billeder', 'HDR-behandling', 'Levering via Mindworking', 'Preview-link til sælger', 'Drone inkluderet', 'Twilight shot inkluderet'], false, 3);

insert into public.tillaeg (navn, beskrivelse, pris, ikon) values
('Drone', 'Luftfoto med drone – op til 5 billeder', 795, '🚁'),
('Twilight', 'Magiske billeder ved solnedgang', 595, '🌅'),
('Planløsning', '2D planløsning af ejendommen', 495, '📐'),
('Virtual Staging', 'Digital møblering af tomme rum', 995, '🛋'),
('Ekstra billeder', '10 ekstra billeder udover pakken', 395, '📷');
