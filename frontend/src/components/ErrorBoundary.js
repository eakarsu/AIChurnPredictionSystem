import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconContainer}>
              <span style={styles.icon}>!</span>
            </div>
            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.subtitle}>
              An unexpected error occurred. Please try again or contact support.
            </p>
            {this.state.error && (
              <div style={styles.errorDetails}>
                <div style={styles.errorMessage}>{this.state.error.toString()}</div>
                {this.state.errorInfo?.componentStack && (
                  <pre style={styles.stackTrace}>{this.state.errorInfo.componentStack}</pre>
                )}
              </div>
            )}
            <button className="btn btn-primary" onClick={this.handleReset}>Try Again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' },
  card: { background: '#1a1a2e', border: '1px solid #ef4444', borderRadius: '16px', padding: '48px', maxWidth: '560px', width: '100%', textAlign: 'center' },
  iconContainer: { width: '64px', height: '64px', borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' },
  icon: { fontSize: '32px', fontWeight: '700', color: '#fff' },
  title: { fontSize: '24px', fontWeight: '700', color: '#fff', margin: '0 0 12px' },
  subtitle: { fontSize: '14px', color: '#9ca3af', margin: '0 0 24px' },
  errorDetails: { background: '#0f0f1a', border: '1px solid #2d2d4a', borderRadius: '12px', padding: '16px', marginBottom: '24px', textAlign: 'left' },
  errorMessage: { fontSize: '13px', fontWeight: '600', color: '#ef4444', marginBottom: '12px', wordBreak: 'break-word' },
  stackTrace: { fontSize: '11px', color: '#9ca3af', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflowY: 'auto' },
};

export default ErrorBoundary;
