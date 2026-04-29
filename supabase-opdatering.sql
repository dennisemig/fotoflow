-- =============================================
-- FOTOFLOW v2 – Opdateret migration
-- Kør KUN dette hvis du starter helt forfra
-- Ellers kør kun ALTER TABLE sektionen nedenfor
-- =============================================

-- Tilføj manglende kolonner til eksisterende tabeller
-- (Kør disse linjer hvis du allerede har kørt det første script)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefon TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS startadresse TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rettigheder JSONB DEFAULT '{"upload":true,"se_sag":true,"se_alle":false,"rediger":false,"crm":false}';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS aktiv BOOLEAN DEFAULT true;

ALTER TABLE sager ADD COLUMN IF NOT EXISTS km_distance NUMERIC;
ALTER TABLE sager ADD COLUMN IF NOT EXISTS bbr_data JSONB;
ALTER TABLE sager ADD COLUMN IF NOT EXISTS maks_billeder INTEGER DEFAULT 20;
ALTER TABLE sager ADD COLUMN IF NOT EXISTS tidspunkt TEXT;
ALTER TABLE sager ADD COLUMN IF NOT EXISTS noter TEXT;
ALTER TABLE sager ADD COLUMN IF NOT EXISTS pakke_id UUID;
ALTER TABLE sager ADD COLUMN IF NOT EXISTS tillaeg TEXT[];

-- Opret bookings tabel hvis den ikke findes
CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  adresse TEXT NOT NULL,
  dato DATE,
  tidspunkt TEXT,
  maegler_navn TEXT,
  maegler_email TEXT,
  maegler_firma TEXT,
  pakke TEXT,
  tillaeg TEXT[],
  noter TEXT,
  status TEXT DEFAULT 'afventer' CHECK (status IN ('afventer','godkendt','afvist')),
  bbr_data JSONB,
  sag_id UUID REFERENCES sager(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opret todos tabel
CREATE TABLE IF NOT EXISTS todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tekst TEXT NOT NULL,
  prioritet TEXT DEFAULT 'med' CHECK (prioritet IN ('high','med','low')),
  frist DATE,
  done BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'generel',
  sag_id UUID REFERENCES sager(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pakker og tillæg
CREATE TABLE IF NOT EXISTS pakker (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  navn TEXT NOT NULL,
  beskrivelse TEXT,
  pris NUMERIC NOT NULL,
  maks_billeder INTEGER DEFAULT 20,
  leveringstid TEXT DEFAULT '48 timer',
  popular BOOLEAN DEFAULT false,
  features TEXT[],
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tillaeg (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  navn TEXT NOT NULL,
  beskrivelse TEXT,
  pris NUMERIC NOT NULL,
  ikon TEXT DEFAULT '➕',
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for nye tabeller
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pakker ENABLE ROW LEVEL SECURITY;
ALTER TABLE tillaeg ENABLE ROW LEVEL SECURITY;

-- Midlertidigt: Tillad alle autentificerede brugere at læse/skrive
-- (Du kan stramme dette op senere)
CREATE POLICY IF NOT EXISTS "auth_all" ON bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth_all" ON todos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth_all" ON pakker FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth_all" ON tillaeg FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tillad anon at indsætte bookings (mæglere er ikke logget ind)
CREATE POLICY IF NOT EXISTS "anon_insert_bookings" ON bookings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "anon_select_pakker" ON pakker FOR SELECT TO anon USING (aktiv = true);
CREATE POLICY IF NOT EXISTS "anon_select_tillaeg" ON tillaeg FOR SELECT TO anon USING (aktiv = true);

-- Seed data – standard pakker (kør kun hvis pakker er tomme)
INSERT INTO pakker (navn, beskrivelse, pris, maks_billeder, leveringstid, popular, features)
SELECT * FROM (VALUES
  ('Basis', 'Perfekt til mindre ejendomme og lejligheder', 1995, 10, '24 timer', false, ARRAY['Op til 10 redigerede billeder', 'Standard HDR-behandling', 'Levering via Mindworking']),
  ('Standard', 'Vores mest populære pakke til alle boligtyper', 2995, 20, '48 timer', true, ARRAY['Op til 20 redigerede billeder', 'HDR-behandling', 'Levering via Mindworking', 'Preview-link til sælger']),
  ('Premium', 'Komplet løsning til større ejendomme', 4495, 35, '48 timer', false, ARRAY['Op til 35 redigerede billeder', 'HDR-behandling', 'Levering via Mindworking', 'Preview-link til sælger', 'Drone inkluderet', 'Twilight shot inkluderet'])
) AS v(navn, beskrivelse, pris, maks_billeder, leveringstid, popular, features)
WHERE NOT EXISTS (SELECT 1 FROM pakker LIMIT 1);

INSERT INTO tillaeg (navn, beskrivelse, pris, ikon)
SELECT * FROM (VALUES
  ('Drone', 'Luftfoto med drone – op til 5 billeder', 795, '🚁'),
  ('Twilight', 'Magiske billeder ved solnedgang', 595, '🌅'),
  ('Planløsning', '2D planløsning af ejendommen', 495, '📐'),
  ('Virtual Staging', 'Digital møblering af tomme rum', 995, '🛋'),
  ('Ekstra billeder', '10 ekstra billeder udover pakken', 395, '📷')
) AS v(navn, beskrivelse, pris, ikon)
WHERE NOT EXISTS (SELECT 1 FROM tillaeg LIMIT 1);
