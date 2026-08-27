FROM node:20-alpine AS build
WORKDIR /app
COPY ["KCS Nexus/frontend/package.json", "KCS Nexus/frontend/package-lock.json", "./"]
RUN npm ci
COPY ["KCS Nexus/frontend", "./"]
ARG VITE_API_URL=/nexus/api
ARG VITE_BASE_PATH=/nexus/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM nginx:1.27-alpine
COPY ["KCS Nexus/frontend/nginx.conf", "/etc/nginx/conf.d/default.conf"]
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
