'use client';
import { Suspense } from 'react';
import { Providers } from './providers';
import { BrokerProvider } from './broker-context';
import { Shell } from './shell';
import { ErrorBoundary } from './error-boundary';
export function Workspace({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p>Loading workspace…</p>}>
      <Providers>
        <BrokerProvider>
          <Shell>
            <ErrorBoundary>{children}</ErrorBoundary>
          </Shell>
        </BrokerProvider>
      </Providers>
    </Suspense>
  );
}
