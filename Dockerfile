# syntax=docker/dockerfile:1

# Node 25+ no longer bundles corepack, so pnpm is installed with npm, pinned to
# the "packageManager" version in package.json.
FROM node:26-alpine AS base
RUN npm install -g pnpm@12.18.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS prod-deps
# --ignore-scripts skips "prepare" (husky), which is a dev-only tool.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:26-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/index.js"]
