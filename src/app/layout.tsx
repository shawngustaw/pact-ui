import type { Metadata } from 'next';
import { Workspace } from '@/components/workspace';
import '../styles.css';
export const metadata: Metadata = {
  title: 'Pact Broker',
  description: 'Inspect contracts, verification evidence, and deployment compatibility.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Workspace>{children}</Workspace>
      </body>
    </html>
  );
}
