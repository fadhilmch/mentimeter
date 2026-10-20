# Self-hosted all-in-one: builds the client, serves it from the API server with Socket.IO.
FROM node:24-alpine AS client-build
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist
ENV CLIENT_DIST=../client/dist
EXPOSE 3000
CMD ["node", "server/src/server.js"]
