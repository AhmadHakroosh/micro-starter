# ===============================
# 📦 STAGE 1: Base Setup
# ===============================
FROM node:22-alpine3.21 AS base

# Install dependencies required for builds, including Python and build tools
RUN apk add --no-cache git openssh-client python3 make g++

# Configure SSH for private repositories (if needed)
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh \
    && ssh-keyscan bitbucket.org > /root/.ssh/known_hosts

# Install pnpm globally (using npm bundled with Node.js)
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package.json and pnpm-lock.yaml first (leveraging Docker caching)
COPY package.json pnpm-lock.yaml ./

# Use SSH forwarding during install (requires Docker BuildKit) and install dependencies using pnpm
RUN --mount=type=ssh pnpm install --frozen-lockfile

# ===============================
# 🏗 STAGE 2.A: Build (Production)
# ===============================
FROM base AS build-prod

# Copy application code (only after dependencies are installed to optimize caching)
COPY . .

# Build the NestJS application using pnpm
RUN pnpm run build

# Remove the "prepare" script to avoid triggering Husky or similar hooks
RUN pnpm pkg delete scripts.prepare

# Remove development dependencies to keep the production image lean
RUN pnpm prune --prod

# ===============================
# 🏗 STAGE 2.B: Build (Development)
# ===============================
FROM base AS build-dev

# Copy application code (only after dependencies are installed to optimize caching)
COPY . .

# Build the NestJS application using pnpm
RUN pnpm run build

# ===============================
# 🧪 STAGE 3: Test (Coverage)
# ===============================
FROM base AS test

# Copy the entire application code
COPY . .

# Run tests with coverage (assuming "test:cov" is defined in package.json)
RUN pnpm run test:cov

# ===============================
# 🏭 STAGE 4.A: Production Runtime
# ===============================
FROM node:22-alpine3.21 AS production

# Install tini for better process management (prevents zombie processes)
RUN apk add --no-cache tini

# Set working directory
WORKDIR /app

# Copy production artifacts from the production build stage
COPY --from=build-prod --chown=node:node /app/node_modules ./node_modules
COPY --from=build-prod --chown=node:node /app/dist ./dist
COPY --from=test --chown=node:node /app/coverage/cobertura-coverage.xml /var/tmp/cobertura-coverage.xml

# Expose the application port
EXPOSE 3000

# Switch to a non-root user for security
USER node

# Use tini as the init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application in production mode
CMD ["node", "dist/main"]

# ===============================
# 🛠 STAGE 4.B: Development Runtime
# ===============================
FROM build-dev AS development

# Install additional tools for debugging (optional)
RUN apk add --no-cache bash

# Expose the application and debugging ports
EXPOSE 3000 9229

# Start the application in development mode with hot reload
CMD ["pnpm", "run", "start:dev"]