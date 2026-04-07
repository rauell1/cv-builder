/**
 * Next.js Instrumentation — runs once on server startup.
 * Global error handlers are managed per-route in try/catch blocks.
 */
export async function register() {
  console.warn('[instrumentation] Server instrumentation registered');
}
