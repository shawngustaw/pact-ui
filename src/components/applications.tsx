import { useSearchParams } from 'next/navigation';
import Link from '@/components/link';
import { useEffect, useRef, useState } from 'react';
import {
  Search,
  GitBranch,
  ArrowUpRight,
  ArrowDown,
  ArrowRight,
  RefreshCw,
  Box,
  SlidersHorizontal,
  ArrowLeftRight,
  X,
} from 'lucide-react';
import { useDirectory } from '@/lib/domain/queries';
import { applicationStatus, latestVersion, date, type Application } from '@/lib/domain/models';
import { Button } from './ui/button';
import { StatusBadge } from './ui/status';
import { ErrorState, Loading, Empty } from './ui/feedback';
export function AppMark({ name }: { name: string }) {
  return (
    <span className={`app-mark mark-${name.length % 4}`}>
      <Box size={18} />
    </span>
  );
}
export function Applications() {
  const { apps, relationships, contracts } = useDirectory();
  const [search, setSearch] = useState(''),
    [role, setRole] = useState('all'),
    [status, setStatus] = useState('all'),
    [sort, setSort] = useState('name');
  const searchParams = useSearchParams();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => input.current?.focus();
    window.addEventListener('pact-search', focus);
    if (searchParams.has('search')) focus();
    return () => window.removeEventListener('pact-search', focus);
  }, [searchParams]);
  const relations = relationships.data || [],
    contractData = contracts.data || [];
  const filtered = (apps.data || [])
    .filter((app) => {
      const consumer = relations.some((r) => r.consumer.name === app.name),
        provider = relations.some((r) => r.provider.name === app.name);
      return (
        `${app.name} ${app.displayName || ''}`.toLowerCase().includes(search.toLowerCase()) &&
        (role === 'all' || (role === 'consumers' ? consumer : provider)) &&
        (status === 'all' ||
          (contracts.data && applicationStatus(app.name, contractData) === status))
      );
    })
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt || b.createdAt || 0).valueOf() -
          new Date(a.updatedAt || a.createdAt || 0).valueOf(),
    );
  const refresh = () => {
    void apps.refetch();
    void relationships.refetch();
    void contracts.refetch();
  };
  if (apps.isPending) return <Loading label="Loading applications…" />;
  if (apps.error) return <ErrorState error={apps.error} retry={() => void apps.refetch()} />;
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>
            Applications <span className="count-badge">{apps.data?.length}</span>
          </h1>
          <p>The services in your ecosystem, and the contracts that connect them.</p>
        </div>
        <Button
          onClick={refresh}
          disabled={apps.isFetching || relationships.isFetching || contracts.isFetching}
        >
          <RefreshCw size={14} className={apps.isFetching ? 'spinner' : ''} />
          Refresh
        </Button>
      </div>
      <div className="overview-strip">
        <span>
          <Box size={15} />
          <strong>{apps.data?.length}</strong> applications
        </span>
        <span>
          <ArrowLeftRight size={15} />
          <strong>{relationships.data ? relations.length : '—'}</strong> relationships
        </span>
        <span>
          <i className="dot failed" />
          <strong>
            {contracts.data
              ? contractData.filter((c) => c.latestVerificationResult?.success === false).length
              : '—'}
          </strong>{' '}
          failed verifications
        </span>
        <span>
          <i className="dot unknown" />
          <strong>
            {contracts.data
              ? contractData.filter((c) => c.latestVerificationResult?.success == null).length
              : '—'}
          </strong>{' '}
          awaiting verification
        </span>
      </div>
      {relationships.error && (
        <div className="inline-warning">
          Relationships are unavailable.{' '}
          <button onClick={() => void relationships.refetch()}>Retry</button>
        </div>
      )}
      {contracts.error && (
        <div className="inline-warning">
          Verification data is unavailable; application status is not known.{' '}
          <button onClick={() => void contracts.refetch()}>Retry</button>
        </div>
      )}
      <div className="table-panel">
        <div className="table-tabs" role="group" aria-label="Application role">
          {[
            ['all', 'All applications'],
            ['consumers', 'Consumers'],
            ['providers', 'Providers'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={role === value}
              className={role === value ? 'selected' : ''}
              onClick={() => setRole(value)}
            >
              {label}
              {value === 'all' && <span>{apps.data?.length}</span>}
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              ref={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applications…"
              aria-label="Search applications"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </label>
          <div className="toolbar-controls">
            <label className="filter-select">
              <SlidersHorizontal size={14} />
              <select
                aria-label="Filter verification status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="verified">Verified</option>
                <option value="failed">Failed</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label className="filter-select">
              <ArrowDown size={14} />
              <select
                aria-label="Sort applications"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="name">Name</option>
                <option value="activity">Recent activity</option>
              </select>
            </label>
          </div>
        </div>
        <div className="table-scroll" role="region" aria-label="Application directory" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th className="application-column">Application</th>
                <th>Verification</th>
                <th>Relationships</th>
                <th>Latest version</th>
                <th>Main branch</th>
                <th>Last changed</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((app) => (
                <ApplicationRow
                  key={app.name}
                  app={app}
                  status={contracts.data ? applicationStatus(app.name, contractData) : 'unknown'}
                  consumers={
                    relationships.data
                      ? relations.filter((r) => r.provider.name === app.name).length
                      : undefined
                  }
                  providers={
                    relationships.data
                      ? relations.filter((r) => r.consumer.name === app.name).length
                      : undefined
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <Empty
            title={apps.data?.length ? 'No matching applications' : 'No applications yet'}
            description={
              apps.data?.length
                ? 'Try a different name, role, or verification status.'
                : 'Publish your first pact to the Broker to see your applications here.'
            }
          />
        )}
        <div className="table-footer">
          <span>
            Showing {filtered.length} of {apps.data?.length} applications
          </span>
          <span>Verification reflects the Broker dashboard</span>
        </div>
      </div>
      <div className="context-note">
        <ArrowRight size={14} />
        <span>Explore an application to see its contracts, branches, and environment history.</span>
        <Link href="/dependencies">
          View dependency graph <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
function ApplicationRow({
  app,
  status,
  consumers,
  providers,
}: {
  app: Application;
  status: string;
  consumers?: number;
  providers?: number;
}) {
  return (
    <tr>
      <td>
        <Link className="application-name" href={`/applications/${encodeURIComponent(app.name)}`}>
          <AppMark name={app.name} />
          <span>
            <strong>{app.name}</strong>
            <small>{app.displayName || 'Pact participant'}</small>
          </span>
        </Link>
      </td>
      <td>
        <StatusBadge status={status} />
      </td>
      <td>
        <div className="relation-counts">
          <span title="Applications consuming this application">
            <ArrowDown size={12} />
            {consumers ?? '—'} <span>consumers</span>
          </span>
          <span title="Applications this application consumes">
            <ArrowUpRight size={12} />
            {providers ?? '—'} <span>providers</span>
          </span>
        </div>
      </td>
      <td>
        <code className="version">{latestVersion(app)}</code>
      </td>
      <td>
        <span className="branch">
          <GitBranch size={13} />
          {app.mainBranch || '—'}
        </span>
      </td>
      <td className="muted nowrap">{date(app.updatedAt || app.createdAt)}</td>
      <td>
        <Link
          className="row-arrow"
          href={`/applications/${encodeURIComponent(app.name)}`}
          aria-label={`Open ${app.name}`}
        >
          <ArrowUpRight size={15} />
        </Link>
      </td>
    </tr>
  );
}
