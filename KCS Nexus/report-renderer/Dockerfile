FROM node:22-alpine
RUN apk add --no-cache chromium && mkdir -p /run/kcs-report && chown node:node /run/kcs-report
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.mjs ./
ENV HOME=/tmp XDG_CONFIG_HOME=/tmp/.config XDG_CACHE_HOME=/tmp/.cache
ENV NODE_ENV=production REPORT_PDF_RENDERER_SOCKET=/run/kcs-report/renderer.sock
USER node
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 CMD node -e "require('http').get({socketPath:process.env.REPORT_PDF_RENDERER_SOCKET,path:'/health'},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.mjs"]
