# 🚀 AirPower Platform – Complete Deployment Guide

This guide explains how to deploy the **AirPower Dynamic Air Operations & Resource Optimisation** platform to the cloud or an on-premise server.

---

## 🏛 Architecture Overview

The AirPower application is packaged as a **unified full-stack service**:
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Leaflet
- **Backend**: FastAPI + Uvicorn + OR-Tools + Shapely + WebSockets
- **Unified Static Delivery**: FastAPI automatically mounts and serves the production-compiled React SPA (`/static`), providing:
  - **Zero CORS issues** (Frontend, API `/api`, and WebSockets `/ws` operate under the same domain and port).
  - **Single Service**: Only one container/process is needed to run the entire system.

---

## 🌟 Method 1: Free Cloud Deployment on Render.com (Recommended & Easiest)

[Render](https://render.com) offers free hosting for web services and natively builds Dockerfiles from GitHub.

### Step 1: Push Your Code to GitHub
If you haven't already initialized git:
```bash
git init
git add .
git commit -m "feat: complete AirPower IAF tactical platform with deployment configs"
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** in the top right and select **Blueprint** (or **Web Service**).
3. Connect your `AirPower` GitHub repository.
4. Render will automatically detect [`render.yaml`](./render.yaml) and [`Dockerfile`](./Dockerfile):
   - **Environment**: Docker
   - **Branch**: `main`
   - **Plan**: Free
5. Click **Apply** / **Create Web Service**.
6. Render will automatically build the React assets and Python backend. Within 2–3 minutes, your live site will be accessible at:
   ```
   https://<your-service-name>.onrender.com
   ```

---

## 🚂 Method 2: Deploy on Railway.app

1. Sign in to [Railway.app](https://railway.app/) with GitHub.
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your `AirPower` repository.
4. Railway will automatically detect the root [`Dockerfile`](./Dockerfile) and provision the deployment.
5. In your project settings, click **Generate Domain** to get a public URL (`https://<project-name>.up.railway.app`).

---

## 🐳 Method 3: Deploy with Docker / Docker Compose (Any Cloud VPS or On-Prem)

Use this method for **AWS EC2**, **DigitalOcean Droplets**, **Google Cloud Compute Engine**, **Azure VM**, or **Local Intranet Servers**.

### Prerequisites
- Docker and Docker Compose installed on the host machine.

### One-Command Deployment
On your server, clone the repo and launch:
```bash
# Clone the repository
git clone https://github.com/<your-username>/<your-repo-name>.git
cd AirPower

# Build and start in detached background mode
docker compose up -d --build
```

The application will now be running on port `8000`:
- **Web App**: `http://<your-server-ip>:8000/`
- **Interactive API Docs**: `http://<your-server-ip>:8000/docs`
- **Health Check**: `http://<your-server-ip>:8000/health`

### (Optional) Setup Nginx Reverse Proxy with Free SSL (Certbot)
If you have a domain name (e.g., `airpower.yourdomain.com`):

1. **Install Nginx & Certbot**:
   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. **Configure Nginx** (`/etc/nginx/sites-available/airpower`):
   ```nginx
   server {
       server_name airpower.yourdomain.com;

       location / {
           proxy_pass http://127.0.0.1:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Enable Site & Obtain SSL**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/airpower /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   sudo certbot --nginx -d airpower.yourdomain.com
   ```

---

## 🌐 Method 4: Split Hosting (Vercel Frontend + Render Backend)

If you prefer hosting the React frontend on **Vercel** and the FastAPI backend on **Render**:

1. **Deploy Backend**: Deploy the `backend/` folder on Render or Railway as a Python Web Service (`uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
2. **Deploy Frontend on Vercel**:
   - In Vercel, import the repository and set Root Directory to `frontend`.
   - Add environment variable:
     `VITE_API_BASE_URL=https://your-backend.onrender.com`
   - In `backend/app/main.py`, ensure your Vercel URL is allowed in `CORSMiddleware`.

---

## 🛡 Verifying Your Deployment

Once deployed, verify the key features:
1. **Landing Page**: Indian Air Force emblem with aerospace animation and navigation bar.
2. **Tactical Air Picture (`/#map`)**:
   - Interactive satellite terrain map.
   - Evasive reroute waypoints (`W1`, `W2`).
   - Dynamic **Sortie Focus** toggle.
3. **Mission Command Panel**: Floating glassmorphic panel on the right with package optimization and live sortie telemetry.
4. **WebSocket Connection**: Real-time status indicator showing green `CONNECTED`.
