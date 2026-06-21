# Author: Bishakh
# Monorepo-aware image for the edge service (build context = worldcup-hub root).
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @wc/edge build
RUN pnpm --filter @wc/edge deploy --legacy --prod /out

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/dist ./dist
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
EXPOSE 8888
CMD ["node", "dist/index.js"]
