import { proxyBroker } from '@/lib/server/proxy';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const GET = (request: Request) => proxyBroker(request);
export const HEAD = (request: Request) => proxyBroker(request);
const reject = () =>
  Response.json(
    { message: 'This workspace only reads Broker data.' },
    { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } },
  );
export const POST = reject;
export const PUT = reject;
export const PATCH = reject;
export const DELETE = reject;
export const OPTIONS = reject;
