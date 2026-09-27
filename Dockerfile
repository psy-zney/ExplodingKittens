FROM node:24-alpine AS build
WORKDIR /app
COPY . .
RUN npm ci
ARG VITE_SERVER_URL
ARG VITE_SOCKET_PATH=/socket.io
ARG VITE_BASE_PATH=/
RUN npm run build -w @kittens/shared && npm run build -w @kittens/engine && npm run build -w @kittens/server && npm run build -w @kittens/web

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/engine/package.json ./packages/engine/
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/web/package.json ./apps/web/
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/engine/dist ./packages/engine/dist
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/web/dist ./public
USER node
EXPOSE 3001
CMD ["node", "apps/server/dist/index.js"]
