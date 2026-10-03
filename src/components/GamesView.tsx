import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ExternalLink, GamepadIcon, Grid3X3, Search, Sparkles } from 'lucide-react';

const LUMIN_SCRIPT = 'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js';
const GN_MATH_URL = 'https://gn-math.dev/';

declare global {
  interface Window {
    Lumin?: {
      init: (options: { container: string; theme: 'dark' | 'light' }) => void | Promise<void>;
    };
  }
}

interface GameHub {
  name: string;
  description: string;
  category: string;
  url: string;
  accent: string;
}

const GAME_HUBS: GameHub[] = [
  {
    name: 'Opium',
    description: 'A hand-picked arcade-style game library with a fast, minimal feel.',
    category: 'Featured library',
    url: 'https://opium.best/',
    accent: '#ff6b5f',
  },
  {
    name: 'Selenite',
    description: 'A large collection of browser games, apps, and projects in one place.',
    category: 'Game library',
    url: 'https://selenite.cc/projects.html',
    accent: '#9bd3ff',
  },
  {
    name: 'CKV',
    description: 'Jump into the CKV game hosted on the Opera GX game platform.',
    category: 'Featured game',
    url: 'https://gx.games/games/pt81l2/ckv-game',
    accent: '#c5a7ff',
  },
  {
    name: 'GN Math',
    description: 'Quick-play games and challenges made for the browser.',
    category: 'Arcade',
    url: GN_MATH_URL,
    accent: '#4ade80',
  },
  {
    name: 'UBG Hyper',
    description: 'A broad catalog of free games covering racing, action, puzzles, and more.',
    category: 'Game library',
    url: 'https://ubghyper.github.io',
    accent: '#fbbf24',
  },
  {
    name: 'Classroom Center',
    description: 'A rotating collection of lightweight browser games and classics.',
    category: 'Game library',
    url: 'https://sites.google.com/classroom.center/view-1?pli=1&authuser=0',
    accent: '#38bdf8',
  },
];

export default function GamesView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    const initialize = () => {
      if (!mounted || !containerRef.current || !window.Lumin) return;
      Promise.resolve(window.Lumin.init({ container: '#games', theme: 'dark' })).catch(() => {
        if (mounted) setError('The LuminSDK library could not be loaded.');
      });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-lumin-sdk]');
    if (existing) {
      existing.addEventListener('load', initialize);
      initialize();
    } else {
      const script = document.createElement('script');
      script.src = LUMIN_SCRIPT;
      script.async = true;
      script.dataset.luminSdk = 'true';
      script.addEventListener('load', initialize);
      script.addEventListener('error', () => setError('The LuminSDK library could not be loaded.'));
      document.head.appendChild(script);
    }
    return () => { mounted = false; };
  }, []);

  const visibleHubs = GAME_HUBS.filter((hub) => {
    const query = search.trim().toLowerCase();
    return !query || `${hub.name} ${hub.description} ${hub.category}`.toLowerCase().includes(query);
  });

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><GamepadIcon size={25} style={{ color: 'var(--accent)' }} /></div>
            <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Game library</h1><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Aero’s launchpad for browser games and curated hubs.</p></div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a library..." className="w-full rounded-xl py-2.5 pl-9 pr-3 text-sm outline-none" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
        </div>

        <section>
          <div className="flex items-center gap-2 mb-4"><Sparkles size={17} style={{ color: 'var(--accent)' }} /><div><h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Explore</h2><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Open a library in a new tab and start playing.</p></div></div>
          {visibleHubs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleHubs.map((hub) => (
                <a key={hub.name} href={hub.url} target="_blank" rel="noopener noreferrer" className="group rounded-2xl p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent)]" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-4"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: `${hub.accent}22`, color: hub.accent }}>{hub.name.slice(0, 1)}</div><ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" style={{ color: 'var(--text-muted)' }} /></div>
                  <div className="mt-6"><p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: hub.accent }}>{hub.category}</p><h3 className="mt-1 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{hub.name}</h3><p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{hub.description}</p></div>
                </a>
              ))}
            </div>
          ) : <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>No libraries match “{search}”.</div>}
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 mb-4"><div className="flex items-center gap-2"><Grid3X3 size={18} style={{ color: 'var(--accent)' }} /><div><h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>LuminSDK</h2><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Play the built-in arcade collection directly inside aero.</p></div></div><a href="https://luminsdk.com/#get-started" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--accent)' }}>About LuminSDK <ExternalLink size={14} /></a></div>
          {error ? <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}>{error}</div> : <div ref={containerRef} id="games" className="min-h-[420px] rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} />}
        </section>

        <section>
          <div className="flex items-center justify-between gap-4 mb-4"><div className="flex items-center gap-2"><Grid3X3 size={18} style={{ color: 'var(--accent)' }} /><div><h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>GN Math</h2><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Play GN Math directly inside aero.</p></div></div><a href={GN_MATH_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>Open site <ExternalLink size={13} /></a></div>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><iframe src={GN_MATH_URL} title="GN Math games" className="w-full h-[680px] border-0" allow="fullscreen; autoplay; gamepad" referrerPolicy="strict-origin-when-cross-origin" /></div>
        </section>
      </div>
    </div>
  );
}
