'use client';
import Link from '@/components/link';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  GitBranch,
  ExternalLink,
  FileJson2,
} from 'lucide-react';
import { useDirectory, useResource, useCollection } from '@/lib/domain/queries';
import {
  participantSchema,
  applicationStatus,
  string,
  date,
  safeExternalUrl,
} from '@/lib/domain/models';
import { embedded, links, link, type HalResource } from '@/lib/api/hal';
import { AppMark } from './applications';
import { Contracts, JsonView } from './contracts';
import { StatusBadge } from './ui/status';
import { Button } from './ui/button';
import { TabView } from './ui/tab-view';
import { Loading, ErrorState, Empty } from './ui/feedback';
export function ApplicationDetails({ name }: { name: string }) {
  const query = useResource(`/pacticipants/${encodeURIComponent(name)}`),
    directory = useDirectory(),
    [tab, setTab] = useState('overview');
  const versions = useCollection(
    query.data ? link(query.data, 'pb:versions') : undefined,
    'versions',
  );
  const branches = useCollection(
    query.data ? link(query.data, 'pb:branches') : undefined,
    'branches',
  );
  const deployed = useCollection(
    `/pacticipants/${encodeURIComponent(name)}/deployed-or-released/versions`,
    'versions',
  );
  if (query.isPending) return <Loading label="Loading application…" />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const parsed = participantSchema.safeParse(query.data);
  if (!parsed.success)
    return (
      <ErrorState error={new Error('The Broker returned an invalid application representation.')} />
    );
  const app = parsed.data,
    relations = directory.relationships.data || [];
  const consumers = relations.filter((r) => r.provider.name === name),
    providers = relations.filter((r) => r.consumer.name === name);
  return (
    <div className="page">
      <Link href="/applications" className="back-link">
        <ArrowLeft size={13} />
        All applications
      </Link>
      <div className="page-heading app-detail-heading">
        <div className="app-detail-title">
          <AppMark name={name} />
          <div>
            <h1>{name}</h1>
            <p>
              {app.displayName} <span className="inline-separator">·</span>
              <GitBranch size={12} /> {app.mainBranch || 'No main branch configured'}
            </p>
          </div>
        </div>
        <div className="heading-actions">
          <StatusBadge
            status={
              directory.contracts.data
                ? applicationStatus(name, directory.contracts.data)
                : 'unknown'
            }
          />
          {safeExternalUrl(app.repositoryUrl) && (
            <Button asChild>
              <a href={safeExternalUrl(app.repositoryUrl)} target="_blank" rel="noreferrer">
                Repository
                <ArrowUpRight size={14} />
              </a>
            </Button>
          )}
        </div>
      </div>
      <TabView
        value={tab}
        onValueChange={setTab}
        label="Application sections"
        tabs={[
          ['overview', 'Overview'],
          ['contracts', 'Contracts'],
          ['versions', <>Versions {versions.data && <span>{versions.data.length}</span>}</>],
          ['branches', 'Branches'],
          ['deployments', 'Deployments & releases'],
        ]}
      >
        {tab === 'overview' && (
          <>
            <div className="detail-overview">
              <section>
                <div className="section-heading">
                  <h2>Relationships</h2>
                  <Link
                    className="text-link"
                    href={`/dependencies?focus=${encodeURIComponent(name)}`}
                  >
                    Explore graph <ArrowUpRight size={12} />
                  </Link>
                </div>
                {directory.relationships.error ? (
                  <ErrorState error={directory.relationships.error} />
                ) : directory.relationships.isPending ? (
                  <Loading />
                ) : (
                  <div className="relationship-columns">
                    <div>
                      <h4>
                        Consumers <span>{consumers.length}</span>
                      </h4>
                      <p className="small muted">Applications that depend on {name}.</p>
                      {consumers.map((r) => (
                        <RelatedApp key={r.consumer.name} name={r.consumer.name} />
                      ))}
                      {!consumers.length && <p className="small muted">No consumers reported.</p>}
                    </div>
                    <div>
                      <h4>
                        Providers <span>{providers.length}</span>
                      </h4>
                      <p className="small muted">Applications that {name} depends on.</p>
                      {providers.map((r) => (
                        <RelatedApp key={r.provider.name} name={r.provider.name} />
                      ))}
                      {!providers.length && <p className="small muted">No providers reported.</p>}
                    </div>
                  </div>
                )}
              </section>
              <aside className="application-metadata">
                <h3>Application details</h3>
                <dl>
                  <dt>Main branch</dt>
                  <dd className="branch">
                    <GitBranch size={13} />
                    {app.mainBranch || 'Not set'}
                  </dd>
                  <dt>Created</dt>
                  <dd>{date(app.createdAt)}</dd>
                  <dt>Last updated</dt>
                  <dd>{date(app.updatedAt || app.createdAt)}</dd>
                  <dt>Labels</dt>
                  <dd>
                    {embedded(app, 'labels')
                      .map((l) => string(l.name))
                      .join(', ') || 'No labels'}
                  </dd>
                  <dt>Currently deployed</dt>
                  <dd>
                    {links(app, 'pb:deployed-environments')
                      .filter((l) => l.currently_deployed === true)
                      .map((l) => l.name)
                      .join(', ') || 'Not reported'}
                  </dd>
                </dl>
              </aside>
            </div>
            <div className="section-heading">
              <h2>Contract publications</h2>
              <Button variant="ghost" size="sm" onClick={() => setTab('contracts')}>
                View all
                <ArrowRight size={13} />
              </Button>
            </div>
            <Contracts application={name} />
          </>
        )}
        {tab === 'contracts' && <Contracts application={name} />}{' '}
        {tab === 'versions' &&
          (versions.isPending ? (
            <Loading />
          ) : versions.error ? (
            <ErrorState error={versions.error} />
          ) : (
            <VersionTable versions={versions.data || []} />
          ))}
        {tab === 'branches' &&
          (branches.isPending ? (
            <Loading />
          ) : branches.error ? (
            <ErrorState error={branches.error} />
          ) : (
            <div className="table-panel">
              <table>
                <thead>
                  <tr>
                    <th>Branch</th>
                    <th>Created</th>
                    <th>Latest version</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.data?.map((branch, i) => (
                    <BranchRow key={i} branch={branch} />
                  ))}
                </tbody>
              </table>
              {!branches.data?.length && (
                <Empty
                  title="No branches"
                  description="Publish version branch information through your Pact tooling."
                />
              )}
            </div>
          ))}
        {tab === 'deployments' &&
          (deployed.isPending ? (
            <Loading />
          ) : deployed.error ? (
            <ErrorState error={deployed.error} />
          ) : (
            <>
              <p className="muted">
                All application versions with a deployment or release recorded by the Broker.
              </p>
              <VersionTable versions={deployed.data || []} environments />
            </>
          ))}
      </TabView>
    </div>
  );
}
function RelatedApp({ name }: { name: string }) {
  return (
    <Link className="related-app" href={`/applications/${encodeURIComponent(name)}`}>
      <AppMark name={name} />
      <span>{name}</span>
      <ArrowUpRight size={13} />
    </Link>
  );
}
function BranchRow({ branch }: { branch: HalResource }) {
  const latest = useResource(link(branch, 'pb:latest-version'));
  return (
    <tr>
      <td>
        <span className="branch">
          <GitBranch size={14} />
          {string(branch.name)}
        </span>
      </td>
      <td className="muted">{date(branch.createdAt)}</td>
      <td>
        <code>
          {latest.error ? 'Unavailable' : latest.isPending ? '…' : string(latest.data?.number)}
        </code>
      </td>
    </tr>
  );
}
export function VersionTable({
  versions,
  environments = false,
}: {
  versions: HalResource[];
  environments?: boolean;
}) {
  const [selected, setSelected] = useState<HalResource>();
  return (
    <div className="table-panel">
      <div className="table-scroll" role="region" aria-label="Application versions" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Version</th>
              <th>Branches</th>
              <th>Published</th>
              <th>{environments ? 'Deployments & releases' : 'CI build'}</th>
              <th>
                <span className="sr-only">Inspect</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {versions.map((version, i) => (
              <tr key={i}>
                <td>
                  <code className="version">{string(version.number)}</code>
                </td>
                <td>
                  <span className="branch">
                    <GitBranch size={12} />
                    {embedded(version, 'branchVersions')
                      .map((b) => string(b.name))
                      .join(', ') || '—'}
                  </span>
                </td>
                <td className="muted">{date(version.createdAt)}</td>
                <td>
                  {environments ? (
                    <span className="environment-chips">
                      {[
                        ...links(version, 'pb:deployed-environments'),
                        ...links(version, 'pb:released-environments'),
                      ].map((l, j) => (
                        <span
                          key={j}
                          className="environment-chip"
                          title={string(l.deployed_at || l.released_at, '')}
                        >
                          {l.name || l.title}
                          {l.currently_deployed === false || l.currently_supported === false
                            ? ' · ended'
                            : ''}
                        </span>
                      ))}
                    </span>
                  ) : safeExternalUrl(version.buildUrl) ? (
                    <a
                      className="text-link"
                      href={safeExternalUrl(version.buildUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open build
                      <ExternalLink size={12} />
                    </a>
                  ) : (
                    <span className="muted">Not reported</span>
                  )}
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(selected === version ? undefined : version)}
                  >
                    <FileJson2 size={13} />
                    {selected === version ? 'Hide' : 'Inspect'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!versions.length && (
        <Empty
          title="No versions reported"
          description="Published versions will appear here when the Broker receives them."
        />
      )}
      {selected && (
        <div className="explorer-body">
          <h3>Version {string(selected.number)}</h3>
          <JsonView value={selected} />
        </div>
      )}
    </div>
  );
}
