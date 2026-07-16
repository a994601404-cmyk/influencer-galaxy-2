import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  name: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary: ${this.props.name}]`, error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "#EF4444", background: "#1a0505", borderRadius: 8, margin: 10 }}>
          <h3 style={{ margin: "0 0 8px" }}>Error in {this.props.name}</h3>
          <pre style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
            {this.state.error?.message}\n{this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
