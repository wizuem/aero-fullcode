import { Film, AlertCircle, ExternalLink } from 'lucide-react';

interface MoviesViewProps { onOpenInBrowser: () => void }

const MOVIES_URL = 'https://watch.spencerdevs.xyz/';

export default function MoviesView({ onOpenInBrowser }: MoviesViewProps) {
  return <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}><div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}><Film size={18} style={{ color: 'var(--accent)' }} /><h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Movies</h2><button onClick={onOpenInBrowser} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><ExternalLink size={14} />Open in aero browser</button></div><div className="flex items-center gap-2 px-4 py-2 text-xs shrink-0" style={{ background: 'rgba(45,140,255,0.1)', color: 'var(--accent)' }}><AlertCircle size={14} className="shrink-0" /><span>Movies are embedded from watch.spencerdevs.xyz. Availability depends on that service.</span></div><div className="flex-1 overflow-hidden"><iframe src={MOVIES_URL} className="w-full h-full border-0" title="Movies" allow="fullscreen; autoplay; encrypted-media; picture-in-picture" /></div></div>;
}
