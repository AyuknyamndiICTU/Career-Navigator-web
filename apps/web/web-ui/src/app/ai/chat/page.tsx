 // @ts-nocheck
'use client';

// @ts-nocheck
import React, { useState } from 'react';
import { apiFetch } from '@/lib/auth';

export default function AiChatPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [responseText, setResponseText] = useState('');

  async function send() {
    setBusy(true);
    setError('');
    setResponseText('');

    try {
      const res = await apiFetch('/ai/chat', {
        method: 'POST',
        body: { message },
      });

      setResponseText(
        typeof res === 'string' ? res : JSON.stringify(res, null, 2)
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI chat failed');
    } finally {
      setBusy(false);
    }
  }

  return React.createElement(
    'main',
    { className: 'mx-auto max-w-3xl p-6' },
    React.createElement(
      'div',
      {
        className:
          'rounded-xl border-4 border-black bg-white p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]',
      },
      React.createElement('div', { className: 'text-3xl font-black' }, 'AI CHAT'),
      React.createElement(
        'div',
        { className: 'mt-1 text-sm font-bold opacity-80' },
        'Career-path-only assistant. No off-limits answers.'
      ),

      React.createElement(
        'div',
        { className: 'mt-4' },
        React.createElement(
          'textarea',
          {
            value: message,
            onChange: (e) => setMessage(e.target.value),
            className:
              'h-28 w-full rounded-lg border-2 border-black bg-[#f7f7f7] p-3 font-mono outline-none focus:bg-white',
            placeholder: 'Ask about your next step…',
          }
        )
      ),

      error
        ? React.createElement(
            'div',
            {
              className:
                'mt-3 rounded-lg border-2 border-black bg-red-100 p-3 text-sm font-bold',
            },
            error
          )
        : null,

      responseText
        ? React.createElement(
            'div',
            {
              className:
                'mt-3 rounded-lg border-2 border-black bg-black/5 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap',
            },
            responseText
          )
        : null,

      React.createElement(
        'div',
        { className: 'mt-4 flex items-center gap-2' },
        React.createElement(
          'button',
          {
            onClick: send,
            disabled: busy || !message.trim(),
            className:
              'rounded-lg border-3 border-black bg-yellow-300 px-4 py-2 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px] disabled:opacity-60',
            type: 'button',
          },
          busy ? 'THINKING…' : 'SEND'
        ),
        React.createElement(
          'button',
          {
            onClick: () => {
              setMessage('');
              setResponseText('');
              setError('');
            },
            disabled: busy,
            className:
              'rounded-lg border-3 border-black bg-white px-4 py-2 text-sm font-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-[1px] active:translate-y-[0px] disabled:opacity-60',
            type: 'button',
          },
          'CLEAR'
        )
      )
    )
  );
}
