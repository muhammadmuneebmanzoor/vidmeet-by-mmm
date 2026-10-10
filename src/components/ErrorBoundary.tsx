import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b1020] text-[#e8ecf8] flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#151b30] border border-[#252d47] rounded-2xl p-6 sm:p-8 text-center shadow-2xl space-y-5">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white font-['Bricolage_Grotesque']">
                Something went wrong
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                An unexpected interface error occurred. You can reload the meeting room or return to the dashboard.
              </p>
              {this.state.error && (
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono text-red-300 text-left overflow-x-auto max-h-24">
                  {this.state.error.message || String(this.state.error)}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-xs bg-[var(--primary)] text-white hover:bg-[var(--primary-d)] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Meeting</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="py-2.5 px-4 rounded-xl font-semibold text-xs bg-[#252d47] text-slate-200 hover:text-white hover:bg-[#323c61] transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
