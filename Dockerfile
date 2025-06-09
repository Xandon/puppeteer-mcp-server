FROM node:20-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates \
    fonts-liberation libasound2 libatk-bridge2.0-0 \
    libdrm2 libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libxss1 libgtk-3-0 libnss3 libxkbcommon0 \
    libgconf-2-4 libx11-xcb1 libxcb1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chromium (works on both ARM64 and AMD64)
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads /app \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p /app/logs /app/downloads \
    && chown -R pptruser:pptruser /app

# Change to non-root user
USER pptruser

# Environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium
ENV RUNNING_IN_DOCKER=true
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/simple.js"]