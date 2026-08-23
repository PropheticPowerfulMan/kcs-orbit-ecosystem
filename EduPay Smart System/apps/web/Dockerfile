FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json vite.config.ts tailwind.config.ts postcss.config.js index.html ./
COPY src ./src
COPY public ./public
RUN npm install
ARG VITE_API_BASE_URL
ARG VITE_RECEIPT_VERIFICATION_BASE_URL
ARG VITE_BASE_PATH=/
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_RECEIPT_VERIFICATION_BASE_URL=$VITE_RECEIPT_VERIFICATION_BASE_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
