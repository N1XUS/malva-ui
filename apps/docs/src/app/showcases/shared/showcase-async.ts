/** Deterministic, local request simulation for showcase-only persistence flows. */
export async function runShowcaseOperation<T>(
  operation: () => T,
  options: { readonly fail?: boolean; readonly delay?: number } = {},
): Promise<{ readonly ok: true; readonly value: T } | { readonly ok: false }> {
  await new Promise<void>((resolve) =>
    setTimeout(resolve, options.delay ?? 12),
  );
  return options.fail ? { ok: false } : { ok: true, value: operation() };
}
