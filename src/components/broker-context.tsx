import { createContext, Fragment, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/browser';
import type { BrokerAuth } from '@/lib/api/client';
import {
  CONNECTION_STORAGE_KEY,
  loadConnection,
  normalizeBrokerUrl,
  persistConnection,
  type Connection,
} from '@/lib/connection/config';
interface Actions {
  connect: (baseUrl: string, auth?: BrokerAuth) => Promise<void>;
  demo: () => Promise<void>;
  disconnect: () => Promise<void>;
}
const Context = createContext<Connection | undefined>(undefined),
  ActionsContext = createContext<Actions | undefined>(undefined);
export function useConnection() {
  const value = useContext(Context);
  if (!value) throw new Error('Broker connection context missing.');
  return value;
}
export function useConnectionActions() {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('Broker connection actions missing.');
  return value;
}
export function BrokerProvider({ children }: { children: React.ReactNode }) {
  const client = useQueryClient(),
    revision = useRef(0);
  const [connection, setConnection] = useState<Connection>({
    mode: 'loading',
    readOnly: true,
    sessionId: 0,
  });
  useEffect(() => {
    const controller = new AbortController();
    void loadConnection(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setConnection(value);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const replace = async (next: Connection, persist = true) => {
    await client.cancelQueries();
    client.clear();
    if (persist) {
      try {
        persistConnection(localStorage, next);
      } catch {
        /* Still usable with session-only preferences. */
      }
    }
    setConnection({ ...next, sessionId: ++revision.current });
  };
  const actions: Actions = {
    async connect(baseUrl, auth) {
      const candidate: Connection = {
        mode: 'live',
        baseUrl: normalizeBrokerUrl(baseUrl),
        auth,
        sessionId: revision.current + 1,
        readOnly: true,
      };
      await api(candidate).load('/');
      await replace(candidate);
    },
    async demo() {
      await replace({
        mode: 'demo',
        baseUrl: 'http://broker.example',
        readOnly: true,
        sessionId: 0,
      });
    },
    async disconnect() {
      try {
        localStorage.removeItem(CONNECTION_STORAGE_KEY);
      } catch {}
      await replace({ mode: 'unconfigured', readOnly: true, sessionId: 0 }, false);
    },
  };
  return (
    <Context.Provider value={connection}>
      <ActionsContext.Provider value={actions}>
        <Fragment key={connection.sessionId}>{children}</Fragment>
      </ActionsContext.Provider>
    </Context.Provider>
  );
}
