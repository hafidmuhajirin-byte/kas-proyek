# Kas Proyek — image untuk VPS / Docker
# Build:  docker build -t kas-proyek .
# Run:    lihat DEPLOY.md (volume untuk uploads; DB = MySQL eksternal)

FROM node:20-bookworm

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Placeholder agar prisma generate / next build tidak gagal tanpa DB live di image
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/kas_proyek"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN mkdir -p public/uploads \
  && npm run build

EXPOSE 3000

# Migrasi dijalankan terpisah terhadap MySQL (lihat DEPLOY.md / RENDER.md):
#   docker exec ... npx prisma migrate deploy
CMD ["npm", "start"]
