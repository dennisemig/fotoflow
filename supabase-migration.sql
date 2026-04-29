-- ============================================
-- FOTOFLOW – VaniaGraphics Database Schema
-- Kør dette i Supabase SQL Editor
-- ============================================

-- PROFILES (extends auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  telefon TEXT,
  role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'freelancer')),
  specialer TEXT[],
  noter TEXT,
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KUNDER (CRM)
CREATE TABLE kunder (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  navn TEXT NOT NULL,
  email TEXT,
  telefon TEXT,
  noter TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SAGER
CREATE TABLE sager (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  adresse TEXT NOT NULL,
  dato DATE,
  tidspunkt TIME,
  type TEXT DEFAULT 'ejendom',
  status TEXT DEFAULT 'ny' CHECK (status IN ('ny','aktiv','afventer','afsluttet','leveret')),
  noter TEXT,
  kunde_id UUID REFERENCES kunder(id),
  freelancer_id UUID REFERENCES profiles(id),
  maks_billeder INTEGER DEFAULT 20,
  km_distance NUMERIC,
  bbr_data JSONB,
  pakke_id UUID,
  tillaeg TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- TODOS
CREATE TABLE todos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tekst TEXT NOT NULL,
  prioritet TEXT DEFAULT 'med' CHECK (prioritet IN ('high','med','low')),
  frist DATE,
  done BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'generel' CHECK (type IN ('generel','sag')),
  sag_id UUID REFERENCES sager(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UPLOADS
CREATE TABLE uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sag_id UUID REFERENCES sager(id) ON DELETE CASCADE,
  freelancer_id UUID REFERENCES profiles(id),
  filnavn TEXT NOT NULL,
  url TEXT,
  type TEXT DEFAULT 'raw' CHECK (type IN ('raw','leveret')),
  størrelse BIGINT,
  dropbox_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- KOERSEL
CREATE TABLE koersel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sag_id UUID REFERENCES sager(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  fra_adresse TEXT,
  til_adresse TEXT,
  km NUMERIC,
  minutter INTEGER,
  dato DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOOKINGS (fra mæglere)
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  adresse TEXT NOT NULL,
  dato DATE,
  tidspunkt TIME,
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

-- PAKKER
CREATE TABLE pakker (
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

-- TILLAEG
CREATE TABLE tillaeg (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  navn TEXT NOT NULL,
  beskrivelse TEXT,
  pris NUMERIC NOT NULL,
  ikon TEXT DEFAULT '➕',
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (GDPR)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE kunder ENABLE ROW LEVEL SECURITY;
ALTER TABLE sager ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE koersel ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pakker ENABLE ROW LEVEL SECURITY;
ALTER TABLE tillaeg ENABLE ROW LEVEL SECURITY;

-- Admin ser alt
CREATE POLICY "Admin full access" ON profiles FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON kunder FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON sager FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON todos FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON uploads FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON koersel FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON bookings FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON pakker FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admin full access" ON tillaeg FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Freelancer ser kun egne sager
CREATE POLICY "Freelancer egne sager" ON sager FOR SELECT USING (
  freelancer_id = auth.uid()
);
CREATE POLICY "Freelancer egne uploads" ON uploads FOR ALL USING (
  freelancer_id = auth.uid()
);
CREATE POLICY "Freelancer egen profil" ON profiles FOR SELECT USING (
  id = auth.uid()
);
CREATE POLICY "Freelancer egen koersel" ON koersel FOR SELECT USING (
  user_id = auth.uid()
);

-- ============================================
-- TRIGGER: Auto-opret profil ved ny bruger
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'role', 'admin'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED DATA – Standard pakker
-- ============================================

INSERT INTO pakker (navn, beskrivelse, pris, maks_billeder, leveringstid, popular, features) VALUES
('Basis', 'Perfekt til mindre ejendomme og lejligheder', 1995, 10, '24 timer', false, ARRAY['Op til 10 redigerede billeder', 'Standard HDR-behandling', 'Levering via Mindworking']),
('Standard', 'Vores mest populære pakke til alle boligtyper', 2995, 20, '48 timer', true, ARRAY['Op til 20 redigerede billeder', 'HDR-behandling', 'Levering via Mindworking', 'Preview-link til sælger']),
('Premium', 'Komplet løsning til større og eksklusive ejendomme', 4495, 35, '48 timer', false, ARRAY['Op til 35 redigerede billeder', 'HDR-behandling', 'Levering via Mindworking', 'Preview-link til sælger', 'Drone inkluderet', 'Twilight shot inkluderet']);

INSERT INTO tillaeg (navn, beskrivelse, pris, ikon) VALUES
('Drone', 'Luftfoto med drone – op til 5 billeder', 795, '🚁'),
('Twilight', 'Magiske billeder ved solnedgang', 595, '🌅'),
('Planløsning', '2D planløsning af ejendommen', 495, '📐'),
('Virtual Staging', 'Digital møblering af tomme rum', 995, '🛋'),
('Ekstra billeder', '10 ekstra billeder udover pakken', 395, '📷');

-- ============================================
-- STORAGE BUCKETS
-- Kør dette EFTER du har oprettet buckets i Supabase UI:
-- 1. Storage → New bucket → "raafiler" (private)
-- 2. Storage → New bucket → "leverede" (private)  
-- 3. Storage → New bucket → "previews" (public)
-- ============================================
