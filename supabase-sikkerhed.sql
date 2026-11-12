-- ============================================================
-- FotoFlow: luk anonym (ikke-logget-ind) adgang til databasen
-- Kør i Supabase → SQL Editor, i tre trin.
--
-- VIGTIGT: Kør først trin 2, når den nye version er deployet til
-- app.vaniagraphics.dk. Den gamle version læser sager og billeder
-- direkte fra leveringssiden og bookingsiden og holder op med at virke.
-- ============================================================


-- ------------------------------------------------------------
-- TRIN 1: SE HVAD DER ER NU (ændrer intet)
-- ------------------------------------------------------------

-- 1a. Policies på tabellerne. Rækker med roles = {anon} eller {public},
--     hvor qual er "true" (eller tom), betyder at alle kan læse/skrive uden login.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 1b. Tabeller uden RLS slået til (alle kan alt med anon-nøglen):
select c.relname as tabel, c.relrowsecurity as rls_slaaet_til
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by 1;

-- 1c. Billed-bucket'en. public = true betyder at billederne kan hentes af alle med stien.
select id, public from storage.buckets;

-- 1d. Policies på billedfilerne (storage):
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;


-- ------------------------------------------------------------
-- TRIN 2: LUK ANONYM ADGANG (efter deploy)
--
-- Fjerner kun policies, der giver adgang UDEN login (rolle anon/public
-- uden tjek af auth.uid()/auth.role()). Policies for indloggede brugere
-- (fx "Admin full access", "Freelancer egne sager") bliver stående.
-- Hvis en tabel derefter ikke har nogen policy for indloggede, oprettes
-- "auth_all", så appen virker som før for dig.
--
-- Undtagelser, som bookingsiden stadig bruger uden login:
--   pakker, tillaeg, indstillinger (læses) og bookings (kun INSERT).
-- ------------------------------------------------------------
do $$
declare
  p record;
  t text;
  berørte text[] := '{}';
begin
  for p in
    select tablename, policyname, cmd, roles, coalesce(qual, '') as q, coalesce(with_check, '') as w
    from pg_policies
    where schemaname = 'public'
      and tablename not in ('pakker', 'tillaeg', 'indstillinger')
      and ('anon' = any(roles) or 'public' = any(roles))
      and coalesce(qual, '') !~ 'auth\.(uid|role|jwt)'
      and coalesce(with_check, '') !~ 'auth\.(uid|role|jwt)'
  loop
    -- Bookingsiden skal stadig kunne oprette bookinger
    if p.tablename = 'bookings' and p.cmd = 'INSERT' then
      continue;
    end if;
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice 'Fjernet: % på % (%)', p.policyname, p.tablename, p.cmd;
    -- En "public"-policy gav også indloggede adgang; den adgang beholdes via auth_all
    if 'public' = any(p.roles) then
      berørte := array_append(berørte, p.tablename);
    end if;
  end loop;

  -- Sørg for at indloggede stadig har samme adgang som før
  foreach t in array coalesce((select array_agg(distinct x) from unnest(berørte) x), '{}') loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'auth_all') then
      execute format('create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
      raise notice 'Oprettet auth_all på %', t;
    end if;
  end loop;
end $$;

-- Slå RLS til på de tabeller, appen bruger, hvis det er slået fra.
-- Tabellen får samtidig auth_all, så indloggede har samme adgang som før.
-- Har en tabel ingen policy for indloggede, får den også auth_all.
do $$
declare t text;
begin
  foreach t in array array['sager','uploads','kunder','bookings','profiles','kalender_blokeringer','koersel'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    if not (select relrowsecurity from pg_class where oid = to_regclass('public.' || t)) then
      execute format('alter table public.%I enable row level security', t);
      raise notice 'RLS slået til på %', t;
    elsif exists (
      select 1 from pg_policies where schemaname = 'public' and tablename = t
        and ('authenticated' = any(roles) or 'public' = any(roles)) and cmd in ('ALL', 'SELECT')
    ) then
      continue;  -- RLS er slået til, og indloggede har allerede en policy
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'auth_all') then
      execute format('create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
      raise notice 'Oprettet auth_all på %', t;
    end if;
  end loop;
end $$;

-- 2b. Billedfiler: fjern anonym adgang til bucket'en "sager".
--     Leveringssiden laver nu links via serveren, så anon behøver ingen adgang.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and ('anon' = any(roles) or 'public' = any(roles))
      and (coalesce(qual, '') || coalesce(with_check, '')) !~ 'auth\.(uid|role|jwt)'
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'sager'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
    raise notice 'Fjernet storage-policy: %', p.policyname;
  end loop;

  -- Indloggede skal stadig kunne uploade, se og slette billeder i appen
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and ('authenticated' = any(roles) or 'public' = any(roles))
      and (coalesce(qual, '') || coalesce(with_check, '')) ~ 'sager'
  ) then
    create policy "sager_auth_all" on storage.objects for all to authenticated
      using (bucket_id = 'sager') with check (bucket_id = 'sager');
    raise notice 'Oprettet storage-policy sager_auth_all';
  end if;
end $$;

-- Hvis 1c viste public = true for "sager", så gør bucket'en privat:
-- update storage.buckets set public = false where id = 'sager';


-- ------------------------------------------------------------
-- TRIN 3: KONTROL
-- Kør trin 1a og 1d igen. Der bør ikke være policies med {anon}/{public}
-- og qual = true tilbage, ud over pakker, tillaeg, indstillinger og
-- INSERT på bookings.
-- Test bagefter: log ind og åbn en sag, åbn et leveringslink, et
-- godkendelseslink og bookingsiden (/book/...).
-- ------------------------------------------------------------
