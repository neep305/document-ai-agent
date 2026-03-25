FROM node:20-bookworm-slim

WORKDIR /app

# Install Python 3 + pip + openpyxl + pandas
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && pip3 install --no-cache-dir --break-system-packages openpyxl pandas \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Node dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application
COPY server.js ./
COPY public ./public
COPY scripts ./scripts

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT||3000) + '/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
