import { useState, useCallback, useMemo } from 'react';
import { Github, Copy, Check, Download, Info, Link2, FileText, Play } from 'lucide-react';

interface ParsedRepo { owner: string; repo: string }
interface LinkSpec { provider: ProviderId; template: string; owner: string; repo: string; branch: string; path: string; count: number }
type ProviderId = 'cdn' | 'fastly' | 'gcore' | 'quantil' | 'origin' | 'custom' | 'google' | 's3';
interface Provider { id: ProviderId; label: string; host: string; description: string }

const PROVIDERS: Provider[] = [
  { id: 'cdn', label: 'jsDelivr CDN', host: 'cdn.jsdelivr.net', description: 'Primary jsDelivr endpoint' },
  { id: 'fastly', label: 'Fastly jsDelivr', host: 'fastly.jsdelivr.net', description: 'Fastly-backed endpoint' },
  { id: 'gcore', label: 'Gcore jsDelivr', host: 'gcore.jsdelivr.net', description: 'Gcore-backed endpoint' },
  { id: 'quantil', label: 'Quantil jsDelivr', host: 'quantil.jsdelivr.net', description: 'Quantil-backed endpoint' },
  { id: 'origin', label: 'Origin jsDelivr', host: 'origin.jsdelivr.net', description: 'Origin endpoint' },
  { id: 'custom', label: 'Custom template', host: 'your-domain.example', description: 'Use placeholders in any HTTPS URL' },
  { id: 'google', label: 'Google Apps Script', host: 'script.google.com', description: 'Paste a deployment URL template' },
  { id: 's3', label: 'Amazon S3', host: 's3.amazonaws.com', description: 'Paste an S3 URL template' },
];
const MAX_COUNT = 5_000_000;
const GITHUB_REPO_REGEX = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+))?(?:\/(.+))?$/;

function parseGithubInput(input: string): ParsedRepo | null {
  const match = input.trim().match(GITHUB_REPO_REGEX);
  if (!match || !match[1] || !match[2]) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

function replaceTokens(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(owner|repo|branch|path|n)\}/g, (_, token: string) => String(values[token] ?? ''));
}

function jsdelivrTemplate(host: string): string {
  return `https://${host}/gh/{owner}/{repo}@{branch}/{path}`;
}

function makeUrl(spec: LinkSpec, index: number): string {
  const url = replaceTokens(spec.template, { owner: spec.owner, repo: spec.repo, branch: spec.branch, path: spec.path, n: index });
  const jsdelivrProviders: ProviderId[] = ['cdn', 'fastly', 'gcore', 'quantil', 'origin'];
  if (jsdelivrProviders.includes(spec.provider) && spec.count > 1 && !spec.path.includes('{n}')) {
    return `${url}${url.includes('?') ? '&' : '?'}v=${index + 1}`;
  }
  return url;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}

async function exportSpec(spec: LinkSpec) {
  const pickerWindow = window as Window & { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable: () => Promise<{ write: (value: string) => Promise<void>; close: () => Promise<void> }> }> };
  if (pickerWindow.showSaveFilePicker) {
    const handle = await pickerWindow.showSaveFilePicker({ suggestedName: `${spec.provider}-links.txt`, types: [{ description: 'Text file', accept: { 'text/plain': ['.txt'] } }] });
    const writable = await handle.createWritable();
    for (let start = 0; start < spec.count; start += 10_000) {
      const end = Math.min(start + 10_000, spec.count);
      let chunk = '';
      for (let index = start; index < end; index += 1) chunk += `${makeUrl(spec, index)}\n`;
      await writable.write(chunk);
    }
    await writable.close();
    return;
  }
  const chunks: string[] = [];
  for (let start = 0; start < spec.count; start += 10_000) {
    const end = Math.min(start + 10_000, spec.count);
    let chunk = '';
    for (let index = start; index < end; index += 1) chunk += `${makeUrl(spec, index)}\n`;
    chunks.push(chunk);
  }
  downloadFile(chunks.join(''), `${spec.provider}-links.txt`, 'text/plain');
}

export default function JsdelivrGenerator() {
  const [provider, setProvider] = useState<ProviderId>('cdn');
  const [repoInput, setRepoInput] = useState('');
  const [branch, setBranch] = useState('main');
  const [path, setPath] = useState('');
  const [template, setTemplate] = useState('');
  const [countInput, setCountInput] = useState('1');
  const [spec, setSpec] = useState<LinkSpec | null>(null);
  const [preview, setPreview] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedProvider = PROVIDERS.find((item) => item.id === provider) || PROVIDERS[0];

  const activeTemplate = useMemo(() => {
    if (provider === 'custom' || provider === 'google' || provider === 's3') return template;
    return jsdelivrTemplate(selectedProvider.host);
  }, [provider, selectedProvider.host, template]);

  const handleGenerate = useCallback(() => {
    setError(null);
    const count = Number.parseInt(countInput, 10);
    if (!Number.isSafeInteger(count) || count < 1 || count > MAX_COUNT) { setError(`Choose a quantity from 1 to ${MAX_COUNT.toLocaleString()}.`); return; }
    const parsed = parseGithubInput(repoInput);
    if (!parsed) { setError('Enter a valid GitHub repository such as owner/repo.'); return; }
    const cleanPath = path.trim();
    if (!cleanPath) { setError('Enter a file path. Use {n} where each generated link should receive a different number.'); return; }
    if ((provider === 'custom' || provider === 'google' || provider === 's3') && !template.trim()) { setError('Enter an HTTPS URL template before generating links.'); return; }
    const nextSpec: LinkSpec = { provider, template: activeTemplate.trim(), owner: parsed.owner, repo: parsed.repo, branch: branch.trim() || 'main', path: cleanPath, count };
    try { const sample = new URL(makeUrl(nextSpec, 0)); if (sample.protocol !== 'https:') throw new Error(); } catch { setError('Your template must produce a valid HTTPS URL.'); return; }
    setSpec(nextSpec);
    setPreview(Array.from({ length: Math.min(count, 50) }, (_, index) => makeUrl(nextSpec, index)));
  }, [activeTemplate, branch, countInput, path, provider, repoInput, template]);

  const handleCopy = useCallback(async () => { if (!preview.length) return; await navigator.clipboard.writeText(preview.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); }, [preview]);
  const handleExport = useCallback(async () => { if (spec) await exportSpec(spec); }, [spec]);

  return <div className="h-full overflow-y-auto p-6 animate-fade-in" style={{ background: 'var(--bg-primary)' }}><div className="max-w-3xl mx-auto space-y-5"><div className="flex items-center gap-3"><Github size={28} style={{ color: 'var(--accent)' }} /><div><h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Link Generator</h1><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Create one link or stream millions of links to a file.</p></div></div>
    <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><div className="flex items-start gap-2"><Info size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /><div className="space-y-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}><p><strong style={{ color: 'var(--text-primary)' }}>Every jsDelivr batch is unique.</strong> Use {'{n}'} for different file paths; otherwise the generator adds a unique version query to each CDN URL. For example, <code style={{ color: 'var(--accent)' }}>files/{'{n}'}.js</code> creates numbered links.</p><p>Exports are streamed in chunks when your browser supports it, so millions of links are not rendered into the page.</p><p>Custom, Google Apps Script, and S3 providers accept {'{owner}'}, {'{repo}'}, {'{branch}'}, {'{path}'}, and {'{n}'} placeholders.</p></div></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Provider</label><select value={provider} onChange={(event) => setProvider(event.target.value as ProviderId)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}>{PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div><label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Quantity</label><input type="number" min="1" max={MAX_COUNT} value={countInput} onChange={(event) => setCountInput(event.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} /></div></div>
    {(provider === 'custom' || provider === 'google' || provider === 's3') && <div><label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>HTTPS URL template</label><input value={template} onChange={(event) => setTemplate(event.target.value)} placeholder={provider === 'google' ? 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec?n={n}' : provider === 's3' ? 'https://s3.amazonaws.com/BUCKET/{path}' : 'https://example.com/{owner}/{repo}/{path}?n={n}'} className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} /></div>}
    <div className="space-y-3 p-5 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><div><label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>GitHub repository</label><input value={repoInput} onChange={(event) => setRepoInput(event.target.value)} placeholder="owner/repo or GitHub URL" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} /></div><div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Branch or tag</label><input value={branch} onChange={(event) => setBranch(event.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} /></div><div><label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>File path</label><input value={path} onChange={(event) => setPath(event.target.value)} placeholder="dist/file-{n}.js" className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }} /></div></div></div>
    {error && <p className="text-sm" style={{ color: '#f43f5e' }}>{error}</p>}<button onClick={handleGenerate} className="w-full py-2.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}><Play size={15} className="inline mr-2" />Generate preview</button>
    {spec && <div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{spec.count.toLocaleString()} links ready</h3><p className="text-xs" style={{ color: 'var(--text-muted)' }}>Showing the first {preview.length}; export downloads the complete set.</p></div><div className="flex gap-2"><button onClick={() => void handleCopy()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{copied ? <Check size={14} /> : <Copy size={14} />}Copy preview</button><button onClick={() => void handleExport()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}><Download size={14} />Export all</button></div></div><div className="space-y-2">{preview.map((url) => <div key={url} className="p-3 rounded-xl text-xs font-mono break-all" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--accent)' }}>{url}</div>)}</div></div>}
  </div></div>;
}
