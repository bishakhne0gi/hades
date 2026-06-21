# Author: Bishakh
# Monorepo-aware image: build context is the worldcup-hub root so pnpm can
# resolve workspace packages (@wc/types). `pnpm deploy` produces a self-contained
# bundle (package + flattened prod node_modules) for a small runtime image.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @wc/bff build
RUN pnpm --filter @wc/bff deploy --legacy --prod /out

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/dist ./dist
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
EXPOSE 8080
CMD ["node", "dist/index.js"]
