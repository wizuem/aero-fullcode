import { useEffect, useState } from 'react';
import { Film } from 'lucide-react';
import { encodeUrl, initScramjet } from '@/lib/scramjet';

const MOVIES_URL = 'https://sflix.pw/';

interface MoviesViewProps { onOpenInBrowser: () => void }

export default function MoviesView({ onOpenInBrowser: _onOpenInBrowser }: MoviesViewProps) {
  const [proxyUrl, setProxyUrl] = useState(MOVIES_URL);
  const [proxyFailed, setProxyFailed] = useState(false);

  useEffect(() => {
    initScramjet().then(() => setProxyUrl(encodeUrl(MOVIES_URL))).catch(() => setProxyFailed(true));
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}><Film size={18} style={{ color: 'var(--accent)' }} /><h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Movies</h2></div>
      {proxyFailed && <div className="px-4 py-2 text-xs border-b" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)', background: 'var(--bg-tertiary)' }}>Secure proxy unavailable. Showing the movie site directly.</div>}
      <div className="flex-1 overflow-hidden"><iframe src={proxyUrl} className="w-full h-full border-0" title="Movies" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" /></div>
    </div>
  );
}
