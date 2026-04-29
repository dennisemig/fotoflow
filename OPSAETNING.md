# 🎉 FotoFlow – VaniaGraphics
## Komplet opsætningsguide

---

## TRIN 1 – Supabase Database

1. Gå til **supabase.com** → dit projekt → **SQL Editor**
2. Kopier hele indholdet af `supabase-migration.sql`
3. Klik **Run** – alle tabeller oprettes automatisk
4. Gå til **Storage** → **New bucket**:
   - Opret bucket: `raafiler` (private ✓)
   - Opret bucket: `leverede` (private ✓)
   - Opret bucket: `previews` (public ✓)
5. Gå til **Authentication** → **Providers** → sørg for Email er slået til
6. Gå til **Authentication** → **URL Configuration** → sæt Site URL til `https://vaniagraphics.dk`

---

## TRIN 2 – Opret din admin-bruger

1. I Supabase → **Authentication** → **Users** → **Invite user**
2. Brug: `dennis@vaniagraphics.dk`
3. Du modtager en mail – klik linket og sæt din adgangskode

---

## TRIN 3 – Dropbox App

1. Gå til **dropbox.com/developers** → **Create App**
2. Vælg: **Scoped access** → **Full Dropbox**
3. Giv appen et navn, f.eks. "VaniaGraphics"
4. Under **Settings** → kopiér **App key** og **App secret**
5. Under **Permissions** → sæt flueben ved: `files.content.write`, `files.content.read`
6. Indsæt App key i FotoFlow → **Indstillinger** → **Dropbox**

---

## TRIN 4 – Vercel Deploy

1. Gå til **vercel.com** → **New Project**
2. Vælg **Import from GitHub** → vælg dit FotoFlow-repository
3. Under **Environment Variables** – tilføj disse:
   ```
   VITE_SUPABASE_URL = https://sermdplllchopaamocpe.supabase.co
   VITE_SUPABASE_ANON_KEY = [din anon key]
   RESEND_API_KEY = re_Wmgxs6yK_6FihcknKhcFNzAPrNzQYkgPk
   RESEND_FROM = dennis@vaniagraphics.dk
   VITE_APP_URL = https://vaniagraphics.dk
   VITE_APP_NAME = VaniaGraphics
   ```
4. Klik **Deploy** – appen er live inden for 2 minutter!

---

## TRIN 5 – Tilknyt dit domæne (vaniagraphics.dk)

1. I Vercel → **Settings** → **Domains** → **Add domain**
2. Skriv `vaniagraphics.dk` → **Add**
3. Vercel viser dig to DNS-records der skal tilføjes hos din domæne-udbyder
4. Log ind hos din domæne-udbyder og tilføj recordsene
5. Vent 5-30 minutter → domænet er aktivt

---

## TRIN 6 – Mindworking (tilføjes senere)

Når du modtager API-dokumentation fra Mindworking:
1. Send dokumentationen til Claude
2. Integrationen bygges ind i koden
3. Du uploader den opdaterede kode til GitHub
4. Vercel opdaterer automatisk dit live-site

---

## Upload kode til GitHub

Kør disse kommandoer i terminalen (i fotoflow-mappen):

```bash
# Installer dependencies
npm install

# Test lokalt (åbner på http://localhost:5173)
npm run dev

# Når du er klar til at gå live:
git init
git add .
git commit -m "Initial FotoFlow deploy"
git remote add origin https://github.com/DITBRUGERNAVN/fotoflow.git
git push -u origin main
```

---

## ✅ Tjekliste

- [ ] Supabase SQL-script kørt
- [ ] Storage buckets oprettet (raafiler, leverede, previews)
- [ ] Admin-bruger oprettet i Supabase
- [ ] Dropbox App oprettet og App Key noteret
- [ ] Kode uploadet til GitHub
- [ ] Vercel forbundet til GitHub og deployed
- [ ] Environment variables tilføjet i Vercel
- [ ] Domæne tilknyttet i Vercel
- [ ] Test-login gennemført
- [ ] Første sag oprettet og testet

---

**Support:** Kontakt Claude hvis du sidder fast på et trin 🎉
