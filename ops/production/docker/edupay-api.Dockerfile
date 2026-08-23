FROM node:20-alpine
RUN corepack enable
WORKDIR /workspace
COPY . .
WORKDIR "/workspace/EduPay Smart System"
RUN pnpm install --frozen-lockfile \
    && pnpm --filter @edupay/api prisma:generate \
    && pnpm --filter @edupay/api build
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @edupay/api exec prisma migrate deploy && pnpm --filter @edupay/api start"]
