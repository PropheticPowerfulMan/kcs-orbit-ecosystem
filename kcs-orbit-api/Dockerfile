FROM node:20-alpine AS build
WORKDIR /workspace
COPY packages/shared-contracts/package*.json packages/shared-contracts/tsconfig.json ./packages/shared-contracts/
COPY packages/shared-contracts/src ./packages/shared-contracts/src
WORKDIR /workspace/packages/shared-contracts
RUN npm ci && npm run build
WORKDIR /workspace
COPY kcs-orbit-api/package*.json ./kcs-orbit-api/
WORKDIR /workspace/kcs-orbit-api
RUN npm ci
COPY kcs-orbit-api/prisma ./prisma
COPY kcs-orbit-api/tsconfig.json ./tsconfig.json
COPY kcs-orbit-api/src ./src
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /workspace/kcs-orbit-api/package*.json ./
COPY --from=build /workspace/kcs-orbit-api/node_modules ./node_modules
COPY --from=build /workspace/kcs-orbit-api/prisma ./prisma
COPY --from=build /workspace/kcs-orbit-api/dist ./dist
EXPOSE 4500
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
