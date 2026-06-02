/* eslint-disable no-undef */
// @ts-nocheck
'use client';

import { Fragment, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/auth';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function textFromAiPayload(payload: unknown): string {
  if (typeof payload === 'string') return cleanAssistantText(payload);

  if (!payload || typeof payload !== 'object') {
    return 'I had trouble reading that response. Please try again.';
  }

  const record = payload as Record<string, unknown>;
  const directText = record.reply ?? record.response ?? record.message;

  if (typeof directText === 'string') return cleanAssistantText(directText);

  return 'I received your request, but the response was not in a readable format. Please try asking again.';
}

function cleanAssistantText(text: string): string {
  const trimmed = text.trim();

  const stripped = trimmed
    .replace(/```(?:json)?/gi, '')
    .replace(/```/g, '')
    .trim();

  if (stripped.startsWith('{') && stripped.endsWith('}')) {
    try {
      const parsed = JSON.parse(stripped) as Record<string, unknown>;
      const nestedText = parsed.reply ?? parsed.response ?? parsed.message;
      if (typeof nestedText === 'string') return nestedText.trim();
    } catch {
      // Keep the original readable text below.
    }
  }

  return stripped
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*assistant\s*:\s*/i, '')
    .trim();
}

function renderInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-extrabold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function AssistantMessageContent({ content }: { content: string }) {
  const lines = content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: Array<{ type: 'paragraph' | 'list'; items: string[] }> = [];

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/) ?? line.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch) {
      const previous = blocks[blocks.length - 1];
      if (previous?.type === 'list') {
        previous.items.push(bulletMatch[1]);
      } else {
        blocks.push({ type: 'list', items: [bulletMatch[1]] });
      }
    } else {
      blocks.push({ type: 'paragraph', items: [line] });
    }
  }

  if (blocks.length === 0) {
    return <div className="font-medium">{content}</div>;
  }

  return (
    <div className="space-y-3 font-medium">
      {blocks.map((block, index) =>
        block.type === 'list' ? (
          <ul key={index} className="space-y-2 pl-4 list-disc">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="pl-1">
                {renderInlineMarkdown(item)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>{renderInlineMarkdown(block.items[0])}</p>
        ),
      )}
    </div>
  );
}

export default function AiChatPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, busy]);

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

      const text = textFromAiPayload(res);
      setHistory((prev) => [...prev, { role: 'assistant', content: text }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'AI chat failed';
      if (!msg) return;
      if (msg.toLowerCase().includes('401') || msg.toLowerCase().includes('unauthorized')) return;
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: any) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-6rem)] pb-6">
        
        {/* Chat Header / Hero */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-t-3xl p-6 md:p-8 shrink-0 shadow-sm z-10"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
          }}
        >
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">AI Career Assistant</h1>
              <p className="mt-1 text-white/80 text-sm md:text-base font-medium">Your personal guide for career growth and skill analysis</p>
            </div>
          </div>

          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute right-20 top-4 w-16 h-16 bg-white/10 rounded-full blur-lg" />
        </motion.div>

        {/* Chat area */}
        <div className="flex-1 bg-white/80 backdrop-blur-3xl rounded-b-3xl shadow-card border border-t-0 border-surface-border flex flex-col overflow-hidden relative">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {history.length === 0 && !busy && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-500 mb-6 shadow-inner border border-indigo-50">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800">How can I help your career today?</h3>
                <p className="mt-2 text-sm text-slate-500 max-w-sm leading-relaxed">
                  Ask me to analyze your skill gaps, suggest learning paths, or help you prepare for an upcoming interview.
                </p>
                <div className="mt-8 flex flex-wrap gap-3 justify-center">
                  {['What skills should I learn next?', 'Review my career trajectory', 'Give me interview tips'].map((q, i) => (
                    <motion.button
                      key={q}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setMessage(q)}
                      className="px-4 py-2.5 text-sm font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-colors shadow-sm"
                    >
                      {q}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {history.map((msg, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.3 }}
                key={i} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mr-3 mt-1 shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-br-sm'
                      : 'bg-white text-slate-700 rounded-bl-sm border border-slate-100'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <AssistantMessageContent content={msg.content} />
                  ) : (
                    <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                  )}
                </div>
              </motion.div>
            ))}

            {busy && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 mr-3 shadow-md animate-pulse">
                   <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                </div>
                <div className="bg-white rounded-2xl rounded-bl-sm px-5 py-4 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-1.5 h-5">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={chatEndRef} className="h-2" />
          </div>

          <ErrorAlert error={error} />

          {/* Input area */}
          <div className="p-4 bg-white/50 backdrop-blur-md border-t border-surface-border">
            <div className="flex items-end gap-3 max-w-3xl mx-auto relative">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-5 py-3.5 bg-white rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all resize-none min-h-[52px] max-h-32 shadow-sm font-medium text-slate-700 placeholder-slate-400"
                placeholder="Message AI Assistant..."
                rows={1}
              />
              <button
                onClick={send}
                disabled={busy || !message.trim()}
                className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-md mb-0.5"
              >
                <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
