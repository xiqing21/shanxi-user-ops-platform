FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/simulator/package.json packages/simulator/package.json
COPY packages/agent/package.json packages/agent/package.json
RUN pnpm install

FROM deps AS app
COPY . .
EXPOSE 4000
CMD ["pnpm", "--filter", "@shanxi/api", "dev"]
