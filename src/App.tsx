import { useState, useEffect, useCallback } from 'react';
import { Menu, Home, Globe, MessageSquare, Settings, Film, GamepadIcon, Github } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { ViewId, Theme, AccentColor } from '@/types';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import HomeView from '@/components/HomeView';
import BrowserView from '@/components/BrowserView';
import ChatView from '@/components/ChatView';
import SettingsView from '@/components/SettingsView';
import MoviesView from '@/components/MoviesView';
import GamesView from '@/components/GamesView';
import JsdelivrGenerator from '@/components/JsdelivrGenerator';

interface AppUser {
  id: string;
  email: string;
  username: string;
}

const VIEW_LABELS: Record<ViewId, string> = {
  home: 'Home', browser: 'Browser', chat: 'Chat', settings: 'Settings', movies: 'Movies', games: 'Games', jsdelivr: 'GitHub Links',
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<ViewId>('home');
  const [theme, setTheme] = useState<Theme>('dark');
  const [accent, setAccent] = useState<AccentColor>('blue');
  const [user, setUser] = useState<AppUser | null>(null);
  const [browserTarget, setBrowserTarget] = useState<string | undefined>();

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
  }, [theme, accent]);

  useEffect(() => {
    const loadUser = async (session: Session | null) => {
      if (!session) {
        setUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', session.user.id)
        .maybeSingle();
      const fallbackUsername = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user';
      setUser({
        id: session.user.id,
        email: session.user.email || '',
        username: profile?.username || fallbackUsername,
      });
    };

    supabase.auth.getSession().then(({ data }) => { void loadUser(data.session); });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        await loadUser(session);
        if (session) {
          const { data: settings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (settings) {
            setTheme(settings.theme as Theme);
            setAccent(settings.accent_color as AccentColor);
          }
        }
      })();
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleThemeChange = useCallback((newTheme: Theme) => setTheme(newTheme), []);
  const handleAccentChange = useCallback((newAccent: AccentColor) => setAccent(newAccent), []);
  const navItems = [
    { id: 'home' as ViewId, label: 'Home', icon: Home },
    { id: 'browser' as ViewId, label: 'Browser', icon: Globe },
    { id: 'chat' as ViewId, label: 'Chat', icon: MessageSquare },
    { id: 'movies' as ViewId, label: 'Movies', icon: Film },
    { id: 'games' as ViewId, label: 'Games', icon: GamepadIcon },
    { id: 'jsdelivr' as ViewId, label: 'GitHub Links', icon: Github },
    { id: 'settings' as ViewId, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activeView={activeView} onViewChange={setActiveView} navItems={navItems} user={user} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-3 px-4 h-12 border-b shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
          {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={{ color: 'var(--text-secondary)' }}><Menu size={20} /></button>}
          <h1 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--text-primary)' }}>aero.<span className="opacity-50"> / {VIEW_LABELS[activeView]}</span></h1>
        </header>
        <div className="flex-1 overflow-hidden">
          {activeView === 'home' && <HomeView onNavigate={setActiveView} />}
          {activeView === 'browser' && <BrowserView initialUrl={browserTarget} />}
          {activeView === 'chat' && <ChatView user={user} />}
          {activeView === 'settings' && <SettingsView theme={theme} accent={accent} onThemeChange={handleThemeChange} onAccentChange={handleAccentChange} user={user} />}
          {activeView === 'movies' && <MoviesView onOpenInBrowser={() => { setBrowserTarget('https://watch.spencerdevs.xyz/'); setActiveView('browser'); }} />}
          {activeView === 'games' && <GamesView />}
          {activeView === 'jsdelivr' && <JsdelivrGenerator />}
        </div>
      </main>
    </div>
  );
}
