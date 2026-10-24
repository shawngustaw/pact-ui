import { useConnection } from '@/components/broker-context';
import { ConnectionForm } from '@/components/connection-form';
import { LockKeyhole, ExternalLink } from 'lucide-react';
export default function Settings() {
  const connection = useConnection();
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <div>
          <h1>Connection settings</h1>
          <p>This app forwards requests to your existing Pact Broker through its server.</p>
        </div>
      </div>
      <section className="settings-section">
        <ConnectionForm />
      </section>
      <section className="settings-section">
        <h2>
          <LockKeyhole size={16} />
          Current connection
        </h2>
        <dl className="settings-list">
          <div>
            <dt>Broker URL</dt>
            <dd>
              <code>{connection.baseUrl || 'Not configured'}</code>
            </dd>
          </div>
          <div>
            <dt>Authentication</dt>
            <dd>
              {connection.mode === 'demo'
                ? 'Demo data'
                : connection.auth?.type === 'basic'
                  ? 'Basic · credentials in memory'
                  : connection.auth?.type === 'bearer'
                    ? 'Bearer · token in memory'
                    : 'No authentication'}
            </dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>Read-only workspace</dd>
          </div>
        </dl>
      </section>
      <section className="settings-section">
        <h2>Deployment defaults</h2>
        <p>
          Set <code>PACT_BROKER_URL</code> when starting the app or Docker container. It supplies
          the default Broker URL and allows the proxy to connect to it.
        </p>
        <pre className="config-code">{'PACT_BROKER_URL=https://broker.example.com'}</pre>
        <p className="small muted">
          To allow additional Brokers, set <code>PACT_BROKER_ALLOWED_URLS</code> to a
          comma-separated list of their full URLs, including any base paths. Browser settings can
          select an allowed URL. Each user enters their own credentials; passwords and tokens stay
          in memory. Broker-side CORS configuration is unnecessary.
        </p>
      </section>
      <section className="settings-section">
        <h2>API provenance</h2>
        <p>
          OpenAPI 3.1 and TypeScript definitions are generated from Pact Broker source, validation
          contracts, and request-test responses. Fields without sufficient evidence remain unknown.
        </p>
        <p>
          <code>e27e1135f7398cd05ac8bbad9698eae15f9c4d0a</code>
        </p>
        <a
          className="text-link"
          href="https://github.com/pact-foundation/pact_broker/tree/e27e1135f7398cd05ac8bbad9698eae15f9c4d0a"
          target="_blank"
          rel="noreferrer"
        >
          View pinned upstream source
          <ExternalLink size={12} />
        </a>
      </section>
    </div>
  );
}
