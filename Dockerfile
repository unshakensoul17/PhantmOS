FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

# System dependencies for Playwright + XVFB virtual display
RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    x11-xkb-utils \
    x11-apps \
    libxpm4 \
    libxrender1 \
    libxi6 \
    libxtst6 \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libwayland-client0 \
    libwayland-egl1 \
    libwayland-server0 \
    ca-certificates \
    curl \
    git \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r /app/requirements.txt

# Install browser binaries used by Playwright
RUN python -m playwright install chromium webkit

COPY . /app

RUN chmod +x /app/entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
