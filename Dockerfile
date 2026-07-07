FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# ── System dependencies ───────────────────────────────────────────────────────
# WeasyPrint requires: Pango, Cairo, GDK-Pixbuf, and their GObject bindings.
# sentence-transformers requires: no GPU libs needed (CPU only on slim).
RUN apt-get update && apt-get install -y --no-install-recommends \
    # WeasyPrint system deps
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libpangocairo-1.0-0 \
    libcairo2 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    libglib2.0-0 \
    # Font rendering
    fonts-liberation \
    fontconfig \
    # Node.js for frontend build
    nodejs \
    npm \
    # General utilities
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Rebuild font cache for WeasyPrint
RUN fc-cache -fv

# ── Python dependencies ───────────────────────────────────────────────────────
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

# ── Application code ──────────────────────────────────────────────────────────
COPY . /app

# ── Build frontend ─────────────────────────────────────────────────────────────
RUN cd /app/frontend && npm ci && npm run build

RUN chmod +x /app/entrypoint.sh

# Expose dashboard port
EXPOSE 7860

ENTRYPOINT ["/app/entrypoint.sh"]
