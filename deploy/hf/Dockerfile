FROM node:20-bookworm-slim AS api-build
WORKDIR /build/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build && npm prune --omit=dev

FROM python:3.12-slim-bookworm
COPY --from=api-build /usr/local/bin/node /usr/local/bin/node
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 libatomic1 \
    && rm -rf /var/lib/apt/lists/*
COPY services/ingest/requirements.txt /tmp/requirements.txt
RUN sed '/^pytest/d; /^httpx/d' /tmp/requirements.txt > /tmp/runtime-requirements.txt \
    && pip install --no-cache-dir -r /tmp/runtime-requirements.txt \
    && rm /tmp/requirements.txt /tmp/runtime-requirements.txt \
    && useradd --create-home --uid 1000 app
WORKDIR /home/app/apps/api
COPY --from=api-build --chown=1000:1000 /build/apps/api/node_modules ./node_modules
COPY --from=api-build --chown=1000:1000 /build/apps/api/dist ./dist
COPY --chown=1000:1000 apps/api/public ./public
COPY --chown=1000:1000 services/ingest/*.py /home/app/services/ingest/
COPY --chown=1000:1000 samples/policies /home/app/samples/policies/
COPY --chown=1000:1000 deploy/hf/start.sh /home/app/start.sh
RUN chmod 755 /home/app/start.sh
ENV HOME=/home/app PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DEMO_MODE=true SEED_SAMPLES_ON_START=true HOST=0.0.0.0 PORT=7860 \
    INGEST_URL=http://127.0.0.1:8001 INDEX_PATH=/home/app/data/index.json
USER 1000:1000
EXPOSE 7860
HEALTHCHECK --interval=5s --timeout=3s --start-period=45s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:7860/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["/bin/bash", "/home/app/start.sh"]
