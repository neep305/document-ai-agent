# n8n with Python (optional Excel) — M365-focused stack; separate from n8n-cloud
FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip tini && \
    ln -sf python3 /usr/bin/python

RUN pip3 install --no-cache-dir --break-system-packages openpyxl

RUN addgroup -g 1000 node || true && \
    adduser -u 1000 -G node -s /bin/sh -D node || true

RUN npm install -g n8n@latest

ENV PYTHON_BINARY=/usr/bin/python3
ENV N8N_USER_FOLDER=/home/node/.n8n

RUN mkdir -p /home/node/.n8n && \
    chown -R node:node /home/node

USER node

WORKDIR /home/node

RUN python3 -c "import openpyxl; print('openpyxl ok')"

EXPOSE 5678

COPY --chown=node:node entrypoint.sh /home/node/entrypoint.sh
RUN chmod +x /home/node/entrypoint.sh

ENTRYPOINT ["/home/node/entrypoint.sh"]
