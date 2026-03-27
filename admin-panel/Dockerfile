# ---- Build Stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Development Stage ----
FROM node:20-alpine AS development
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
EXPOSE 3003
CMD ["npm", "run", "dev", "--", "--host"]

# ---- Production Stage ----
FROM nginx:1.25-alpine AS production
RUN adduser -S appuser -u 1001

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R appuser:nogroup /usr/share/nginx/html && \
    chown -R appuser:nogroup /var/cache/nginx && \
    chown -R appuser:nogroup /var/log/nginx && \
    touch /var/run/nginx.pid && chown appuser:nogroup /var/run/nginx.pid

USER appuser
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8081/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
