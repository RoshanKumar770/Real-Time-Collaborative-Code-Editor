FROM node:22 AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci --include=optional

COPY . .

RUN npm run build


FROM node:22

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --include=optional

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src

EXPOSE 3000

CMD ["node", "dist/server.js"]