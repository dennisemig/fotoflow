# FotoFlow – VaniaGraphics

## Opsætning trin for trin

### 1. Kør migrations-script i Supabase
- Gå til supabase.com → dit projekt → SQL Editor
- Kopiér indholdet af `supabase_migration.sql` og klik "Run"

### 2. Opret Storage Bucket i Supabase
- Gå til Storage → New Bucket
- Navn: `uploads` · Public: Nej

### 3. Opret første admin-bruger i Supabase
- Gå til Authentication → Users → Invite user
- Email: dennis@vaniagraphics.dk
- Gå derefter til SQL Editor og kør:
```sql
INSERT INTO public.profiles (id, navn, email, rolle)
SELECT id, 'Dennis', 'dennis@vaniagraphics.dk', 'admin'
FROM auth.users WHERE email = 'dennis@vaniagraphics.dk';
```

### 4. Installer og kør lokalt
```bash
npm install
npm run dev
```

### 5. Upload til GitHub
```bash
git init
git add .
git commit -m "Initial FotoFlow setup"
git branch -M main
git remote add origin https://github.com/DIT_BRUGERNAVN/fotoflow.git
git push -u origin main
```

### 6. Deploy på Vercel
- Gå til vercel.com → New Project → vælg dit GitHub repo
- Tilføj disse Environment Variables under Settings → Environment Variables:
  - `VITE_SUPABASE_URL` = https://sermdplllchopaamocpe.supabase.co
  - `VITE_SUPABASE_ANON_KEY` = [din anon key]
  - `VITE_RESEND_API_KEY` = [din resend key]
  - `VITE_FROM_EMAIL` = dennis@vaniagraphics.dk
  - `VITE_APP_URL` = https://vaniagraphics.dk
  - `VITE_APP_NAME` = VaniaGraphics
- Klik Deploy

### 7. Dropbox App (tilføjes når klar)
- Gå til dropbox.com/developers → App Console → Create App
- Vælg: Scoped access → Full Dropbox
- Kopier App Key og tilføj under Indstillinger i appen

### 8. Mindworking API (tilføjes når modtaget)
- Tilføj API nøgle og endpoint under Indstillinger i appen

## Teknisk stack
- React 18 + Vite
- Supabase (database, auth, storage)
- Resend (transaktionel mail)
- Vercel (hosting – Frankfurt region)
- Dropbox API (fil-storage)
- BBR/Dataforsyningen (ejendomsdata)
