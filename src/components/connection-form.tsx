import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, PlugZap } from 'lucide-react';
import { useConnection, useConnectionActions } from './broker-context';
import { Button } from './ui/button';
import type { BrokerAuth } from '@/lib/api/client';
import { safeExternalUrl } from '@/lib/domain/models';

export function ConnectionForm() {
  const connection = useConnection(),
    actions = useConnectionActions(),
    router = useRouter();
  const [url, setUrl] = useState(connection.mode === 'live' ? connection.baseUrl || '' : ''),
    [mode, setMode] = useState<'anonymous' | 'basic' | 'bearer'>(connection.auth?.type || 'basic');
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [token, setToken] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const auth: BrokerAuth | undefined =
        mode === 'basic'
          ? { type: 'basic', username, password }
          : mode === 'bearer'
            ? { type: 'bearer', token }
            : undefined;
      await actions.connect(url, auth);
      router.push('/applications');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not connect to the Broker.');
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setPassword('');
    setToken('');
    setUsername('');
    await actions.disconnect();
  };
  return (
    <form className="connection-form" onSubmit={submit}>
      <h2>Connect your Broker</h2>
      <p>Use your existing Broker credentials. Requests pass through this app’s server.</p>
      {connection.configurationError && (
        <p className="inline-warning" role="alert">
          {connection.configurationError}
        </p>
      )}
      <label>
        Broker URL
        <input
          className="input"
          aria-label="Broker URL"
          type="url"
          placeholder="https://broker.example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
          autoComplete="url"
        />
      </label>
      <label>
        Authentication
        <select
          className="input"
          aria-label="Authentication"
          value={mode}
          onChange={(event) => {
            setMode(event.target.value as typeof mode);
            setPassword('');
            setToken('');
            setError('');
          }}
        >
          <option value="anonymous">No authentication</option>
          <option value="basic">Basic authentication</option>
          <option value="bearer">Bearer token</option>
        </select>
      </label>
      {mode === 'anonymous' && (
        <p className="small muted">
          For Brokers that allow anonymous reads. Basic authentication uses your existing Broker
          username and password.
        </p>
      )}
      {mode === 'basic' && (
        <>
          <label>
            Username
            <input
              className="input"
              aria-label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label>
            Password
            <input
              className="input"
              aria-label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
        </>
      )}
      {mode === 'bearer' && (
        <label>
          Token
          <input
            className="input"
            aria-label="Token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
      )}
      <p className="small muted">
        The Broker URL is saved in this browser. Passwords and tokens stay in memory and must be
        entered again after a reload.
      </p>
      {error && (
        <p role="alert" className="connection-error">
          {error}
        </p>
      )}
      <div className="connection-actions">
        <Button type="submit" variant="default" disabled={busy}>
          <PlugZap size={14} />
          {busy ? 'Connecting…' : 'Connect'}
        </Button>
        {safeExternalUrl(url) && (
          <Button asChild>
            <a href={safeExternalUrl(url)} target="_blank" rel="noreferrer">
              Open Broker
              <ExternalLink size={12} />
            </a>
          </Button>
        )}
        {connection.mode === 'live' && (
          <Button type="button" disabled={busy} onClick={() => void reset()}>
            Disconnect
          </Button>
        )}
      </div>
      <div className="connection-demo">
        <span className="small muted">Explore without a Broker</span>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            await actions.demo();
            router.push('/applications');
          }}
        >
          Use demo data
        </Button>
      </div>
    </form>
  );
}
