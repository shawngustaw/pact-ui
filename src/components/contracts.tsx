import Link from '@/components/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  FileJson2,
  Search,
  ExternalLink,
  History,
  ChevronDown,
  Check,
  Copy,
  X,
} from 'lucide-react';
import { useDirectory, useResource } from '@/lib/domain/queries';
import {
  contractHref,
  object,
  string,
  date,
  verificationStatus,
  safeExternalUrl,
  diffJson,
  type ContractSummary,
} from '@/lib/domain/models';
import { link } from '@/lib/api/hal';
import { Button } from './ui/button';
import { TabView } from './ui/tab-view';
import { StatusBadge } from './ui/status';
import { Loading, ErrorState, Empty } from './ui/feedback';

export function Contracts({
  application,
  verificationMode = false,
}: {
  application?: string;
  verificationMode?: boolean;
}) {
  const { contracts } = useDirectory();
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<ContractSummary>();
  const items = (contracts.data || []).filter(
    (c) =>
      (!application || c.consumer.name === application || c.provider.name === application) &&
      `${c.consumer.name} ${c.provider.name}`.toLowerCase().includes(search.toLowerCase()) &&
      (status === 'all' || verificationStatus(c.latestVerificationResult?.success) === status),
  );
  return (
    <div className={application ? '' : 'page'}>
      {!application && (
        <div className="page-heading">
          <div>
            <h1>{verificationMode ? 'Verifications' : 'Contracts'}</h1>
            <p>
              {verificationMode
                ? 'Understand which contracts passed, failed, or still need verification.'
                : 'Explore the agreements between your consumers and providers.'}
            </p>
          </div>
          <span className="subtle-label">Broker dashboard snapshot</span>
        </div>
      )}
      <div className="table-panel">
        <div className="table-toolbar">
          <label className="search-field">
            <Search size={15} />
            <input
              placeholder="Search consumers or providers…"
              aria-label="Search contracts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="select"
            aria-label="Filter contract status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="verified">Verified</option>
            <option value="failed">Failed</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        {contracts.isPending ? (
          <Loading />
        ) : contracts.error ? (
          <ErrorState error={contracts.error} retry={() => void contracts.refetch()} />
        ) : (
          <>
            <div
              className="table-scroll"
              role="region"
              aria-label="Contract publications"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Consumer → provider</th>
                    <th>Consumer version</th>
                    <th>Provider version</th>
                    <th>Verification</th>
                    <th>Last verified</th>
                    <th>
                      <span className="sr-only">Inspect</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={`${contractHref(item)}-${index}`}>
                      <td>
                        <button className="contract-name" onClick={() => setSelected(item)}>
                          <span className="contract-icon">
                            <FileJson2 size={16} />
                          </span>
                          <span>
                            <strong>{item.consumer.name}</strong>
                            <span className="contract-provider">
                              <ArrowRight size={12} />
                              {item.provider.name}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td>
                        <code>{string(object(item.consumer.version).number)}</code>
                      </td>
                      <td>
                        <code>{string(object(item.provider.version).number)}</code>
                      </td>
                      <td>
                        <StatusBadge
                          status={verificationStatus(item.latestVerificationResult?.success)}
                        />
                      </td>
                      <td className="muted">{date(item.latestVerificationResult?.verifiedAt)}</td>
                      <td>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(item)}>
                          {verificationMode ? 'Inspect result' : 'Explore'}
                          <ArrowRight size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!items.length && <Empty title="No matching contracts" />}
            <div className="table-footer">
              <span>{items.length} contract publications</span>
              <span>Includes branch and environment versions reported by the Broker</span>
            </div>
          </>
        )}
      </div>
      {selected && (
        <ContractExplorer
          item={selected}
          onClose={() => setSelected(undefined)}
          initialTab={verificationMode ? 'verification' : 'interactions'}
        />
      )}
    </div>
  );
}
export function ContractExplorer({
  item,
  onClose,
  initialTab = 'interactions',
}: {
  item: ContractSummary;
  onClose: () => void;
  initialTab?: string;
}) {
  const pact = useResource(contractHref(item)),
    [tab, setTab] = useState(initialTab),
    [search, setSearch] = useState(''),
    [index, setIndex] = useState(0);
  const history = useResource(
    item.latestVerificationResult ? link(item.latestVerificationResult, 'self') : undefined,
  );
  const matrix = useResource(
    tab === 'verification'
      ? `/matrix/provider/${encodeURIComponent(item.provider.name)}/consumer/${encodeURIComponent(item.consumer.name)}`
      : undefined,
  );
  const region = useRef<HTMLElement>(null);
  useEffect(() => {
    region.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
    region.current?.focus({ preventScroll: true });
  }, []);
  const [compareVersion, setCompareVersion] = useState('');
  const comparePath = compareVersion
    ? `/pacts/provider/${encodeURIComponent(item.provider.name)}/consumer/${encodeURIComponent(item.consumer.name)}/version/${encodeURIComponent(compareVersion)}`
    : undefined;
  const comparison = useResource(comparePath);
  const interactions = Array.isArray(pact.data?.interactions)
    ? pact.data.interactions
    : Array.isArray(pact.data?.messages)
      ? pact.data.messages
      : [];
  const filtered = interactions
    .map((value, original) => ({ data: object(value), original }))
    .filter(
      ({ data }) =>
        string(data.description, '').toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(data).toLowerCase().includes(search.toLowerCase()),
    );
  const current = object(interactions[index]);
  const differences = useMemo(
    () =>
      comparison.data && pact.data
        ? diffJson(comparison.data, pact.data).filter(
            (c) => !c.path.startsWith('$._links') && !c.path.startsWith('$._embedded'),
          )
        : [],
    [comparison.data, pact.data],
  );
  // A large inspector gets its own full-width region; no focus trap or hidden modal state.
  return (
    <section ref={region} tabIndex={-1} className="explorer" aria-label="Contract explorer">
      <div className="explorer-heading">
        <div>
          <h2>
            {item.consumer.name}
            <ArrowRight size={17} />
            {item.provider.name}
          </h2>
          <span className="small muted">
            Consumer {string(object(item.consumer.version).number)} · Provider{' '}
            {string(object(item.provider.version).number)}
          </span>
        </div>
        <div className="heading-actions">
          <StatusBadge status={verificationStatus(item.latestVerificationResult?.success)} />
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            aria-label="Close contract explorer"
          >
            <X size={18} />
          </Button>
        </div>
      </div>
      <TabView
        value={tab}
        onValueChange={setTab}
        label="Contract view"
        tabs={[
          ['interactions', 'Interactions'],
          ['json', 'Contract JSON'],
          ['diff', 'Compare versions'],
          ['verification', 'Verification'],
        ]}
      >
        {pact.isPending ? (
          <Loading label="Loading contract…" />
        ) : pact.error ? (
          <ErrorState error={pact.error} retry={() => void pact.refetch()} />
        ) : (
          <>
            {tab === 'interactions' && (
              <div className="interaction-layout">
                <aside className="interaction-list">
                  <label className="search-field">
                    <Search size={14} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Find an interaction…"
                      aria-label="Search interactions"
                    />
                  </label>
                  <div className="section-caption">{filtered.length} INTERACTIONS</div>
                  {filtered.map(({ data, original }) => (
                    <button
                      key={original}
                      className={`interaction-item ${index === original ? 'selected' : ''}`}
                      onClick={() => setIndex(original)}
                    >
                      <span className="method">
                        {string(object(data.request).method, data.contents ? 'MSG' : 'HTTP')}
                      </span>
                      <strong>{string(data.description)}</strong>
                      <small>{string(object(data.request).path, 'Message interaction')}</small>
                    </button>
                  ))}
                  {!filtered.length && <Empty title="No matching interactions" />}
                </aside>
                <div className="interaction-content">
                  {interactions.length ? (
                    <>
                      <h3>{string(current.description)}</h3>
                      {Array.isArray(current.providerStates) && (
                        <div className="provider-states">
                          Given{' '}
                          {current.providerStates.map((s) => string(object(s).name)).join(', ')}
                        </div>
                      )}
                      <div className="request-line">
                        <span className="method">
                          {string(
                            object(current.request).method,
                            current.contents ? 'MESSAGE' : 'HTTP',
                          )}
                        </span>
                        <code>{string(object(current.request).path, 'Asynchronous message')}</code>
                        {object(current.response).status != null && (
                          <span className="http-status">
                            {string(object(current.response).status)}
                          </span>
                        )}
                      </div>
                      {current.request !== undefined && (
                        <>
                          <h4>Request</h4>
                          <JsonView value={current.request} />
                        </>
                      )}
                      {current.response !== undefined && (
                        <>
                          <h4>Response</h4>
                          <JsonView value={current.response} />
                        </>
                      )}
                      {current.contents !== undefined && (
                        <>
                          <h4>Message contents</h4>
                          <JsonView value={current.contents} />
                        </>
                      )}
                    </>
                  ) : (
                    <Empty
                      title="No interactions in this contract"
                      description="The full contract is available in Contract JSON."
                    />
                  )}
                </div>
              </div>
            )}
            {tab === 'json' && (
              <div className="explorer-body">
                <JsonView value={pact.data} />
              </div>
            )}
            {tab === 'diff' && (
              <div className="explorer-body">
                <h3>Compare with another consumer version</h3>
                <p className="muted small">
                  Shows structural JSON changes in the contract. Broker HAL metadata is excluded.
                </p>
                <form
                  className="compare-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const value = new FormData(e.currentTarget).get('version');
                    setCompareVersion(String(value || ''));
                  }}
                >
                  <input
                    name="version"
                    required
                    className="input"
                    placeholder="Consumer version, e.g. 2.7.0"
                    aria-label="Comparison consumer version"
                  />
                  <Button type="submit">
                    <History size={14} />
                    Compare
                  </Button>
                </form>
                {comparison.isFetching ? (
                  <Loading />
                ) : comparison.error ? (
                  <ErrorState error={comparison.error} />
                ) : comparison.data ? (
                  <>
                    <p className="small muted">
                      {differences.length} changed JSON paths · {compareVersion} →{' '}
                      {string(object(item.consumer.version).number)}
                    </p>
                    {differences.length ? (
                      differences.map((change, i) => (
                        <div className="diff-change" key={i}>
                          <code>{change.path}</code>
                          {change.kind !== 'added' && (
                            <pre className="diff-removed">
                              − {JSON.stringify(change.before, null, 2)}
                            </pre>
                          )}
                          {change.kind !== 'removed' && (
                            <pre className="diff-added">
                              + {JSON.stringify(change.after, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="No contract changes"
                        description="The selected versions contain the same contract content."
                      />
                    )}
                  </>
                ) : (
                  <p className="muted">Enter a published version to compare its contract.</p>
                )}
              </div>
            )}
            {tab === 'verification' && (
              <div className="explorer-body">
                <div className="section-heading">
                  <h3>Latest verification for this publication</h3>
                  <StatusBadge
                    status={verificationStatus(item.latestVerificationResult?.success)}
                  />
                </div>
                <p className="muted">
                  {item.latestVerificationResult?.success === false
                    ? 'The provider did not verify this contract successfully.'
                    : item.latestVerificationResult?.success === true
                      ? 'The provider successfully verified this contract.'
                      : 'The Broker has not reported a verification result for this publication.'}
                </p>
                <p className="small muted">
                  Interaction-level failure messages are not assumed to be available in the OSS
                  Broker. Follow the CI build for test output.
                </p>
                {history.isPending && item.latestVerificationResult ? (
                  <Loading />
                ) : history.error ? (
                  <ErrorState error={history.error} />
                ) : history.data ? (
                  <>
                    <dl className="metadata-grid">
                      <div>
                        <dt>Provider version</dt>
                        <dd>
                          <code>{string(history.data.providerApplicationVersion)}</code>
                        </dd>
                      </div>
                      <div>
                        <dt>Verified</dt>
                        <dd>{date(history.data.verificationDate)}</dd>
                      </div>
                      <div>
                        <dt>CI build</dt>
                        <dd>
                          {safeExternalUrl(history.data.buildUrl) ? (
                            <a
                              className="text-link"
                              href={safeExternalUrl(history.data.buildUrl)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open build <ExternalLink size={12} />
                            </a>
                          ) : (
                            'Not reported'
                          )}
                        </dd>
                      </div>
                    </dl>
                    <details>
                      <summary>Verification response</summary>
                      <JsonView value={history.data} />
                    </details>
                  </>
                ) : null}
                <div className="section-heading section-space">
                  <h3>Verification history</h3>
                  <span className="small muted">Up to 100 matrix rows reported by the Broker</span>
                </div>
                {matrix.isPending ? (
                  <Loading />
                ) : matrix.error ? (
                  <ErrorState error={matrix.error} />
                ) : (
                  <div
                    className="table-panel table-scroll"
                    role="region"
                    aria-label="Verification history"
                    tabIndex={0}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Consumer version</th>
                          <th>Provider version</th>
                          <th>Branch</th>
                          <th>Result</th>
                          <th>Verified</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(Array.isArray(matrix.data?.matrix) ? matrix.data.matrix : []).map(
                          (row, i) => {
                            const r = object(row),
                              c = object(object(r.consumer).version),
                              p = object(object(r.provider).version),
                              v = object(r.verificationResult);
                            return (
                              <tr key={i}>
                                <td>
                                  <code>{string(c.number)}</code>
                                </td>
                                <td>
                                  <code>{string(p.number)}</code>
                                </td>
                                <td className="branch">{string(p.branch)}</td>
                                <td>
                                  <StatusBadge status={verificationStatus(v.success)} />
                                </td>
                                <td className="muted">{date(v.verifiedAt)}</td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <Link
                  className="text-link section-space"
                  href={`/applications/${encodeURIComponent(item.provider.name)}`}
                >
                  View provider application <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </>
        )}
      </TabView>
    </section>
  );
}
export function JsonView({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2) || 'null';
  const parts = text.split(
    /("(?:\\.|[^"\\])*"\s*:|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|\b-?\d+(?:\.\d+)?\b)/g,
  );
  return (
    <div className="json-view">
      <div className="json-toolbar">
        <span>JSON</span>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Copy JSON"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <pre tabIndex={0} aria-label="JSON content">
        <code>
          {parts.map((part, i) => (
            <span
              key={i}
              className={
                /^".*":$/.test(part.trim())
                  ? 'json-key'
                  : part.startsWith('"')
                    ? 'json-string'
                    : /^(true|false|null)$/.test(part)
                      ? 'json-literal'
                      : /^-?\d/.test(part)
                        ? 'json-number'
                        : ''
              }
            >
              {part}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
