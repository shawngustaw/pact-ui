// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { StatusBadge } from '@/components/ui/status';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
afterEach(cleanup);
describe('accessible UI primitives', () => {
  it('labels all verification states without relying on color', () => {
    render(
      <>
        <StatusBadge status="verified" />
        <StatusBadge status="failed" />
        <StatusBadge status="unknown" />
      </>,
    );
    expect(screen.getByText('Verified')).toBeVisible();
    expect(screen.getByText('Failed')).toBeVisible();
    expect(screen.getByText('Unknown')).toBeVisible();
  });
  it('supports semantic link buttons', () => {
    render(
      <Button asChild>
        <a href="/applications">Applications</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Applications' })).toHaveAttribute(
      'href',
      '/applications',
    );
  });
  it('announces errors and provides recovery', () => {
    render(<ErrorState error={new Error('Broker unavailable')} retry={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Broker unavailable');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
