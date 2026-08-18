import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.handleRetry = this.handleRetry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleRetry() {
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ textAlign: "center", padding: "2rem", maxWidth: 480, margin: "3rem auto" }}>
          <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "var(--clr-text-bright)" }}>
            Something went wrong
          </p>
          <p style={{ color: "var(--clr-text-muted, #64748b)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            {String(this.state.error?.message || this.state.error || "Unexpected error")}
          </p>
          <button type="button" className="btn btn-primary" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
