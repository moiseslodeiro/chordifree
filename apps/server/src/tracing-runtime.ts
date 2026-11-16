import { credentials } from '@grpc/grpc-js';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { GoogleAuth, type OAuth2Client } from 'google-auth-library';

/**
 * Sends OTLP traces to the Google Cloud Telemetry API. Loaded only when
 * OTEL_ENABLED=true so local and desktop installs do not pay for the
 * instrumentation modules.
 */
export async function startTracing(): Promise<() => Promise<void>> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const client = (await auth.getClient()) as OAuth2Client;

  const grpcCredentials = {
    async getRequestHeaders(url?: string): Promise<Record<string, string>> {
      const headers = await client.getRequestHeaders(url);
      return Object.fromEntries(headers.entries());
    },
  };

  const exporter = new OTLPTraceExporter({
    url: 'telemetry.googleapis.com:443',
    credentials: credentials.combineChannelCredentials(
      credentials.createSsl(),
      credentials.createFromGoogleCredential(
        grpcCredentials as unknown as Parameters<
          typeof credentials.createFromGoogleCredential
        >[0],
      ),
    ),
  });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new UndiciInstrumentation(),
    ],
  });

  sdk.start();
  return async () => {
    await sdk.shutdown();
  };
}
