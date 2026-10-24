import { Component, type ReactNode } from 'react';
import { ErrorState } from './ui/feedback';
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <ErrorState error={this.state.error} retry={() => this.setState({ error: null })} />
    ) : (
      this.props.children
    );
  }
}
