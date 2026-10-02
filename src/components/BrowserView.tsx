import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Home, Lock, X, Star, Search } from 'lucide-react';
import { initScramjet, encodeUrl } from '@/lib/scramjet';
import { supabase } from '@/lib/supabase';
import type { Bookmark } from '@/types';

interface Tab {
  id: string;
  url: string;
  title: string;
  loading: boolean;
}

interface BrowserViewProps {
  initialUrl?: string;
}

function generateTabId(): string {
  return Math.random().toString(36).slice(2);
}

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) return `https://${trimmed}`;
  // Treat as search query
  return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}`;
}

export default function BrowserView({ initialUrl }: BrowserViewProps) {
  const [tabs, setTabs] = useState<Tab[]>([{ id: generateTabId(), url: '', title: 'New Tab', loading: false }]);
  const [activeTabId, setActiveTabId] = useState<string>(tabs[0].id);
  const [urlInput, setUrlInput] = useState('');
  const [scramjetReady, setScramjetReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [proxyMode, setProxyMode] = useState<'proxy' | 'direct'>('proxy');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  useEffect(() => {
    initScramjet()
      .then(() => setScramjetReady(true))
      .catch((err) => setInitError(err instanceof Error ? err.message : String(err)));
  }, []);

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const navigate = useCallback(
    (rawUrl: string) => {
      const url = normalizeUrl(rawUrl);
      if (!url) return;
      updateTab(activeTabId, { url, loading: true, title: url });
      setUrlInput(url);
    },
    [activeTabId, updateTab]
  );

  useEffect(() => {
    if (initialUrl) navigate(initialUrl);
  }, [initialUrl, navigate]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(urlInput);
  };

  const handleNewTab = () => {
    const newTab: Tab = { id: generateTabId(), url: '', title: 'New Tab', loading: false };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput('');
  };

  const handleCloseTab = (id: string) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (filtered.length === 0) {
        const fresh: Tab = { id: generateTabId(), url: '', title: 'New Tab', loading: false };
        setActiveTabId(fresh.id);
        setUrlInput('');
        return [fresh];
      }
      if (id === activeTabId) {
        const newActive = filtered[filtered.length - 1];
        setActiveTabId(newActive.id);
        setUrlInput(newActive.url);
      }
      return filtered;
    });
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    const bodyText = iframe?.contentDocument?.body?.textContent || '';
    if (proxyMode === 'proxy' && /Request failed with error code|Could not connect to server/i.test(bodyText)) {
      setProxyMode('direct');
      setInitError('The proxy server could not reach that site, so this tab was switched to direct browsing.');
      return;
    }
    updateTab(activeTabId, { loading: false });
    try {
      if (iframe && iframe.contentWindow) {
        const title = iframe.contentDocument?.title;
        if (title) updateTab(activeTabId, { title });
      }
    } catch {
      // Cross-origin — can't read title, that's expected
    }
  };

  const handleGoHome = () => {
    updateTab(activeTabId, { url: '', title: 'New Tab', loading: false });
    setUrlInput('');
  };

  const handleReload = () => {
    if (activeTab.url) {
      updateTab(activeTabId, { loading: true });
      // Force reload by toggling url
      const currentUrl = activeTab.url;
      updateTab(activeTabId, { url: '' });
      setTimeout(() => updateTab(activeTabId, { url: currentUrl, loading: true }), 50);
    }
  };

  const handleBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      // Cross-origin restriction
    }
  };

  const handleForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      // Cross-origin restriction
    }
  };

  // Bookmark management
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase
          .from('user_bookmarks')
          .select('*')
          .eq('user_id', data.session.user.id)
          .order('created_at', { ascending: false })
          .then(({ data: bmData }) => {
            if (bmData) setBookmarks(bmData as Bookmark[]);
          });
      }
    });
  }, []);

  const handleAddBookmark = async () => {
    if (!activeTab.url) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    const { data } = await supabase
      .from('user_bookmarks')
      .insert({ url: activeTab.url, title: activeTab.title, user_id: session.session.user.id })
      .select()
      .single();
    if (data) setBookmarks((prev) => [data as Bookmark, ...prev]);
  };

  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);

  const startUrl = activeTab.url
    ? proxyMode === 'proxy' && scramjetReady
      ? encodeUrl(activeTab.url)
      : initError || proxyMode === 'direct'
        ? activeTab.url
        : ''
    : '';

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-2 h-9 border-b overflow-x-auto shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTabId(tab.id);
              setUrlInput(tab.url);
            }}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium transition-all max-w-[180px] shrink-0"
            style={{
              background: tab.id === activeTabId ? 'var(--bg-primary)' : 'transparent',
              color: tab.id === activeTabId ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {tab.loading && (
              <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            )}
            <span className="truncate">{tab.title || 'New Tab'}</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <X size={12} />
            </span>
          </button>
        ))}
        <button
          onClick={handleNewTab}
          className="px-2 py-1 rounded text-sm shrink-0"
          style={{ color: 'var(--text-muted)' }}
        >
          +
        </button>
      </div>

      {/* Navigation bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <button onClick={handleBack} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }} disabled={!activeTab.url}>
          <ArrowLeft size={18} />
        </button>
        <button onClick={handleForward} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }} disabled={!activeTab.url}>
          <ArrowRight size={18} />
        </button>
        <button onClick={handleReload} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }} disabled={!activeTab.url}>
          <RotateCw size={16} />
        </button>
        <button onClick={handleGoHome} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }}>
          <Home size={18} />
        </button>

        <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center">
          <div
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <Lock size={14} style={{ color: 'var(--accent)' }} />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Search or enter a URL..."
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: 'var(--text-primary)' }}
            />
            {urlInput && (
              <button type="submit" className="transition-opacity hover:opacity-80" style={{ color: 'var(--accent)' }}>
                <Search size={14} />
              </button>
            )}
          </div>
        </form>

        <button
          onClick={handleAddBookmark}
          className="p-1.5 rounded-lg transition-colors hover:opacity-80"
          style={{ color: isBookmarked ? 'var(--accent)' : 'var(--text-secondary)' }}
          disabled={!activeTab.url}
        >
          <Star size={16} fill={isBookmarked ? 'var(--accent)' : 'none'} />
        </button>
      </div>

      {/* Status / error banner */}
      {(activeTab.url || initError || (!scramjetReady && !initError)) && (
        <div
          className="px-4 py-2 text-xs text-center shrink-0"
          style={{
            background: initError ? 'rgba(244,63,94,0.1)' : 'var(--bg-tertiary)',
            color: initError ? '#f43f5e' : 'var(--text-secondary)',
          }}
        >
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span>{initError ? `Proxy unavailable: ${initError}` : proxyMode === 'direct' ? 'Direct browsing mode.' : scramjetReady ? 'Scramjet proxy mode.' : 'Initializing Scramjet proxy engine...'}</span>
            {(scramjetReady || initError) && <button onClick={() => setProxyMode(proxyMode === 'proxy' ? 'direct' : 'proxy')} className="underline font-medium">{proxyMode === 'proxy' ? 'Use direct mode' : 'Use proxy mode'}</button>}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        {!activeTab.url ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <img src="/c64e00f09ee3ebb80c04e28ab68acbf5 copy.png" alt="aero." className="w-20 h-20 object-contain rounded-2xl opacity-90" />
            <form
              onSubmit={handleUrlSubmit}
              className="w-full max-w-lg flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <Search size={20} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Search the web or enter a URL..."
                className="flex-1 bg-transparent outline-none text-base"
                style={{ color: 'var(--text-primary)' }}
                autoFocus
              />
              <button type="submit" className="px-4 py-1.5 rounded-lg text-sm font-medium" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}>
                Go
              </button>
            </form>

            {bookmarks.length > 0 && (
              <div className="w-full max-w-lg">
                <h3 className="text-xs font-semibold mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Bookmarks</h3>
                <div className="grid grid-cols-2 gap-2">
                  {bookmarks.map((bm) => (
                    <button
                      key={bm.id}
                      onClick={() => {
                        setUrlInput(bm.url);
                        navigate(bm.url);
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors hover:opacity-80"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                    >
                      <GlobeInline size={14} />
                      <span className="truncate">{bm.title || bm.url}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : startUrl ? (
          <iframe
            ref={iframeRef}
            src={startUrl}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0"
            title={activeTab.title}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
            allow="fullscreen; autoplay; encrypted-media; clipboard-read; clipboard-write"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          </div>
        )}
      </div>
    </div>
  );
}

function GlobeInline({ size = 14 }: { size?: number }) {
  return <Search size={size} style={{ color: 'var(--text-muted)' }} />;
}
