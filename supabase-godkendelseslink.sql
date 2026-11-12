-- Godkendelseslink før levering (/godkend/:token)
-- Køres én gang i Supabase → SQL Editor.
alter table sager add column if not exists preview_token text;
alter table sager add column if not exists preview_udloeber timestamptz;
create unique index if not exists sager_preview_token_idx on sager (preview_token) where preview_token is not null;
