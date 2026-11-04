/** Bounds the caller even when a provider ignores cancellation; late results never win. */
export function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  ms: number,
  parent?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    const finish = (result: { ok: true; value: T } | { ok: false; error: unknown }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      parent?.removeEventListener('abort', cancel);
      if (!result.ok) {
        controller.abort();
        reject(result.error);
      } else resolve(result.value);
    };
    const cancel = () =>
      finish({ ok: false, error: new DOMException('Request cancelled', 'AbortError') });
    const timer = setTimeout(
      () =>
        finish({ ok: false, error: new DOMException('Request deadline exceeded', 'TimeoutError') }),
      ms,
    );
    parent?.addEventListener('abort', cancel, { once: true });
    if (parent?.aborted) {
      cancel();
      return;
    }
    try {
      Promise.resolve(work(controller.signal)).then(
        (value) => finish({ ok: true, value }),
        (error) => finish({ ok: false, error }),
      );
    } catch (error) {
      finish({ ok: false, error });
    }
  });
}
