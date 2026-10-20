# 🚀 AirPower Platform – Complete Deployment Guide & Zero-Downtime Solutions

This guide provides reliable solutions for deploying the **AirPower Dynamic Air Operations & Resource Optimisation** platform to ensure fast response times, zero cold starts, and permanent 24/7 uptime.

---

## ⚠️ Understanding Why Render Free Tier Takes Time / Shuts Down

On Render's Free tier:
1. **15-Minute Inactivity Spin-Down**: Render automatically puts free services to sleep after 15 minutes without requests.
2. **50–90 Second Cold Start**: When someone opens your link after it was sleeping, Render has to spin up the container from scratch, causing the noticeable delay.
3. **750 Free Instance Hours Cap**: Render free accounts have a monthly limit of 750 hours. If multiple services run or run continuously, the service is disabled until the 1st of the next month.

Below are **4 battle-tested solutions** to eliminate cold starts and keep your demo permanently online.

---

## 🏆 Solution 1: Hugging Face Spaces (Recommended – 100% Free Forever, 0 Sleep, 16GB RAM)

[Hugging Face Spaces](https://huggingface.co/spaces) offers **unlimited 24/7 free hosting** for public Docker apps:
- **Never goes to sleep**: Zero spin-down, 0 second cold start.
- **Generous hardware**: **16 GB RAM + 2 vCPU** (compared to Render's 512 MB).
- **No credit card required**.

### Step-by-Step Setup:
1. Create a free account at [huggingface.co](https://huggingface.co/).
2. Click your profile avatar (top right) → **New Space**.
3. Fill in the details:
   - **Space name**: `iaf-airpower` (or your preferred name)
   - **License**: `mit` or `openrail`
   - **Space SDK**: Select **Docker** → **Blank**
   - **Space hardware**: Free (2 vCPU, 16 GB RAM)
   - **Visibility**: **Public** (Public spaces stay awake 24/7)
4. Click **Create Space**.
5. Push your code to your Hugging Face Space:
   - Rename `README_HF.md` to `README.md` (or copy the frontmatter from `README_HF.md` to `README.md`):
     ```yaml
     ---
     title: Bharatiya Vayu Sena - AirPower
     emoji: ✈️
     colorFrom: blue
     colorTo: cyan
     sdk: docker
     app_port: 8000
     ---
     ```
   - Follow the instructions shown on your Space page to push via Git:
     ```bash
     git remote add space https://huggingface.co/spaces/<YOUR_USERNAME>/<SPACE_NAME>
     git push space main
     ```
6. Hugging Face will build your `Dockerfile` and keep your site live 24/7 at:
   ```
   https://<YOUR_USERNAME>-<SPACE_NAME>.hf.space
   ```

---

## ⚡ Solution 2: Prevent Render From Sleeping (Keep-Alive Ping Bot)

If you already have your application deployed on Render and want an **instant fix without moving platforms**, you can prevent Render from going to sleep using a free uptime monitor:

### Option A: Using UptimeRobot (Free 5-Minute Monitor)
1. Go to [UptimeRobot.com](https://uptimerobot.com/) and register a free account.
2. Click **Add New Monitor**.
3. Settings:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `AirPower Render Health`
   - **URL (or IP)**: `https://<YOUR-APP-NAME>.onrender.com/health`
   - **Monitoring Interval**: Every `5 minutes`
4. Click **Create Monitor**.
5. *Result*: UptimeRobot will ping your `/health` endpoint every 5 minutes. Because Render detects incoming traffic, **it will never spin down or go to sleep!**

### Option B: Automated GitHub Actions Keep-Alive
A pre-configured GitHub Actions workflow has been added at [`.github/workflows/keep_alive.yml`](./.github/workflows/keep_alive.yml).
1. Open `.github/workflows/keep_alive.yml`.
2. Replace `https://airpower-platform.onrender.com/health` with your actual Render URL.
3. Commit and push to GitHub. GitHub will automatically ping your site every 10 minutes.

---

## 🚂 Solution 3: Railway.app (Fast 24/7 Hosting, Zero Cold Starts)

[Railway](https://railway.app/) is built for full-stack Docker services and provides always-on instances:
1. Sign in to [Railway.app](https://railway.app/) using GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `AirPower` repository.
4. Railway detects the root `Dockerfile` and builds it automatically.
5. In your service settings under **Networking**, click **Generate Domain**.
6. Your site will be live at `https://<project-name>.up.railway.app` with instant response times and full WebSocket support.

---

## 🚀 Solution 4: Koyeb.com (Free 24/7 Micro Instance)

[Koyeb](https://www.koyeb.com/) provides high-speed cloud hosting with no sleep on free active micro services:
1. Create a free account on [Koyeb.com](https://www.koyeb.com/).
2. Click **Create App** → Select **GitHub**.
3. Select your repository.
4. Builder: Select **Dockerfile**.
5. Port: Set to `8000`.
6. Click **Deploy**. Koyeb provisions an edge container with sub-second response times.

---

## 🎯 Solution 5: Live Presentation Day (Instant Public Link with 0ms Delay)

During project evaluations, viva, or college presentations, network latency and cloud hiccups can be avoided entirely by running locally on your laptop while sharing a live HTTPS public link:

### Using Cloudflare Tunnel / Localtunnel (Free, No Signup):
1. In your local terminal, ensure backend and frontend are running:
   - Backend: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
   - Frontend: `npm run dev` (on port 5173)
2. Open a new terminal and run:
   ```bash
   npx localtunnel --port 5173
   ```
   Or using Cloudflare Quick Tunnel:
   ```bash
   npx cloudflared tunnel --url http://localhost:5173
   ```
3. You will immediately receive a live public HTTPS link (e.g. `https://quick-jet-82.loca.lt` or `https://xyz.trycloudflare.com`).
4. **Advantages**:
   - Zero cold start delay.
   - Runs with your laptop's full CPU speed.
   - Microphone voice control works with zero lag.
   - Anyone (evaluators, teachers, friends) can open the link from their phones or laptops.

---

## 📊 Summary Comparison

| Platform | Cost | Sleep / Cold Start? | RAM | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **Hugging Face Spaces** | 100% Free | **No (Always On)** | 16 GB | Permanent showcase, portfolio, defense projects |
| **Render + UptimeRobot** | Free | **No (Keep-Alive)** | 512 MB | Zero-migration fix for existing Render users |
| **Railway.app** | $5 Free Trial | **No (Always On)** | 512MB-8GB | Production performance & fast setup |
| **Koyeb.com** | Free Tier | **No (Always On)** | 512 MB | Fast edge container deployment |
| **Localtunnel / Cloudflare** | 100% Free | **0ms (Local Power)** | Laptop RAM | Live college presentation / Viva demonstration |
