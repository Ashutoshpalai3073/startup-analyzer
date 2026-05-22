# 🚀 Startup Analyzer — Full Setup & Deployment Guide

Turn any startup idea into a complete investor-ready analysis with market sizing,
competitor intel, funding landscape, SWOT matrix, GTM strategy, and a downloadable
pitch deck — all powered by CrewAI + Groq.

---

## 📁 Project Structure

```
startup-analyzer/
├── backend/
│   ├── main.py              ← FastAPI server
│   ├── agents.py            ← CrewAI agents (5 analysts)
│   ├── pitch_generator.py   ← PPTX pitch deck builder
│   ├── requirements.txt     ← Python dependencies
│   ├── railway.toml         ← Railway deployment config
│   └── .env                 ← Your API keys (never commit this)
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── LandingPage.jsx
    │   │   ├── LoadingScreen.jsx
    │   │   ├── Dashboard.jsx
    │   │   └── sections/
    │   │       ├── Card.jsx
    │   │       ├── MarketSection.jsx
    │   │       ├── CompetitorSection.jsx
    │   │       ├── FundingSection.jsx
    │   │       ├── SwotSection.jsx
    │   │       └── GtmSection.jsx
    ├── public/
    │   └── index.html
    ├── package.json
    ├── vercel.json          ← Vercel deployment config
    └── .env                 ← API URL config
```

---

## ✅ PREREQUISITES — Install These First

| Software     | Download Link                    | Version Needed |
|--------------|----------------------------------|----------------|
| Python       | https://python.org/downloads     | 3.11.x         |
| Node.js      | https://nodejs.org               | 18+ LTS        |
| Git          | https://git-scm.com              | Any            |
| VS Code      | https://code.visualstudio.com    | Any            |

### Accounts to Create (all free)
- **Groq API Key** → https://console.groq.com (free, fast)
- **GitHub** → https://github.com (to store and deploy code)
- **Railway** → https://railway.app (deploy Python backend)
- **Vercel** → https://vercel.com (deploy React frontend)

---

## 🖥️ PART 1 — LOCAL SETUP (Run on Your Laptop)

### Step 1 — Create the folder structure

Open a terminal (CMD or PowerShell) and run:

```bash
mkdir startup-analyzer
cd startup-analyzer
mkdir backend
mkdir frontend
```

Copy all the provided files into their respective folders exactly as shown
in the project structure above.

---

### Step 2 — Set up the Backend

```bash
cd backend
```

Add your Groq API key to the `.env` file:
```
GROQ_API_KEY=gsk_your_actual_key_here
```

Install Python dependencies:
```bash
py -3.11 -m pip install -r requirements.txt
```

Start the backend server:
```bash
py -3.11 main.py
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

Test it by visiting: http://localhost:8000
You should see: `{"status": "Startup Analyzer API is running"}`

---

### Step 3 — Set up the Frontend

Open a **second terminal** (keep the backend running in the first):

```bash
cd frontend
npm install
npm start
```

Your browser will open automatically at: http://localhost:3000

---

### Step 4 — Test It Locally

1. Type a startup idea in the input box
2. Click "Generate Full Analysis"
3. Wait 5–10 minutes (AI agents are working)
4. Explore all 5 sections with charts and insights
5. Click "Download Pitch Deck" and enter your brand name

If it works locally — you're ready to deploy.

---

## ☁️ PART 2 — DEPLOY TO CLOUD

### Step 5 — Push to GitHub

In the root `startup-analyzer/` folder:

```bash
git init
git add .
git commit -m "Initial commit — Startup Analyzer"
```

Go to https://github.com → New Repository → name it `startup-analyzer`
Then run (replace YOUR_USERNAME):

```bash
git remote add origin https://github.com/YOUR_USERNAME/startup-analyzer.git
git branch -M main
git push -u origin main
```

---

### Step 6 — Deploy Backend to Railway

1. Go to https://railway.app → Login with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `startup-analyzer` repository
4. Railway will detect the `backend/` folder — set **Root Directory** to `backend`
5. Go to **Variables** tab → Add:
   ```
   GROQ_API_KEY = gsk_your_actual_key_here
   ```
6. Click **Deploy** — wait 2–3 minutes
7. Go to **Settings** → **Networking** → click **"Generate Domain"**
8. Copy your Railway URL — it looks like:
   ```
   https://startup-analyzer-production.up.railway.app
   ```

Test your deployed backend by visiting that URL — should show the status message.

---

### Step 7 — Update Frontend with Backend URL

Open `frontend/.env` and replace the URL:

```
REACT_APP_API_URL=https://YOUR-RAILWAY-URL.up.railway.app
```

Commit and push the change:
```bash
git add .
git commit -m "Add production backend URL"
git push
```

---

### Step 8 — Deploy Frontend to Vercel

1. Go to https://vercel.com → Login with GitHub
2. Click **"New Project"** → Import your `startup-analyzer` repository
3. Set **Root Directory** to `frontend`
4. Under **Environment Variables** add:
   ```
   REACT_APP_API_URL = https://YOUR-RAILWAY-URL.up.railway.app
   ```
5. Click **Deploy** — wait 1–2 minutes
6. Vercel gives you a public URL like:
   ```
   https://startup-analyzer.vercel.app
   ```

---

## 🎉 DONE — Your Product is Live

Share your Vercel URL with anyone. They can:
- Enter any startup idea
- Get a full AI-powered analysis in 5–10 minutes
- Browse 5 sections with charts and infographics
- Download a professional pitch deck as PPTX

---

## 🔧 TROUBLESHOOTING

| Problem | Fix |
|---------|-----|
| `Import crewai not found` | Run `py -3.11 -m pip install crewai litellm` |
| `GROQ_API_KEY not configured` | Check your backend `.env` file has the key |
| `CORS error` in browser | Make sure backend is running and URL in `.env` is correct |
| `Rate limit hit` | Auto-retry is built in — just wait, it will continue |
| `npm install fails` | Make sure Node.js 18+ is installed |
| `Module not found` in React | Run `npm install` again inside the `frontend/` folder |
| Railway deploy fails | Check the logs in Railway dashboard for the exact error |
| Pitch deck download fails | Make sure `python-pptx` is installed in backend |

---

## 💡 TIPS

- Keep the free Groq tier in mind — analysis takes 5–10 mins due to rate limits
- The pitch deck has placeholder text `[Your Name]` etc — fill those in after download
- You can change the Groq model in `agents.py` line: `LLM(model="groq/llama-3.3-70b-versatile")`
- To add more agents/sections, follow the same pattern in `agents.py` and add a new section component

---

## 📞 QUICK REFERENCE — Commands

```bash
# Start backend locally
cd backend && py -3.11 main.py

# Start frontend locally
cd frontend && npm start

# Install backend packages
cd backend && py -3.11 -m pip install -r requirements.txt

# Install frontend packages
cd frontend && npm install

# Push to GitHub
git add . && git commit -m "update" && git push
```
