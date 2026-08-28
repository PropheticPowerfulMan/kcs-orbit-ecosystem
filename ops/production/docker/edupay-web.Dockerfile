FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /workspace
COPY . .
WORKDIR "/workspace/EduPay Smart System"
RUN pnpm install --frozen-lockfile
ARG VITE_API_BASE_URL
ARG VITE_RECEIPT_VERIFICATION_BASE_URL
ARG VITE_BASE_PATH=/
ARG VITE_NEXUS_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_RECEIPT_VERIFICATION_BASE_URL=$VITE_RECEIPT_VERIFICATION_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_NEXUS_URL=$VITE_NEXUS_URL
RUN pnpm --filter @edupay/web build

FROM nginx:1.27-alpine
COPY ["EduPay Smart System/apps/web/nginx.conf", "/etc/nginx/conf.d/default.conf"]
COPY --from=build ["/workspace/EduPay Smart System/apps/web/dist", "/usr/share/nginx/html"]