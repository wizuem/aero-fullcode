import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/types';

interface ChatViewProps {
  user: { id: string; email: string; username: string } | null;
}

const MESSAGE_FETCH_LIMIT = 100;

export default function ChatView({ user }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [username, setUsername] = useState('Anonymous');
  const [loading, setLoading] = useState(true);
  const [loadingSend, setLoadingSend] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      return;
    }
    const saved = localStorage.getItem('aero-chat-username');
    if (saved) setUsername(saved);
  }, [user]);

  const loadMessages = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(MESSAGE_FETCH_LIMIT);

    if (queryError) {
      setError(queryError.message);
    } else {
      setMessages((data || []) as ChatMessage[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadMessages();

    const channel = supabase
      .channel('chat_messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((previous) =>
            previous.some((message) => message.id === newMessage.id)
              ? previous
              : [...previous, newMessage],
          );
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          setError('Live updates are unavailable. Messages can still be sent and refreshed.');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    const displayName = username.trim() || 'Anonymous';
    if (!content || loadingSend) return;

    setLoadingSend(true);
    setSendError(null);

    const { data, error: insertError } = await supabase
      .from('chat_messages')
      .insert({ username: displayName, content })
      .select('*')
      .maybeSingle();

    if (insertError) {
      setSendError(insertError.message);
    } else {
      setInput('');
      if (data) {
        const sentMessage = data as ChatMessage;
        setMessages((previous) =>
          previous.some((message) => message.id === sentMessage.id)
            ? previous
            : [...previous, sentMessage],
        );
      }
    }
    setLoadingSend(false);
  }, [input, loadingSend, username]);

  const handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.slice(0, 30);
    setUsername(value);
    if (!user) localStorage.setItem('aero-chat-username', value);
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <Users size={18} style={{ color: 'var(--accent)' }} />
        <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Global Chat</h2>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
          {messages.length} messages
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <p className="text-sm" style={{ color: '#f43f5e' }}>Unable to load chat</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>
            <button onClick={() => { setLoading(true); void loadMessages(); }} className="text-xs underline" style={{ color: 'var(--accent)' }}>Try again</button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--bg-tertiary)', color: 'var(--accent)' }}>
                {message.username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{message.username}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(message.created_at)}</span>
                </div>
                <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--text-secondary)' }}>{message.content}</p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t px-4 py-3 shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <input type="text" value={username} onChange={handleUsernameChange} disabled={Boolean(user)} placeholder="Your name" className="px-2 py-1 rounded text-xs outline-none w-32 disabled:opacity-70" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} />
          {user && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Signed-in username</span>}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={input} onChange={(event) => { setInput(event.target.value); setSendError(null); }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void handleSend(); } }} placeholder="Type a message..." className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} maxLength={2000} />
          <button onClick={() => void handleSend()} disabled={!input.trim() || loadingSend} className="p-2 rounded-lg transition-opacity disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}>
            <Send size={18} />
          </button>
        </div>
        {sendError && <p className="text-xs mt-2" style={{ color: '#f43f5e' }}>{sendError}</p>}
      </div>
    </div>
  );
}
