import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home, Wrench, ShieldCheck } from 'lucide-react';
import { storageService } from '../../services/storage';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
  repairedMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorCount: 0,
    repairedMessage: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LIFORA ErrorBoundary Caught]:', error, errorInfo);
    this.setState((prev) => ({ errorCount: prev.errorCount + 1 }));
    // Automatically sanitize and repair stored state so corrupted fields are immediately purged
    try {
      storageService.repairVaultState();
    } catch (e) {
      console.warn('Auto-repair failed:', e);
    }
  }

  private handleClearError = () => {
    try {
      // 1. Fully repair and sanitize any corrupted localStorage or state
      storageService.repairVaultState();
      // 2. Clear hash and parameters
      if (typeof window !== 'undefined') {
        window.location.hash = '';
      }
    } catch (e) {
      console.warn('Repair error on clear:', e);
    }

    this.setState({
      hasError: false,
      error: null,
      repairedMessage: 'Vault repaired successfully / பிழை சரிசெய்யப்பட்டது',
    });
  };

  private handleDeepAutoRepair = () => {
    try {
      storageService.repairVaultState();
      this.setState({ hasError: false, error: null, errorCount: 0 });
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  private handleSafeReset = () => {
    try {
      storageService.safeEmergencyReset();
    } catch (e) {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorCount: 0 });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isRepeated = this.state.errorCount > 1;

      return (
        <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white text-stone-900 border border-stone-200 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider mb-2 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Auto-Protection Active</span>
              </div>
              <h2 className="text-base font-bold text-stone-900">
                {isRepeated ? 'Strong Safety Mode Activated' : 'Temporary Interface Glitch Prevented'}
              </h2>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                {isRepeated
                  ? 'To stop this error from repeating, your vault data structure has been verified and reinforced.'
                  : 'An unexpected field format was intercepted and automatically guarded. Tap below to clear and resume safely.'}
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2 rounded-xl bg-stone-50 border border-stone-200 text-[10px] text-stone-600 font-mono text-left max-h-16 overflow-y-auto break-words">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={this.handleClearError}
                className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear the Error & Resume (சரிசெய்)</span>
              </button>

              <button
                onClick={this.handleDeepAutoRepair}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-stone-600" />
                <span>Reinforce & Reload (வலுவான மீட்டல்)</span>
              </button>

              {isRepeated && (
                <button
                  onClick={this.handleSafeReset}
                  className="w-full py-2 px-3 rounded-lg text-rose-600 hover:bg-rose-50 font-medium text-[11px] transition-all cursor-pointer"
                >
                  Safe Reset to Clean Vault (பாதுகாப்பான தொடக்கம்)
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
