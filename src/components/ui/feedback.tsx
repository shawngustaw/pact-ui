import { AlertCircle, SearchX, LoaderCircle } from 'lucide-react';
import { BrokerError } from '@/lib/api/hal';
import Link from '@/components/link';
import { Button } from './button';
export function Loading({ label = 'Loading Broker data…' }: { label?: string }) {
  return (
    <div className="feedback" role="status">
      <LoaderCircle className="spinner" size={20} />
      <p>{label}</p>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="feedback error-state" role="alert">
      <AlertCircle size={22} />
      <h3>Couldn’t load this data</h3>
      <p>
        {error instanceof Error ? error.message : 'The Broker returned an unexpected response.'}
      </p>
      {error instanceof BrokerError && [0, 401, 403].includes(error.status) && (
        <Link className="text-link" href="/settings">
          Connection settings
        </Link>
      )}
      {retry && <Button onClick={retry}>Try again</Button>}
    </div>
  );
}
export function Empty({
  title = 'No results',
  description = 'Try another search or change your filters.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="feedback">
      <SearchX size={24} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
