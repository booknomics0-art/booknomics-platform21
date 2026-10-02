import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React render errors so one broken component doesn't blank the entire page.
 * Shows a friendly retry UI instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  private isChunkLoadError(error: Error | null) {
    const message = error?.message ?? "";
    return /dynamically imported module|failed to fetch.*module|chunkloaderror|loading chunk/i.test(message);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);

    // A visitor or crawler can briefly hold an older Vite app shell after a
    // deploy and request a content-hashed lazy chunk that no longer exists.
    // Reload once to pick up the current asset manifest, then surface the
    // normal error UI if the second attempt still fails.
    if (typeof window !== "undefined" && this.isChunkLoadError(error)) {
      const key = `booknomics:chunk-retry:${window.location.pathname}`;
      if (!window.sessionStorage.getItem(key)) {
        window.sessionStorage.setItem(key, "1");
        window.location.reload();
      } else {
        window.sessionStorage.removeItem(key);
      }
    }
  }

  handleRetry = () => {
    if (typeof window !== "undefined" && this.isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="text-4xl">📚</div>
            <h1 className="font-serif text-2xl font-bold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We hit an unexpected error while loading this page. It can happen after a fresh
              deployment or when the database/network is temporarily unavailable. Please try again.
            </p>
            {this.state.error && (
              <details className="text-left text-xs text-muted-foreground bg-muted rounded-lg p-3">
                <summary className="cursor-pointer font-medium mb-1">Technical details</summary>
                <pre className="whitespace-pre-wrap break-all">{this.state.error.message}</pre>
              </details>
            )}
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
