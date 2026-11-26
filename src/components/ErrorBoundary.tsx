import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
  isPermissionError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isQuotaError: false,
      isPermissionError: false
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'Terjadi kesalahan tidak terduga.';
    let parsedMessage = raw;
    try {
      const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
      if (parsed && typeof parsed.error === 'string') {
        parsedMessage = parsed.error;
      }
    } catch {
      // keep raw message
    }

    const lower = parsedMessage.toLowerCase();
    const isQuotaError =
      lower.includes('quota exceeded') || lower.includes('resource-exhausted');
    const isPermissionError =
      lower.includes('permission') || lower.includes('missing or insufficient permissions');

    return {
      hasError: true,
      message: parsedMessage,
      isQuotaError,
      isPermissionError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    this.setState({
      hasError: false,
      message: '',
      isQuotaError: false,
      isPermissionError: false
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-slate-900">
                {this.state.isQuotaError
                  ? 'Batas Kuota Sinkronisasi Tercapai'
                  : this.state.isPermissionError
                    ? 'Akses Sinkronisasi Memerlukan Autentikasi'
                    : 'Terjadi Gangguan pada Aplikasi'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {this.state.isQuotaError
                  ? 'Kuota harian database cloud sedang penuh. Silakan coba kembali beberapa saat lagi atau gunakan ekspor berkas JSON.'
                  : this.state.isPermissionError
                    ? 'Pastikan Anda telah masuk menggunakan akun Google yang terverifikasi agar data dapat disinkronkan secara aman.'
                    : 'Aplikasi mengalami kendala saat memproses sinkronisasi data. Silakan muat ulang halaman untuk melanjutkan.'}
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition w-full"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
