import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { errorStatus } from './services/api';
import { initBackend } from './services/backend';
import './index.css';

function ThemedToaster() {
  const { isDark } = useTheme();
  return <Toaster position="top-right" richColors closeButton theme={isDark ? 'dark' : 'light'} />;
}

function StartupError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center dark:bg-slate-950">
      <div className="max-w-md">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Finora could not start</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
        <button
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);

initBackend()
  .then((kind) => {
    const offline = kind !== 'web';
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: true,
          // Installed apps read local SQLite, so queries must run even with no network
          networkMode: offline ? 'always' : 'online',
          // Don't retry client errors such as 401/404
          retry: (count, error) => ((errorStatus(error) ?? 500) >= 500 && !offline ? count < 2 : false),
        },
        mutations: { networkMode: offline ? 'always' : 'online' },
      },
    });

    root.render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <BrowserRouter>
              <AuthProvider>
                <App />
              </AuthProvider>
            </BrowserRouter>
            <ThemedToaster />
          </ThemeProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  })
  .catch((err: unknown) => {
    console.error(err);
    root.render(<StartupError message={err instanceof Error ? err.message : 'The local database could not be opened.'} />);
  });
