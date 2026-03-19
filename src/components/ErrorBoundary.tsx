import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Temporal Self error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <p className="text-text-primary">Something went wrong.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded border border-border bg-surface px-4 py-2 text-text-primary hover:bg-surface-elevated"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
