import * as Tabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

/** Radix supplies roving focus, arrow/Home/End keys, and tab/panel associations. */
export function TabView({
  value,
  onValueChange,
  tabs,
  label,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  tabs: [string, ReactNode][];
  label: string;
  children: ReactNode;
}) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <Tabs.List className="detail-tabs" aria-label={label}>
        {tabs.map(([key, title]) => (
          <Tabs.Trigger key={key} value={key} className={value === key ? 'selected' : ''}>
            {title}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content key={value} value={value} className="tab-content">
        {children}
      </Tabs.Content>
    </Tabs.Root>
  );
}
