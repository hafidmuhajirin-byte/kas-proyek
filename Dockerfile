# Kas Proyek — image praktis untuk VPS
# Build:  docker build -t kas-proyek .
# Run:    lihat DEPLOY.md (volume untuk DB + uploads)

FROM node:20-bookworm

WORKDIR /app

# Native deps untuk better-sqlite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Placeholder agar prisma generate / build tidak gagal tanpa .env di image
ENV DATABASE_URL="file:./prisma/prod.db"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN mkdir -p prisma public/uploads \
  && npm run build

EXPOSE 3000

# Migrasi dijalankan terpisah (lihat DEPLOY.md): docker exec ... prisma migrate deploy
CMD ["npm", "start"]
