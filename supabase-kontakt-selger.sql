-- Kontaktliste: sager hvor VANIA skal kontakte sælger for at aftale tid
alter table sager add column if not exists kontakt_selger boolean not null default false;
alter table sager add column if not exists selger_navn text;
alter table sager add column if not exists selger_telefon text;
alter table sager add column if not exists selger_kontaktet_at timestamptz;

-- Allerede godkendte bookinger med "VANIA kontakter sælger": kopiér over på sagen
update sager s
set kontakt_selger = true,
    selger_navn = coalesce(s.selger_navn, b.selger_navn),
    selger_telefon = coalesce(s.selger_telefon, b.selger_telefon)
from bookings b
where b.sag_id = s.id and b.kontakt_selger = true and b.status = 'godkendt';
