import { z } from 'zod';
import { halSchema, embedded, type HalResource, link } from '@/lib/api/hal';

export const participantSchema = halSchema.extend({
  name: z.string(),
  displayName: z.string().nullish(),
  mainBranch: z.string().nullish(),
  repositoryUrl: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
export type Application = z.infer<typeof participantSchema>;
export const relationshipSchema = halSchema.extend({
  consumer: z.object({ name: z.string() }),
  provider: z.object({ name: z.string() }),
});
export type Relationship = z.infer<typeof relationshipSchema>;
export type Status = 'verified' | 'failed' | 'unknown';
export function verificationStatus(value: unknown): Status {
  return value === true ? 'verified' : value === false ? 'failed' : 'unknown';
}
export function compatibilityStatus(value: unknown): 'safe' | 'blocked' | 'unknown' {
  return value === true ? 'safe' : value === false ? 'blocked' : 'unknown';
}
export const dashboardItemSchema = halSchema.extend({
  consumer: halSchema.extend({ name: z.string(), version: z.unknown().optional() }),
  provider: halSchema.extend({ name: z.string(), version: z.unknown().optional() }),
  pact: halSchema.optional(),
  latestVerificationResult: halSchema
    .extend({ success: z.boolean().nullish(), verifiedAt: z.string().nullish() })
    .nullish(),
  verificationStatus: z.string().optional(),
});
export type ContractSummary = z.infer<typeof dashboardItemSchema>;
export function dashboardItems(data: HalResource): ContractSummary[] {
  return z.array(dashboardItemSchema).parse(data.items || []);
}
export function applicationStatus(name: string, contracts: ContractSummary[]): Status {
  const related = contracts.filter((c) => c.consumer.name === name || c.provider.name === name);
  if (!related.length) return 'unknown';
  if (related.some((c) => c.latestVerificationResult?.success === false)) return 'failed';
  return related.every((c) => c.latestVerificationResult?.success === true)
    ? 'verified'
    : 'unknown';
}
export function latestVersion(app: Application) {
  return string(embedded(app, 'latestVersion')[0]?.number);
}
export function string(value: unknown, fallback = '—'): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}
export function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function date(value: unknown): string {
  if (typeof value !== 'string') return '—';
  const d = new Date(value);
  return Number.isNaN(d.valueOf())
    ? '—'
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
export function safeExternalUrl(value: unknown): string | undefined {
  try {
    const url = new URL(String(value));
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function contractHref(item: ContractSummary) {
  return item.pact ? link(item.pact, 'self') : undefined;
}

export interface JsonChange {
  path: string;
  before: unknown;
  after: unknown;
  kind: 'added' | 'removed' | 'changed';
}
export function diffJson(before: unknown, after: unknown, path = '$'): JsonChange[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const a = object(before),
      b = object(after);
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((key) =>
      diffJson(a[key], b[key], `${path}.${key}`),
    );
  }
  return [
    {
      path,
      before,
      after,
      kind: before === undefined ? 'added' : after === undefined ? 'removed' : 'changed',
    },
  ];
}
