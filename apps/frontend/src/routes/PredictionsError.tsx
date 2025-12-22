/**
 * Error component for the predictions market page.
 * Used with React Router's errorElement for error boundaries.
 */

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate, useRouteError } from 'react-router-dom';
import { useEffect } from 'react';

interface RouteError {
  message?: string;
  statusText?: string;
  status?: number;
}

export default function PredictionsError() {
  const navigate = useNavigate();
  const routeError = useRouteError() as RouteError | Error;

  const errorMessage =
    routeError instanceof Error
      ? routeError.message
      : (routeError as RouteError)?.message ||
        (routeError as RouteError)?.statusText ||
        'Unknown error';

  useEffect(() => {
    // Log error for debugging - Sentry integration can be added later
    console.error('[PredictionsError] Error in markets/predictions:', {
      error: routeError,
      message: errorMessage,
    });
  }, [routeError, errorMessage]);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto mb-4 h-16 w-16 text-orange-500" />
        <h2 className="mb-2 font-bold text-2xl">Chart Loading Error</h2>
        <p className="mb-6 text-muted-foreground">
          There was an issue loading the prediction markets. This may be due to
          a temporary connection issue.
        </p>
        {errorMessage && (
          <p className="mb-4 text-muted-foreground text-xs">
            Error: {errorMessage}
          </p>
        )}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <button
            onClick={() => navigate('/markets')}
            className="rounded-md bg-secondary px-6 py-2 text-secondary-foreground transition-colors hover:bg-secondary/90"
          >
            Back to Markets
          </button>
        </div>
      </div>
    </div>
  );
}
