FROM node:20-slim AS build
WORKDIR /app/apps/api
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/tsconfig.json ./
COPY apps/api/src ./src
RUN npm run build && npm prune --omit=dev
FROM node:20-slim
WORKDIR /app/apps/api
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY apps/api/public ./public
COPY samples /app/samples
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "dist/main.js"]
