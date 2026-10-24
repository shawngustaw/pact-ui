import Link from '@/components/link';
import { useState } from 'react';
import { Layers3, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { useCollection } from '@/lib/domain/queries';
import { embedded, link, type HalResource } from '@/lib/api/hal';
import { string, date } from '@/lib/domain/models';
import { Loading, ErrorState, Empty } from './ui/feedback';
export function Environments() {
  const environments = useCollection('/environments', 'environments'),
    [selected, setSelected] = useState<string>();
  const active =
    environments.data?.find((e) => string(e.uuid) === selected) || environments.data?.[0];
  const deployed = useCollection(
    active ? link(active, 'pb:currently-deployed-deployed-versions') : undefined,
    'deployedVersions',
  );
  const released = useCollection(
    active ? link(active, 'pb:currently-supported-released-versions') : undefined,
    'releasedVersions',
  );
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Environments</h1>
          <p>See which versions are deployed and which releases are currently supported.</p>
        </div>
      </div>
      {environments.isPending ? (
        <Loading />
      ) : environments.error ? (
        <ErrorState error={environments.error} retry={() => void environments.refetch()} />
      ) : !environments.data?.length ? (
        <Empty
          title="No environments configured"
          description="Create environments using your Pact Broker or Pact CLI."
        />
      ) : (
        <>
          <div className="environment-tabs" role="group" aria-label="Environment">
            {environments.data.map((env, i) => (
              <button
                type="button"
                aria-pressed={env === active}
                key={i}
                onClick={() => setSelected(string(env.uuid))}
                className={env === active ? 'selected' : ''}
              >
                <Layers3 size={16} />
                {string(env.displayName, string(env.name))}
                {env.production === true && <ShieldCheck size={14} />}
              </button>
            ))}
          </div>
          <div className="section-heading">
            <h2>Currently deployed</h2>
            <span className="subtle-label">
              {string(active?.displayName, string(active?.name))}
            </span>
          </div>
          {deployed.isPending ? (
            <Loading />
          ) : deployed.error ? (
            <ErrorState error={deployed.error} />
          ) : (
            <DeploymentTable records={deployed.data || []} />
          )}
          <div className="section-heading section-space">
            <h2>Supported releases</h2>
          </div>
          {released.isPending ? (
            <Loading />
          ) : released.error ? (
            <ErrorState error={released.error} />
          ) : (
            <DeploymentTable records={released.data || []} release />
          )}
        </>
      )}
    </div>
  );
}
function DeploymentTable({
  records,
  release = false,
}: {
  records: HalResource[];
  release?: boolean;
}) {
  return (
    <div className="table-panel">
      <div
        className="table-scroll"
        role="region"
        aria-label={release ? 'Supported releases' : 'Current deployments'}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Application</th>
              <th>Version</th>
              <th>{release ? 'Released' : 'Deployed'}</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, i) => {
              const app = embedded(record, 'pacticipant')[0],
                version = embedded(record, 'version')[0];
              return (
                <tr key={i}>
                  <td>
                    <Link
                      className="text-link strong"
                      href={`/applications/${encodeURIComponent(string(app?.name, ''))}`}
                    >
                      {string(app?.name)}
                      <ArrowUpRight size={12} />
                    </Link>
                  </td>
                  <td>
                    <code>{string(version?.number)}</code>
                  </td>
                  <td className="muted">{date(record.createdAt)}</td>
                  <td>
                    <span className="environment-chip">
                      {release ? 'Supported' : 'Currently deployed'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!records.length && (
        <Empty
          title={release ? 'No supported releases' : 'No current deployments'}
          description="The Broker has no matching environment records."
        />
      )}
    </div>
  );
}
