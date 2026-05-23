// @ts-nocheck
import React from 'react';

interface ErrorAlertProps {
  error: string | null;
  className?: string;
}

export default function ErrorAlert({ error, className = 'mb-4' }: ErrorAlertProps) {
  if (!error) return null;

  return (
    <div className={`rounded-xl bg-red-50 border border-red-200 p-4 flex items-start gap-3 shadow-sm ${className}`}>
      <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div className="text-sm text-red-700 font-medium whitespace-pre-wrap">{error}</div>
    </div>
  );
}
