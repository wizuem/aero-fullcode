import { useEffect, useRef, useState } from 'react';
import { ExternalLink, GamepadIcon, Grid3X3 } from 'lucide-react';

const LUMIN_SCRIPT = 'https://cdn.jsdelivr.net/gh/luminsdk/script@latest/lumin.min.js';
const GN_MATH_URL = 'https://gn-math.dev/';

declare global {
  interface Window {
    Lumin?: {
      init: (options: { container: string; theme: 'dark' | 'light' }) => void | Promise<void>;
    };
  }
}

export default function GamesView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><GamepadIcon size={25} style={{ color: 'var(--accent)' }} /></div>
            <div><h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Games</h1><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Play LuminSDK and GN Math games.</p></div>
          </div>
          <a href="https://luminsdk.com/#get-started" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--accent)' }}>LuminSDK <ExternalLink size={14} /></a>
        </div>

        {error ? <div className="p-4 rounded-xl text-sm" style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e' }}>{error}</div> : <div ref={containerRef} id="games" className="min-h-[420px] rounded-2xl p-4" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }} />}

        <section>
          <div className="flex items-center justify-between gap-4 mb-4"><div className="flex items-center gap-2"><Grid3X3 size={18} style={{ color: 'var(--accent)' }} /><div><h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>GN Math</h2><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Play GN Math directly inside aero.</p></div></div><a href={GN_MATH_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}>Open site <ExternalLink size={13} /></a></div>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><iframe src={GN_MATH_URL} title="GN Math games" className="w-full h-[680px] border-0" allow="fullscreen; autoplay; gamepad" referrerPolicy="strict-origin-when-cross-origin" /></div>
        </section>
      </div>
    </div>
  );
}
