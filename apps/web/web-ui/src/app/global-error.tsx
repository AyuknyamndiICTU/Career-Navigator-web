'use client';

import { useEffect } from 'react';

// Replaces the root layout when it fails, so it must render its own <html> and avoid app CSS.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application crashed:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#f8fafc',
          color: '#1e293b',
        }}
      >
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Career Navigator is unavailable</h1>
          <p style={{ color: '#64748b', marginBottom: 20 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#4f46e5',
              color: '#fff',
              border: 0,
              borderRadius: 12,
              padding: '10px 20px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
