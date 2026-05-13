 // @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setTokens } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

      setTokens(res);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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
      React.createElement('div', { className: 'text-3xl font-black' }, 'LOGIN'),
      React.createElement(
        'div',
        { className: 'mt-2 text-sm font-bold opacity-80' },
        'Welcome back. Don’t blink.'
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
            'Email'
          ),
          React.createElement('input', {
            value: email,
            onChange: (e) => setEmail(e.target.value),
            className:
              'w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white',
            placeholder: 'you@example.com',
            type: 'email',
            required: true,
          })
        ),
        React.createElement(
          'label',
          { className: 'block' },
          React.createElement(
            'div',
            { className: 'mb-1 text-sm font-black' },
            'Password'
          ),
          React.createElement('input', {
            value: password,
            onChange: (e) => setPassword(e.target.value),
            className:
              'w-full rounded-lg border-2 border-black bg-[#f7f7f7] px-3 py-2 font-mono shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] outline-none focus:bg-white',
            placeholder: '••••••••',
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
        React.createElement(
          'button',
          {
            disabled: isLoading,
            className:
              'w-full rounded-lg border-4 border-black bg-yellow-300 px-4 py-3 text-center text-sm font-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px] disabled:opacity-60',
            type: 'submit',
          },
          isLoading ? 'LOGGING IN…' : 'LOGIN'
        ),
        React.createElement(
          'div',
          { className: 'pt-2 text-center text-xs font-bold opacity-70' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () => router.push('/auth/register'),
              className: 'underline',
            },
            'Create an account'
          ),
          ' · ',
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: () =>
                router.push('/auth/password-reset/request'),
              className: 'underline',
            },
            'Forgot password?'
          )
        )
      )
    )
  );
}
