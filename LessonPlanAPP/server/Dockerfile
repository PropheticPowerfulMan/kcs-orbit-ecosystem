FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.mjs emailTemplate.mjs serviceConfig.mjs institutionalLogin.mjs sessionAccess.mjs academyPlans.mjs academicProfileRole.mjs lessonDocument.mjs lessonDocuments.mjs lessonPdf.mjs pdfViews.mjs ./
COPY assets ./assets
EXPOSE 3001
CMD ["node", "index.mjs"]
