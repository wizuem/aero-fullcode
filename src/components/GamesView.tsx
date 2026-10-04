import { useEffect, useState } from 'react';
import { GamepadIcon, Grid3X3 } from 'lucide-react';
import { encodeUrl, initScramjet } from '@/lib/scramjet';

interface EmbeddedGame { name: string; description: string; url: string; accent: string }

const EMBEDDED_GAMES: EmbeddedGame[] = [
  { name: 'Selenite', description: 'A large collection of browser games and projects.', url: 'https://selenite.cc/projects.html', accent: '#9bd3ff' },
  { name: 'GN Math', description: 'Quick-play games and browser challenges.', url: 'https://gn-math.dev/', accent: '#4ade80' },
  { name: 'UBG Hyper', description: 'A broad catalog of racing, action, and puzzle games.', url: 'https://ubghyper.github.io', accent: '#fbbf24' },
  { name: 'Classroom Center', description: 'A rotating collection of lightweight browser classics.', url: 'https://sites.google.com/classroom.center/view-1?pli=1&authuser=0', accent: '#38bdf8' },
];

export default function GamesView() {
  const [activeGame, setActiveGame] = useState<EmbeddedGame>(EMBEDDED_GAMES[0]);
  const [gameUrl, setGameUrl] = useState(EMBEDDED_GAMES[0].url);
  const [proxyFailed, setProxyFailed] = useState(false);

  useEffect(() => {
    initScramjet().then(() => setGameUrl(encodeUrl(activeGame.url))).catch(() => setProxyFailed(true));
  }, [activeGame.url]);

  const selectGame = (game: EmbeddedGame) => {
    setActiveGame(game);
    setGameUrl(game.url);
    setProxyFailed(false);
    initScramjet().then(() => setGameUrl(encodeUrl(game.url))).catch(() => setProxyFailed(true));
  };

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3"><div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><GamepadIcon size={25} style={{ color: 'var(--accent)' }} /></div><div><h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Game library</h1><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Play curated browser games without leaving aero.</p></div></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{EMBEDDED_GAMES.map((game) => <button key={game.name} onClick={() => selectGame(game)} className="text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5" style={{ background: 'var(--bg-secondary)', border: `1px solid ${activeGame.name === game.name ? game.accent : 'var(--border)'}` }}><div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold" style={{ background: `${game.accent}22`, color: game.accent }}>{game.name.slice(0, 1)}</div><h2 className="mt-4 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{game.name}</h2><p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>{game.description}</p></button>)}</div>
        <section className="overflow-hidden rounded-2xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}><Grid3X3 size={17} style={{ color: activeGame.accent }} /><div><h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{activeGame.name}</h2><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{proxyFailed ? 'Direct browsing mode' : activeGame.description}</p></div></div><iframe key={gameUrl} src={gameUrl} title={`${activeGame.name} games`} className="w-full h-[min(72vh,760px)] border-0 bg-white" allow="fullscreen; autoplay; gamepad" referrerPolicy="strict-origin-when-cross-origin" /></section>
      </div>
    </div>
  );
}
