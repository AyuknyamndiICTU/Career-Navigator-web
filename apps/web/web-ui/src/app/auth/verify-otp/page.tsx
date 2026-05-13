 // @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

export default function VerifyOtpPage() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: { email, code },
      });

      // No tokens are returned by this endpoint; route user to login.
      router.push('/auth/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setIsLoading(false);
    }
  }

  return React.createElement(
    'main',
    { className: 'mx-auto max-w-md p-6' },
    React.createElement(
      'div',
      { className: 'rounded-xl border-4 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]' },
      React.createElement('div', { className: 'text-3xl font-black' }, 'VERIFY OTP'),
      React.createElement(
        'div',
        { className: 'mt-2 text-sm font-bold opacity-80' },
        email ? `Enter the 6-digit code for ${email}` : 'Enter the 6-digit code'
      ),
      React.createElement(
        'form',
        { className: 'mt-5 space-y-4', onSubmit: onSubmit },
        React.createElement(
          'label',
          { className: 'block' },
          React.createElement(
            'div',
            { className: 'mb-1 text-sm font-black' },
            'OTP Code'
          ),
          React.createElement('input', {
            value: code,
            onChange: (e) => setCode(e.target.value),
            className:
              'w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white',
            type: 'text',
            inputMode: 'numeric',
            placeholder: '123456',
            required: true,
            maxLength: 6,
          })
        ),
        error
          ? React.createElement(
              'div',
              {
                className:
                  'rounded-lg border-2 border-black bg-red-100 p-3 text-sm font-bold',
              },
              error
            )
          : null,
        React.createElement(
          'button',
          {
            disabled: isLoading,
            className:
              'w-full rounded-lg border-4 border-black bg-yellow-300 px-4 py-3 text-center text-sm font-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px] disabled:opacity-60',
            type: 'submit',
          },
          isLoading ? 'VERIFYING…' : 'VERIFY'
        ),
        React.createElement(
          'div',
          { className: 'pt-2 text-center text-xs font-bold opacity-70' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => router.push('/auth/login'),
              className: 'underline',
            },
            'Back to login'
          )
        )
      )
    )
  );
}
