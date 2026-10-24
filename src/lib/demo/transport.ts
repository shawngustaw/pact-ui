import demo from './responses.json';
export function demoResponse(request: Request): Response {
  const url = new URL(request.url);
  const records: Record<string, { status: number; body: unknown }> = demo.records;
  const key = url.pathname + url.search;
  ['page', 'size', 'pageNumber', 'pageSize'].forEach((name) => url.searchParams.delete(name));
  const record = records[key] || records[url.pathname + url.search];
  return Response.json(
    record?.body || { message: 'This resource is not present in the captured demo.' },
    { status: record?.status || 404 },
  );
}
