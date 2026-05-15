// @ts-nocheck
'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';

function PasswordResetConfirmForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') || '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      await apiFetch('/auth/password-reset/confirm', {
        method: 'POST',
        body: { email, code, newPassword },
      });

      setMessage('Password updated. You can log in now.');
      router.push('/auth/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setIsLoading(false);
    }
  }

  return React.createElement(
    'main',
    { className: 'mx-auto max-w-md p-6' },
    React.createElement(
      'div',
      {
        className:
          'rounded-xl border-4 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
      },
      React.createElement('div', { className: 'text-3xl font-black' }, 'RESET PASSWORD'),
      React.createElement(
        'div',
        { className: 'mt-2 text-sm font-bold opacity-80' },
        email ? `Confirm code for ${email}` : 'Confirm your reset code'
      ),
      React.createElement(
        'form',
        { className: 'mt-5 space-y-4', onSubmit: onSubmit },
        React.createElement(
          'label',
          { className: 'block' },
          React.createElement('div', { className: 'mb-1 text-sm font-black' }, '6-digit code'),
          React.createElement('input', {
            value: code,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value),
            className:
              'w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white',
            placeholder: '123456',
            type: 'text',
            inputMode: 'numeric' as const,
            required: true,
            maxLength: 6,
          })
        ),
        React.createElement(
          'label',
          { className: 'block' },
          React.createElement('div', { className: 'mb-1 text-sm font-black' }, 'New password'),
          React.createElement('input', {
            value: newPassword,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value),
            className:
              'w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white',
            placeholder: 'Minimum 8 characters',
            type: 'password',
            minLength: 8,
            required: true,
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
        message
          ? React.createElement(
              'div',
              {
                className:
                  'rounded-lg border-2 border-black bg-yellow-100 p-3 text-sm font-bold',
              },
              message
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
          isLoading ? 'UPDATING…' : 'UPDATE PASSWORD'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            className: 'w-full rounded-lg border-3 border-black bg-white px-4 py-3 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
            onClick: () => router.push('/auth/login'),
          },
          'BACK TO LOGIN'
        )
      )
    )
  );
}

export default function PasswordResetConfirmPage() {
  return React.createElement(
    Suspense,
    { fallback: React.createElement('div', { className: 'p-6 text-center font-bold' }, 'Loading…') },
    React.createElement(PasswordResetConfirmForm)
  );
}
