# 🚀 Deployment Guide — Duit Tracker Pro
## Stack: Node.js + PostgreSQL (Supabase) + Railway

---

## 📁 Project Structure

```
duit-tracker/
├── public/
│   ├── css/
│   │   ├── style.css
│   │   └── kalender.css
│   ├── js/
│   │   ├── script.js
│   │   ├── receipt.js
│   │   └── update.js
│   └── index.html
├── routes/
│   └── index.js         ← API route definitions
├── controllers/
│   └── transactionController.js  ← Business logic
├── server.js             ← Express setup & middleware
├── package.json
├── .env                  ← Secret configuration (DO NOT upload to GitHub)
├── .env.example          ← Template for .env
├── .gitignore
└── docs/
    └── DEPLOYMENT.md     ← This file
```

---

## STEP 1 — Setup Database on Supabase (FREE)

1. Go to https://supabase.com → click **Start your project**
2. Sign up / login with GitHub
3. Click **New Project** → name it: `duit-tracker`
4. Set a database password (save it, you'll need it later!)
5. Choose region: **Southeast Asia (Singapore)**
6. Wait ~2 minutes until the project is created

### Get the Connection String:
1. In Supabase dashboard → click **Settings** (gear icon)
2. Click **Database** in the left sidebar
3. Scroll down to **Connection string**
4. Select the **URI** tab
5. Copy the string, example:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
6. Replace `[YOUR-PASSWORD]` with the password you set earlier

---

## STEP 2 — Test Locally

### Install dependencies:
```bash
cd duit-tracker
npm install
```

### Create .env file:
```bash
# Copy template
cp .env.example .env
```

Open `.env` and fill in:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxx.supabase.co:5432/postgres
JWT_SECRET=replace_with_a_long_random_string_at_least_32_chars
PORT=3000
DEFAULT_PIN=1234
```

### Run the server:
```bash
npm start
```

Open browser → http://localhost:3000
Login with PIN: **1234**

If it works, proceed to deployment!

---

## STEP 3 — Upload to GitHub

### Install Git if not already:
- Download from https://git-scm.com/downloads
- Or check: `git --version`

### Create a new repository on GitHub:
1. Go to https://github.com → click **New repository**
2. Name: `duit-tracker-pro`
3. Set to **Private** (for security)
4. Click **Create repository**

### Push code to GitHub:
```bash
cd duit-tracker

git init
git add .
git commit -m "Initial commit - Duit Tracker Pro"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/duit-tracker-pro.git
git push -u origin main
```

> ⚠️ Make sure `.env` is in `.gitignore` — never upload it!

---

## STEP 4 — Deploy to Railway (FREE)

Railway provides $5 free credit per month — enough for small apps.

1. Go to https://railway.app → click **Login with GitHub**
2. Click **New Project** → select **Deploy from GitHub repo**
3. Choose repo `duit-tracker-pro`
4. Railway will auto-detect Node.js

### Set Environment Variables on Railway:
1. Click the newly created project
2. Click the **Variables** tab
3. Add one by one:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | (your Supabase connection string) |
| `JWT_SECRET` | (your long random string) |
| `DEFAULT_PIN` | `1234` |

4. Railway will auto-redeploy

### Get your app URL:
1. Click the **Settings** tab
2. Under **Domains** → click **Generate Domain**
3. You'll get a URL like: `https://duit-tracker-pro-production.up.railway.app`

**Done! Your app is now online! 🎉**

---

## STEP 5 — Verification

Open your Railway URL in browser → you should see the Duit Tracker Pro login page.

Login with PIN: **1234**

Try adding a transaction → refresh page → data should persist ✅

---

## ❓ Troubleshooting

### Error: "Cannot connect to database"
- Check DATABASE_URL in Railway variables is correct
- Make sure Supabase password has no special characters that need URL encoding

### Error: "Port already in use" (local)
- Change PORT in .env to 3001 or 8080

### Forgot PIN
- Open Supabase dashboard → Table Editor → `settings` table
- Delete the row with key = `pin`
- Restart server → PIN resets to DEFAULT_PIN in .env

### Data not showing after deploy
- Check logs on Railway → **Deployments** tab → click deployment → view logs
- Make sure there are no database errors

---

## 🔒 Security

- `.env` file must NOT be uploaded to GitHub
- Change default PIN 1234 immediately after first login
- Use a strong Supabase password

---

## 💰 Cost

| Service | Cost |
|---------|------|
| Supabase | **FREE** (500MB database) |
| Railway | **FREE** ($5 credit/month, enough for ~500 hours) |
| **Total** | **$0** |
