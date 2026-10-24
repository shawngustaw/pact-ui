'use client';
import { useQuery } from '@tanstack/react-query';
import { useConnection } from '@/components/broker-context';
import { api } from '@/lib/api/browser';
import { participantSchema, relationshipSchema, dashboardItems } from './models';

export function useDirectory() {
  const connection = useConnection(),
    enabled = connection.mode === 'live' || connection.mode === 'demo';
  const apps = useQuery({
    queryKey: ['applications', connection.baseUrl, connection.sessionId],
    enabled,
    queryFn: async ({ signal }) =>
      (await api(connection, signal).applications()).map((a) => participantSchema.parse(a)),
  });
  const relationships = useQuery({
    queryKey: ['relationships', connection.baseUrl, connection.sessionId],
    enabled,
    queryFn: async ({ signal }) =>
      (await api(connection, signal).collection('/integrations', 'integrations')).map((r) =>
        relationshipSchema.parse(r),
      ),
  });
  const contracts = useQuery({
    queryKey: ['contracts', connection.baseUrl, connection.sessionId],
    enabled,
    queryFn: async ({ signal }) => dashboardItems(await api(connection, signal).load('/dashboard')),
  });
  return { apps, relationships, contracts, connection };
}
export function useResource(path: string | undefined, key: unknown[] = []) {
  const connection = useConnection();
  return useQuery({
    queryKey: ['resource', connection.baseUrl, connection.sessionId, path, ...key],
    enabled: !!path && !!connection.baseUrl,
    queryFn: ({ signal }) => api(connection, signal).load(path!),
  });
}
export function useCollection(path: string | undefined, relation: string) {
  const connection = useConnection();
  return useQuery({
    queryKey: ['collection', connection.baseUrl, connection.sessionId, path, relation],
    enabled: !!path && !!connection.baseUrl,
    queryFn: ({ signal }) => api(connection, signal).collection(path!, relation),
  });
}
