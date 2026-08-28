-- ============================================
-- FOTOFLOW – Migration: Ydelser, priser & sagsnummer
-- Kør i Supabase SQL Editor
-- ============================================

-- 1. Tilføj maegler_sagsnummer til sager
ALTER TABLE sager ADD COLUMN IF NOT EXISTS maegler_sagsnummer TEXT;

-- 2. Opret kunde_ydelser tabel (kundespecifikke priser)
CREATE TABLE IF NOT EXISTS kunde_ydelser (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kunde_id UUID REFERENCES kunder(id) ON DELETE CASCADE,
  navn TEXT NOT NULL,
  beskrivelse TEXT,
  pris NUMERIC NOT NULL,
  ikon TEXT DEFAULT '📷',
  aktiv BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Opret sag_ydelser tabel (hvilke ydelser er valgt på en sag)
CREATE TABLE IF NOT EXISTS sag_ydelser (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sag_id UUID REFERENCES sager(id) ON DELETE CASCADE,
  ydelse_id UUID REFERENCES kunde_ydelser(id) ON DELETE CASCADE,
  navn TEXT NOT NULL,
  pris NUMERIC NOT NULL,
  antal INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS
ALTER TABLE kunde_ydelser ENABLE ROW LEVEL SECURITY;
ALTER TABLE sag_ydelser ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "auth_all" ON kunde_ydelser FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "auth_all" ON sag_ydelser FOR ALL TO authenticated USING (true) WITH CHECK (true);
