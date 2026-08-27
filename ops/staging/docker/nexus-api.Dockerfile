FROM node:20-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /workspace/packages/shared-contracts
COPY packages/shared-contracts/package*.json ./
COPY packages/shared-contracts/tsconfig.json ./
COPY packages/shared-contracts/src ./src
RUN npm ci && npm run build
WORKDIR /workspace/KCS Nexus/backend
COPY ["KCS Nexus/backend/package.json", "KCS Nexus/backend/package-lock.json", "./"]
RUN npm ci
COPY ["KCS Nexus/backend/prisma", "./prisma"]
COPY ["KCS Nexus/backend/tsconfig.json", "./tsconfig.json"]
COPY ["KCS Nexus/backend/src", "./src"]
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /workspace/KCS Nexus/backend
COPY --from=build ["/workspace/KCS Nexus/backend/package.json", "/workspace/KCS Nexus/backend/package-lock.json", "./"]
COPY --from=build ["/workspace/KCS Nexus/backend/node_modules", "./node_modules"]
COPY --from=build ["/workspace/KCS Nexus/backend/prisma", "./prisma"]
COPY --from=build ["/workspace/KCS Nexus/backend/dist", "./dist"]
COPY --from=build /workspace/packages/shared-contracts /workspace/packages/shared-contracts
EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
