# Stage 0, "build-stage", based on Node.js, to build and compile the frontend
FROM node:24 AS build-stage

WORKDIR /app

COPY package*.json /app/

RUN npm install

COPY ./ /app/

RUN npm run build


# Stage 1, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1

ENV VITE_API_URL="http://localhost:8000"
ENV VITE_DEFAULT_SELECTED_SPECS="Machinery,MachineTool,Core"

COPY --from=build-stage /app/dist/ /usr/share/nginx/html

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY ./nginx-backend-not-found.conf /etc/nginx/extra-conf.d/backend-not-found.conf

RUN cat > /docker-entrypoint.d/10-runtime-config.sh <<'EOF'
#!/bin/sh
set -eu

API_URL_ESCAPED=$(printf '%s' "${VITE_API_URL:-http://localhost:8000}" | sed 's/\\/\\\\/g; s/"/\\"/g')
DEFAULT_SPECS_ESCAPED=$(printf '%s' "${VITE_DEFAULT_SELECTED_SPECS:-Machinery,MachineTool,Core}" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/config.js <<CONFIG_EOF
window.__CLOU_CONFIG__ = {
  apiUrl: "${API_URL_ESCAPED}",
  defaultSelectedSpecs: "${DEFAULT_SPECS_ESCAPED}"
};
CONFIG_EOF
EOF

RUN chmod +x /docker-entrypoint.d/10-runtime-config.sh