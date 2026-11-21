# AeroSchool Guardian Mobile App – web build served by nginx.
#
# Stage 1 builds the Flutter web bundle with the exact Flutter release the app
# was developed with; stage 2 serves it and proxies /api/ to the
# Smart Educational Institute Management System backend.

ARG FLUTTER_VERSION=3.50.1

# ---------------------------------------------------------------- build stage
FROM debian:bookworm-20251117-slim AS build
ARG FLUTTER_VERSION
# Optional overrides baked into the bundle (empty = same-origin /api/v1 via nginx).
ARG API_BASE_URL=""
ARG WEB_APP_URL=""

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils \
 && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${FLUTTER_VERSION}" https://github.com/flutter/flutter.git /opt/flutter
ENV PATH="/opt/flutter/bin:/opt/flutter/bin/cache/dart-sdk/bin:${PATH}" \
    FLUTTER_SUPPRESS_ANALYTICS=true \
    PUB_CACHE=/opt/pub-cache
RUN git config --global --add safe.directory /opt/flutter \
 && flutter config --no-analytics --enable-web \
 && flutter precache --web

WORKDIR /app
# Dependencies first for better layer caching.
COPY pubspec.yaml pubspec.lock ./
RUN flutter pub get
COPY . .
RUN flutter build web --release \
      --dart-define=API_BASE_URL="${API_BASE_URL}" \
      --dart-define=WEB_APP_URL="${WEB_APP_URL}"

# ---------------------------------------------------------------- runtime stage
FROM nginx:1.27.5-alpine
LABEL org.opencontainers.image.title="AeroSchool Guardian Mobile App" \
      org.opencontainers.image.description="AeroSchool Guardian Mobile App (Flutter web) for the Smart Educational Institute Management System" \
      com.aeroschool.app="AeroSchool Guardian Mobile App"

# Backend the /api/ location proxies to (substituted into the nginx template at start-up).
ENV BACKEND_URL=http://host.docker.internal:4001

COPY docker/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/build/web /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
