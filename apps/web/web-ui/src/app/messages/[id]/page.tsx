// @ts-nocheck
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import DashboardLayout from '@/components/DashboardLayout';
import { apiFetch, getApiBaseUrl } from '@/lib/auth';
import ErrorAlert from '@/components/ErrorAlert';

type Message = {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
};

export default function ConversationPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isPeerOnline, setIsPeerOnline] = useState(false);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load user profile to know who "I" am
  useEffect(() => {
    apiFetch('/profile')
      .then((res: any) => setCurrentUserId(res.userId || res.id))
      .catch(() => {});
  }, []);

  // Load history
  useEffect(() => {
    async function loadHistory() {
      setBusy(true);
      try {
        const res = await apiFetch(`/conversations/${id}/messages`);
        setMessages(res?.items || []);
        scrollToBottom();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setBusy(false);
      }
    }
    void loadHistory();
  }, [id]);

  // Connect WebSocket
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) return;

    const backendUrl = getApiBaseUrl().replace('/api/v1', '');
    const newSocket = io(`${backendUrl}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      newSocket.emit('conversation:join', { conversationId: id });
    });

    newSocket.on('message:new', (payload: { conversationId: string; message: Message }) => {
      if (payload.conversationId === id) {
        setMessages((prev) => [...prev, payload.message]);
        scrollToBottom();
      }
    });

    newSocket.on('typing', (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.conversationId === id && payload.userId !== currentUserId) {
        setIsPeerTyping(payload.isTyping);
      }
    });

    newSocket.on('user:status', (payload: { userId: string; online: boolean }) => {
      if (payload.userId !== currentUserId) {
        setIsPeerOnline(payload.online);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [id, currentUserId]);

  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  function handleTyping(e: React.ChangeEvent<HTMLInputElement>) {
    setDraft(e.target.value);
    
    if (socket) {
      socket.emit('conversation:typing', { conversationId: id, isTyping: true });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('conversation:typing', { conversationId: id, isTyping: false });
      }, 1500);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;

    const content = draft.trim();
    setDraft('');
    setSending(true);
    
    if (socket) {
      socket.emit('conversation:typing', { conversationId: id, isTyping: false });
    }

    try {
      await apiFetch(`/conversations/${id}/messages`, {
        method: 'POST',
        body: { content },
      });
      // the message will arrive via WebSocket 'message:new'
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/messages')}
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-surface transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Conversation {id.slice(0, 6)}</h1>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${isPeerOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                {isPeerOnline ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        </div>

        <ErrorAlert error={error} />

        <div className="flex-1 bg-white rounded-2xl shadow-card overflow-hidden border border-surface-border flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {busy && messages.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <span className="text-sm text-slate-500">Loading messages…</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-12">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === currentUserId;
                return (
                  <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl max-w-[75%] text-sm ${
                        isMe
                          ? 'bg-primary-600 text-white rounded-tr-sm'
                          : 'bg-surface border border-surface-border text-slate-800 rounded-tl-sm'
                      }`}
                    >
                      {m.content}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400 mt-1 px-1">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })
            )}
            
            {isPeerTyping && (
              <div className="flex items-center gap-1.5 px-4 py-2 bg-surface border border-surface-border text-slate-500 rounded-2xl rounded-tl-sm w-fit">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-surface-border bg-slate-50/50">
            <form onSubmit={handleSend} className="flex items-center gap-3">
              <input
                type="text"
                value={draft}
                onChange={handleTyping}
                placeholder="Type a message…"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-surface-border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center shrink-0 shadow-soft"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
