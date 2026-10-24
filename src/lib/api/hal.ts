import { z } from 'zod';

export const halLinkSchema = z
  .object({
    href: z.string(),
    templated: z.boolean().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
  })
  .passthrough();
const linkValue = z.union([halLinkSchema, z.array(halLinkSchema)]);
export const halSchema = z
  .object({
    _links: z.record(z.string(), linkValue).optional(),
    _embedded: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export type HalResource = z.infer<typeof halSchema>;
export type HalLink = z.infer<typeof halLinkSchema>;

export class BrokerError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'BrokerError';
  }
}
export function links(resource: HalResource, relation: string): HalLink[] {
  const value = resource._links?.[relation];
  return !value ? [] : Array.isArray(value) ? value : [value];
}
export function link(resource: HalResource, relation: string): string | undefined {
  return links(resource, relation).find((l) => !l.templated)?.href;
}
export function embedded(resource: HalResource, relation: string): HalResource[] {
  const value = resource._embedded?.[relation];
  return (Array.isArray(value) ? value : value ? [value] : []).map((v) => halSchema.parse(v));
}
/** Strip only the configured base prefix. Never send credentials to a HAL-controlled origin. */
export function brokerPath(href: string, baseUrl: string): string {
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  const target = new URL(href, base);
  if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname))
    throw new BrokerError(400, 'HAL link points outside the configured Broker.');
  if (target.username || target.password || target.hash)
    throw new BrokerError(400, 'Invalid HAL link.');
  return `/${target.pathname.slice(base.pathname.length)}${target.search}`;
}
export async function* paginate(
  first: string,
  load: (url: string) => Promise<HalResource>,
  options: { signal?: AbortSignal; maxPages?: number } = {},
): AsyncGenerator<HalResource> {
  let next: string | undefined = first;
  const seen = new Set<string>();
  while (next) {
    options.signal?.throwIfAborted();
    if (seen.has(next)) throw new BrokerError(502, 'Broker pagination contains a cycle.');
    if (seen.size >= (options.maxPages ?? 1000))
      throw new BrokerError(502, 'Broker pagination limit exceeded. Narrow the query.');
    seen.add(next);
    const page = await load(next);
    yield page;
    next = link(page, 'next');
  }
}
