import { serverConfig } from '@/lib/server/config';
export const dynamic = 'force-dynamic';
export function GET() {
  try {
    const { brokerUrl, demo } = serverConfig();
    return Response.json({ brokerUrl, demo }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { message: 'Invalid Broker URL configuration on the app server.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
