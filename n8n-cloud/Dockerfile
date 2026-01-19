# n8n with Python support for Excel processing
# Using Node.js base image and installing n8n + Python
FROM node:20-alpine

# Install Python and dependencies
RUN apk add --no-cache python3 py3-pip tini && \
    ln -sf python3 /usr/bin/python

# Install Python packages for Excel processing
RUN pip3 install --no-cache-dir --break-system-packages openpyxl

# Create node user if not exists
RUN addgroup -g 1000 node || true && \
    adduser -u 1000 -G node -s /bin/sh -D node || true

# Install n8n globally
RUN npm install -g n8n@latest

# Set environment
ENV PYTHON_BINARY=/usr/bin/python3
ENV N8N_USER_FOLDER=/home/node/.n8n

# Create n8n directory
RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node

USER node

WORKDIR /home/node

# Verify installation
RUN python3 -c "import openpyxl; print('✅ Python openpyxl installed and accessible')"

EXPOSE 5678

ENTRYPOINT ["tini", "--", "n8n"]
