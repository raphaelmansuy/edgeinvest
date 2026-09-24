export function ownerUrl(): string {
  if (process.env.MIGRATE_DATABASE_URL) return process.env.MIGRATE_DATABASE_URL;
  const pw = process.env.POSTGRES_OWNER_PASSWORD;
  if (!pw) throw new Error("POSTGRES_OWNER_PASSWORD is required");
  const host = process.env.DB_HOST ?? "localhost";
  const db = process.env.DB_NAME ?? "edgeinvest";
  return `postgres://edge_owner:${encodeURIComponent(pw)}@${host}:${process.env.DB_PORT ?? 5432}/${db}`;
}
