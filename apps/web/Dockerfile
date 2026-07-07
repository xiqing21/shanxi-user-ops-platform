FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install
COPY . .
EXPOSE 5050
CMD ["pnpm", "--filter", "@shanxi/web", "dev"]
