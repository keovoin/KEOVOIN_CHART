# VIS · Visual Intelligence Studio — team edition
# Zero npm dependencies, so there is no install step. Just copy + run.
FROM node:20-alpine

WORKDIR /app
COPY . .

# Runtime config (API key, admin token) should be provided via env or a mounted
# volume at /app/server/config.json — never baked into the image.
ENV PORT=4000
EXPOSE 4000

# Optional: set VIS_ADMIN_TOKEN, VIS_AI_ENDPOINT, VIS_AI_KEY, VIS_AI_MODEL
CMD ["node", "server/server.js"]
