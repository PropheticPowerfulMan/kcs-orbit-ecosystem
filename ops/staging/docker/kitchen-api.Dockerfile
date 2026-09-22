FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY ["KCSKITCHEN/backend/package.json", "KCSKITCHEN/backend/package-lock.json", "./"]
RUN npm ci
COPY ["KCSKITCHEN/backend/prisma", "./prisma"]
COPY ["KCSKITCHEN/backend/tsconfig.json", "./tsconfig.json"]
COPY ["KCSKITCHEN/backend/src", "./src"]
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
EXPOSE 5100
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
