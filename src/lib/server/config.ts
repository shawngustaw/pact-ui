import { normalizeBrokerUrl } from '@/lib/connection/config';
export function serverConfig(env: Record<string, string | undefined> = process.env) {
  const brokerUrl = env.PACT_BROKER_URL ? normalizeBrokerUrl(env.PACT_BROKER_URL) : '';
  const allowedUrls = [
    ...new Set(
      [brokerUrl, ...(env.PACT_BROKER_ALLOWED_URLS || '').split(',')]
        .filter(Boolean)
        .map(normalizeBrokerUrl),
    ),
  ];
  return { brokerUrl, allowedUrls, demo: env.PACT_UI_DEMO === 'true' };
}
