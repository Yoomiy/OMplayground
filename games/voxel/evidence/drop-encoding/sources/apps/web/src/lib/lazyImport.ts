/**
 * A Vite dev server can briefly return an incomplete response while it is
 * invalidating a module graph. Retry a lazy import once so a transient module
 * fetch failure does not send an otherwise healthy route to the error boundary.
 */
export async function lazyImportWithRetry<T>(
  load: () => Promise<T>,
  retries = 1
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    return lazyImportWithRetry(load, retries - 1);
  }
}
