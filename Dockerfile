FROM oven/bun:1.4.2 AS deps
WORKDIR /repo
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ packages/
RUN bun install --frozen-lockfile

FROM deps AS src
COPY . .

FROM src AS migrate
USER bun
CMD ["bun", "run", "db:migrate"]

FROM src AS api
USER bun
EXPOSE 8787
CMD ["bun", "run", "--cwd", "apps/api", "start"]

FROM src AS worker
USER bun
CMD ["bun", "run", "--cwd", "apps/worker", "start"]

FROM src AS web-dev
USER bun
EXPOSE 5173
CMD ["bun", "run", "--cwd", "apps/web", "dev", "--host", "0.0.0.0"]
