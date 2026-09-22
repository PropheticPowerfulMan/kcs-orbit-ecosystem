FROM node:20-alpine AS build
WORKDIR /app
COPY ["KCSKITCHEN/frontend/package.json", "KCSKITCHEN/frontend/package-lock.json", "./"]
RUN npm ci
COPY ["KCSKITCHEN/frontend", "./"]
ARG VITE_API_URL=/kitchen/api
ARG VITE_BASE_PATH=/kitchen/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM nginx:1.27-alpine
COPY ["KCSKITCHEN/frontend/nginx.conf", "/etc/nginx/conf.d/default.conf"]
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
