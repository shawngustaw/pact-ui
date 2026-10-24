import Link from '@/components/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Boxes,
  FileJson2,
  GitBranch,
  ShieldCheck,
  Network,
  Settings2,
  Search,
  Sun,
  Moon,
  ArrowUpRight,
  LockKeyhole,
  ChevronsUpDown,
  PanelLeftClose,
  Menu,
  CircleHelp,
  Layers3,
} from 'lucide-react';
import { useConnection } from './broker-context';
import { Button } from './ui/button';
import { Loading } from './ui/feedback';
import { ConnectionForm } from './connection-form';
const navigation = [
  { href: '/applications', label: 'Applications', icon: Boxes },
  { href: '/contracts', label: 'Contracts', icon: FileJson2 },
  { href: '/verifications', label: 'Verifications', icon: ShieldCheck },
  { href: '/dependencies', label: 'Dependency graph', icon: Network },
  { href: '/deploy', label: 'Can I deploy?', icon: GitBranch },
  { href: '/environments', label: 'Environments', icon: Layers3 },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(),
    router = useRouter(),
    connection = useConnection();
  const [theme, setTheme] = useState('light'),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const saved =
      localStorage.getItem('pact-theme') ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        router.push('/applications?search=1');
        window.dispatchEvent(new Event('pact-search'));
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router]);
  const toggle = () => {
    const value = theme === 'light' ? 'dark' : 'light';
    setTheme(value);
    document.documentElement.dataset.theme = value;
    localStorage.setItem('pact-theme', value);
  };
  const current = navigation.find((n) => pathname.startsWith(n.href));
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
        <Link className="brand" href="/applications">
          <span className="brand-symbol">
            <Network size={20} />
          </span>
          <span>
            pact<span className="brand-light"> / broker</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">
            <Boxes size={16} />
          </span>
          <span>
            <strong>{connection.mode === 'demo' ? 'Example workspace' : 'Broker workspace'}</strong>
            <small>
              {connection.mode === 'demo' ? 'Captured OSS Broker data' : 'Self-hosted Pact Broker'}
            </small>
          </span>
          <ChevronsUpDown size={13} />
        </div>
        <button
          className="search-launch"
          onClick={() => {
            router.push('/applications?search=1');
            window.dispatchEvent(new Event('pact-search'));
          }}
        >
          <Search size={15} />
          <span>Search applications</span>
          <kbd>⌘ K</kbd>
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setMenu(false)}
              className={`nav-item ${pathname.startsWith(n.href) ? 'active' : ''}`}
              aria-current={pathname.startsWith(n.href) ? 'page' : undefined}
            >
              <n.icon size={17} />
              <span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="read-only">
            <LockKeyhole size={14} />
            <span>Read-only workspace</span>
          </div>
          <Link href="/settings" className={`nav-item ${pathname === '/settings' ? 'active' : ''}`}>
            <Settings2 size={17} />
            Connection settings
          </Link>
          <a
            className="nav-item"
            href="https://docs.pact.io/pact_broker"
            target="_blank"
            rel="noreferrer"
          >
            <CircleHelp size={17} />
            Documentation
            <ArrowUpRight size={13} className="push-right" />
          </a>
          <div className="sidebar-footer">
            <span className="avatar">PB</span>
            <span>
              Open-source edition<small>Pact UI · MIT license</small>
            </span>
            <button
              className="icon-button"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <Button
            size="icon"
            variant="ghost"
            className="mobile-menu"
            onClick={() => setMenu(!menu)}
            aria-label="Toggle navigation"
          >
            {menu ? <PanelLeftClose size={18} /> : <Menu size={18} />}
          </Button>
          <span className="breadcrumb">
            Workspace <span>/</span> <strong>{current?.label || 'Connection settings'}</strong>
            {pathname.startsWith('/applications/') && (
              <>
                <span>/</span>
                <strong>{decodeURIComponent(pathname.split('/').at(-1) || '')}</strong>
              </>
            )}
          </span>
          <div className="topbar-right">
            <span className={`connection-dot ${connection.baseUrl ? 'online' : ''}`} />
            <span>
              {connection.mode === 'demo'
                ? 'Demo data'
                : connection.mode === 'live'
                  ? 'Broker configured'
                  : 'Not connected'}
            </span>
            <span className="topbar-divider" />
            <span className="oss-tag">OSS</span>
          </div>
        </header>
        {connection.mode === 'demo' && (
          <div className="demo-banner">
            <span>Demo workspace</span>Example applications · responses captured from an OSS Pact
            Broker
            <Link href="/settings">
              Connect your Broker <ArrowUpRight size={12} />
            </Link>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          {connection.mode === 'loading' ? (
            <Loading label="Loading workspace configuration…" />
          ) : (connection.mode === 'unconfigured' || connection.mode === 'invalid') &&
            pathname !== '/settings' ? (
            <Setup />
          ) : (
            children
          )}
        </main>
        <footer className="main-footer">
          <span>
            <Network size={12} /> Powered by the open-source Pact Broker API
          </span>
          <span>Read-only · Broker proxy connection</span>
        </footer>
      </div>
    </div>
  );
}
function Setup() {
  return (
    <div className="setup">
      <span className="setup-icon">
        <Network size={30} />
      </span>
      <h1>Your contracts, a clearer view.</h1>
      <p>
        Connect your existing Pact Broker to explore applications, inspect contracts, and check
        deployment compatibility.
      </p>
      <div className="setup-instructions">
        <ConnectionForm />
      </div>
      <p className="muted small">Connect using your existing Broker credentials.</p>
    </div>
  );
}
