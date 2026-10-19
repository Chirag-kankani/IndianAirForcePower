# ==============================================================================
# Stage 1: Build Frontend Assets (React + Vite + TypeScript)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /build

COPY AirPower/frontend/package*.json ./
RUN npm ci

COPY AirPower/frontend/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Production Python Backend & SPA Host (FastAPI)
# ==============================================================================
FROM python:3.11-slim AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Install system dependencies required for geometry/optimization
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY AirPower/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code and operational state data
COPY AirPower/backend/app ./app
COPY AirPower/backend/data ./data

# Copy compiled frontend SPA from Stage 1 into backend static directory
COPY --from=frontend-builder /build/dist ./static

EXPOSE 8000

# Run Uvicorn listening on $PORT (compatible with Render, Railway, VPS)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
