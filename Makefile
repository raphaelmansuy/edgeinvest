# EdgeInvest local development.
# Starts only this Compose project's database. Other Docker containers are left alone.

.DEFAULT_GOAL := help
.PHONY: help dev start stop status logs

help:
	@printf '%s\n' \
		'EdgeInvest' \
		'' \
		'  make dev      Start the database, then the API, worker and web' \
		'  make start    Same as dev, in the background' \
		'  make stop     Stop the app and this project database container' \
		'  make status   Show whether the app and database are up' \
		'  make logs     Follow the API, worker and web logs' \
		'  make audit    Desktop-light screenshots + axe for every SCR' \
		'' \
		'Practice accounts and the shared password appear on the sign-in screen.' \
		''

dev:
	@bun run tools/dev.ts

start:
	@bun run tools/dev.ts --background

stop:
	@bun run tools/dev.ts --stop

status:
	@bun run tools/dev.ts --status

logs:
	@mkdir -p .dev/logs
	@touch .dev/logs/api.log .dev/logs/worker.log .dev/logs/web.log
	@tail -n 60 -f .dev/logs/api.log .dev/logs/worker.log .dev/logs/web.log

audit:
	@bun run tools/screenshot-audit.ts
