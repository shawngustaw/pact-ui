import { CheckCircle2, CircleDashed, XCircle, ShieldCheck } from 'lucide-react';
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const success = status === 'verified' || status === 'safe';
  const failed = status === 'failed' || status === 'blocked';
  const Icon = success
    ? status === 'safe'
      ? ShieldCheck
      : CheckCircle2
    : failed
      ? XCircle
      : CircleDashed;
  return (
    <span
      className={`status ${success ? 'status-success' : failed ? 'status-failed' : 'status-unknown'}`}
    >
      <Icon size={13} />
      {label ||
        (status === 'safe'
          ? 'Safe to deploy'
          : status === 'blocked'
            ? 'Blocked'
            : status.charAt(0).toUpperCase() + status.slice(1))}
    </span>
  );
}
