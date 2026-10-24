import { useState } from 'react';
import Link from '@/components/link';
import { ArrowRight, ShieldCheck, GitBranch, Play } from 'lucide-react';
import { useDirectory, useCollection, useResource } from '@/lib/domain/queries';
import { object, string, compatibilityStatus, verificationStatus } from '@/lib/domain/models';
import { StatusBadge } from './ui/status';
import { Button } from './ui/button';
import { Loading, ErrorState, Empty } from './ui/feedback';
export function Deploy() {
  const { apps } = useDirectory(),
    environments = useCollection('/environments', 'environments');
  const [application, setApplication] = useState(''),
    [version, setVersion] = useState(''),
    [environment, setEnvironment] = useState(''),
    [selectionType, setSelectionType] = useState('version'),
    [branch, setBranch] = useState(''),
    [submitted, setSubmitted] = useState<string>();
  const versions = useCollection(
    application ? `/pacticipants/${encodeURIComponent(application)}/versions` : undefined,
    'versions',
  );
  const branches = useCollection(
    application ? `/pacticipants/${encodeURIComponent(application)}/branches` : undefined,
    'branches',
  );
  const latest = useResource(
    application && branch && selectionType === 'branch'
      ? `/pacticipants/${encodeURIComponent(application)}/branches/${encodeURIComponent(branch)}/latest-version`
      : undefined,
  );
  const result = useResource(submitted),
    summary = object(result.data?.summary);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVersion = selectionType === 'branch' ? string(latest.data?.number, '') : version;
    if (!application || !selectedVersion || !environment) return;
    setSubmitted(
      '/can-i-deploy?' +
        new URLSearchParams({ pacticipant: application, version: selectedVersion, environment }),
    );
  };
  const dirty = () => setSubmitted(undefined);
  const ready =
    application && environment && (selectionType === 'branch' ? latest.data?.number : version);
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Can I deploy?</h1>
          <p>Check a version against the applications in your target environment.</p>
        </div>
        <span className="subtle-label">
          <ShieldCheck size={14} />
          Read-only compatibility check
        </span>
      </div>
      <div className="deploy-layout">
        <form className="deploy-form" onSubmit={onSubmit}>
          <h2>Deployment candidate</h2>
          <label>
            Application
            <select
              aria-label="Application"
              className="input"
              required
              value={application}
              onChange={(e) => {
                setApplication(e.target.value);
                setVersion('');
                setBranch('');
                dirty();
              }}
            >
              <option value="">Select an application</option>
              {apps.data?.map((a) => (
                <option key={a.name}>{a.name}</option>
              ))}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Candidate type">
            <button
              type="button"
              onClick={() => {
                setSelectionType('version');
                dirty();
              }}
              className={selectionType === 'version' ? 'selected' : ''}
            >
              Version
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectionType('branch');
                dirty();
              }}
              className={selectionType === 'branch' ? 'selected' : ''}
            >
              <GitBranch size={12} />
              Latest on branch
            </button>
          </div>
          {selectionType === 'version' ? (
            <label>
              Version
              <select
                aria-label="Version"
                className="input"
                required
                value={version}
                disabled={!application || versions.isPending}
                onChange={(e) => {
                  setVersion(e.target.value);
                  dirty();
                }}
              >
                <option value="">
                  {versions.isPending && application ? 'Loading versions…' : 'Select a version'}
                </option>
                {versions.data?.map((v, i) => (
                  <option key={i} value={string(v.number)}>
                    {string(v.number)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Branch
              <select
                aria-label="Branch"
                className="input"
                required
                value={branch}
                disabled={!application || branches.isPending}
                onChange={(e) => {
                  setBranch(e.target.value);
                  dirty();
                }}
              >
                <option value="">Select a branch</option>
                {branches.data?.map((b, i) => (
                  <option key={i} value={string(b.name)}>
                    {string(b.name)}
                  </option>
                ))}
              </select>
              {branch && (
                <span className="small muted">
                  {latest.data
                    ? `Resolved version: ${string(latest.data.number)}`
                    : 'Resolving latest version…'}
                </span>
              )}
            </label>
          )}
          <div className="form-divider">
            <ArrowRight size={14} />
            <span>Deploy to</span>
          </div>
          <label>
            Target environment
            <select
              aria-label="Target environment"
              className="input"
              required
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                dirty();
              }}
            >
              <option value="">Select an environment</option>
              {environments.data?.map((env, i) => (
                <option key={i} value={string(env.name)}>
                  {string(env.displayName, string(env.name))}
                </option>
              ))}
            </select>
          </label>
          <Button variant="default" type="submit" disabled={!ready || result.isFetching}>
            <Play size={13} />
            {result.isFetching ? 'Checking compatibility…' : 'Check compatibility'}
          </Button>
          <p className="small muted">
            This asks the Broker for a compatibility result. It does not deploy your application.
          </p>
          {apps.error && <ErrorState error={apps.error} />}{' '}
          {versions.error && <ErrorState error={versions.error} />}{' '}
          {branches.error && selectionType === 'branch' && <ErrorState error={branches.error} />}{' '}
          {latest.error && selectionType === 'branch' && <ErrorState error={latest.error} />}{' '}
          {environments.error && <ErrorState error={environments.error} />}
        </form>
        <div className="deploy-result">
          {!submitted ? (
            <div className="deploy-placeholder">
              <ShieldCheck size={34} />
              <h2>Know before you ship.</h2>
              <p>
                Select an application version and environment to see whether its contracts have been
                verified.
              </p>
              <div className="compatibility-legend">
                <StatusBadge status="safe" />
                <span>Confirmed compatible</span>
                <StatusBadge status="blocked" />
                <span>Confirmed incompatibility</span>
                <StatusBadge status="unknown" />
                <span>Missing verification evidence</span>
              </div>
            </div>
          ) : result.isPending ? (
            <Loading label="Checking deployment compatibility…" />
          ) : result.error ? (
            <ErrorState error={result.error} retry={() => void result.refetch()} />
          ) : (
            <>
              <div
                className={`compatibility-result result-${compatibilityStatus(summary.deployable)}`}
              >
                <StatusBadge status={compatibilityStatus(summary.deployable)} />
                <h2>
                  {summary.deployable === true
                    ? 'Your contracts are compatible.'
                    : summary.deployable === false
                      ? 'A verification is blocking this deployment.'
                      : 'Compatibility is not yet known.'}
                </h2>
                <p>{string(summary.reason, 'The Broker did not provide an explanation.')}</p>
              </div>
              <div className="section-heading">
                <h3>Compatibility matrix</h3>
                <div className="small muted">
                  {string(summary.success, '0')} passed · {string(summary.failed, '0')} failed ·{' '}
                  {string(summary.unknown, '0')} unknown
                </div>
              </div>
              <div
                className="table-panel table-scroll"
                role="region"
                aria-label="Deployment compatibility matrix"
                tabIndex={0}
              >
                <table>
                  <thead>
                    <tr>
                      <th>Consumer</th>
                      <th>Provider</th>
                      <th>Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(result.data?.matrix) ? result.data.matrix : []).map(
                      (row, i) => {
                        const r = object(row),
                          c = object(r.consumer),
                          p = object(r.provider),
                          v = object(r.verificationResult);
                        return (
                          <tr key={i}>
                            <td>
                              <Link
                                href={`/applications/${encodeURIComponent(string(c.name, ''))}`}
                              >
                                {string(c.name)}
                              </Link>
                              <small className="block muted">
                                {string(object(c.version).number, 'Version not verified')}
                              </small>
                            </td>
                            <td>
                              <Link
                                href={`/applications/${encodeURIComponent(string(p.name, ''))}`}
                              >
                                {string(p.name)}
                              </Link>
                              <small className="block muted">
                                {string(object(p.version).number, 'Version not verified')}
                              </small>
                            </td>
                            <td>
                              <StatusBadge status={verificationStatus(v.success)} />
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
