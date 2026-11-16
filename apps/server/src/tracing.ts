let shutdown: (() => Promise<void>) | null = null;

if (process.env.OTEL_ENABLED === 'true') {
  try {
    const { startTracing } = await import('./tracing-runtime');
    shutdown = await startTracing();
  } catch (error) {
    console.error('[tracing] Could not start the OpenTelemetry exporter', error);
  }
}

export async function shutdownTracing(): Promise<void> {
  await shutdown?.();
}
