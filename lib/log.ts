import "server-only";

type Meta = Record<string, unknown>;

/**
 * Structured single-line error log. Surfaces in Vercel function logs and is
 * trivial to forward to Sentry/Logtail later (one place to change). Use in
 * server actions, route handlers, and webhooks where failures would otherwise
 * vanish into a returned error string.
 */
export function logError(scope: string, error: unknown, meta?: Meta): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  console.error(
    JSON.stringify({ level: "error", scope, ...meta, error: err }),
  );
}
