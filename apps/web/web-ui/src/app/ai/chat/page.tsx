// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiChatPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  async function send() {
    if (!message.trim() || busy) return;

    const userMsg = message.trim();
    setMessage('');
    setHistory((prev) => [...prev, { role: 'user', content: userMsg }]);
    setBusy(true);
    setError('');

    try {
      const res = await apiFetch('/ai/chat', {
        method: 'POST',
        body: { message: userMsg },
      });

      const text = typeof res === 'string' ? res : (res?.reply || res?.response || JSON.stringify(res, null, 2));
      setHistory((prev) => [...prev, { role: 'assistant', content: text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI chat failed');
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">AI Career Assistant</h1>
          <p className="text-sm text-slate-500">Get career guidance, skill gap analysis, and personalized advice</p>
        </div>

        {/* Chat area */}
        <div className="flex-1 bg-white rounded-2xl shadow-card flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {history.length === 0 && !busy && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-400 flex items-center justify-center text-white mb-4 shadow-soft">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-700">Start a conversation</h3>
                <p className="mt-1 text-sm text-slate-400 max-w-sm">
                  Ask about career paths, skill development, job search strategies, or interview preparation.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {['What skills should I learn?', 'Review my career path', 'Interview tips'].map((q) => (
                    <button
                      key={q}
                      onClick={() => setMessage(q)}
                      className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white rounded-br-md'
                      : 'bg-surface text-slate-700 rounded-bl-md border border-surface-border'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="bg-surface rounded-2xl rounded-bl-md px-4 py-3 border border-surface-border">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mb-3 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Input area */}
          <div className="border-t border-surface-border p-4">
            <div className="flex items-end gap-3">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-4 py-2.5 bg-surface rounded-xl text-sm border border-surface-border focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all resize-none min-h-[44px] max-h-32"
                placeholder="Ask about your career path…"
                rows={1}
              />
              <button
                onClick={send}
                disabled={busy || !message.trim()}
                className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-xl flex items-center justify-center hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-soft"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
