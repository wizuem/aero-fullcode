import { useState, useEffect, useCallback } from 'react';
import { Palette, Shield, User, LogOut, AtSign, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Theme, AccentColor, UserSettings } from '@/types';

interface SettingsUser { id: string; email: string; username: string }
interface SettingsViewProps { theme: Theme; accent: AccentColor; onThemeChange: (theme: Theme) => void; onAccentChange: (accent: AccentColor) => void; user: SettingsUser | null }
const THEMES: { id: Theme; label: string; preview: string }[] = [
  { id: 'dark', label: 'Aero Blue', preview: '#050a14' }, { id: 'light', label: 'Light', preview: '#f8f9fa' }, { id: 'midnight', label: 'Midnight', preview: '#050814' }, { id: 'sunset', label: 'Sunset', preview: '#1a0a0a' }, { id: 'forest', label: 'Forest', preview: '#0a1410' },
];
const ACCENTS: { id: AccentColor; label: string; color: string }[] = [
  { id: 'blue', label: 'Aero Blue', color: '#2d8cff' }, { id: 'cyan', label: 'Cyan', color: '#06b6d4' }, { id: 'emerald', label: 'Emerald', color: '#10b981' }, { id: 'amber', label: 'Amber', color: '#f59e0b' }, { id: 'rose', label: 'Rose', color: '#f43f5e' },
];
type AuthMode = 'signin' | 'signup';

export default function SettingsView({ theme, accent, onThemeChange, onAccentChange, user }: SettingsViewProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [privacySettings, setPrivacySettings] = useState<UserSettings>({ theme: 'dark', accent_color: 'blue', privacy_clear_on_exit: false, privacy_block_trackers: true, privacy_dnt: true });
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      const settings = data as UserSettings;
      setPrivacySettings(settings);
      onThemeChange(settings.theme);
      onAccentChange(settings.accent_color);
    });
  }, [onAccentChange, onThemeChange, user]);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthLoading(true); setAuthError(null); setAuthSuccess(null);
    const normalizedUsername = username.trim().toLowerCase();
    try {
      if (authMode === 'signup') {
        if (!/^[a-z0-9][a-z0-9_.-]{2,29}$/.test(normalizedUsername)) throw new Error('Username must be 3–30 characters using letters, numbers, dots, dashes, or underscores.');
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { username: normalizedUsername } } });
        if (error) throw error;
        setAuthSuccess('Account created. You are now signed in.');
      } else {
        const { data: loginEmail, error: lookupError } = await supabase.rpc('lookup_email_by_username', { p_username: normalizedUsername });
        if (lookupError || typeof loginEmail !== 'string') throw new Error('Invalid username or password.');
        const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
        if (error) throw new Error('Invalid username or password.');
        setAuthSuccess('Signed in successfully.');
      }
      setUsername(''); setEmail(''); setPassword('');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Authentication failed.');
    } finally { setAuthLoading(false); }
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); setAuthSuccess(null); };
  const savePrivacySetting = useCallback(async (key: keyof UserSettings, value: boolean | string) => {
    if (!user) return;
    const updated = { ...privacySettings, [key]: value };
    setPrivacySettings(updated);
    const { error } = await supabase.from('user_settings').upsert({ user_id: user.id, theme: updated.theme, accent_color: updated.accent_color, privacy_clear_on_exit: updated.privacy_clear_on_exit, privacy_block_trackers: updated.privacy_block_trackers, privacy_dnt: updated.privacy_dnt, updated_at: new Date().toISOString() });
    if (!error) { setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000); }
  }, [privacySettings, user]);

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in"><div className="max-w-2xl mx-auto space-y-6">
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}><User size={18} style={{ color: 'var(--accent)' }} /><h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Account</h2></div>
        <div className="p-5">{user ? <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}>{user.username.charAt(0).toUpperCase()}</div><div><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>@{user.username}</p><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.email}</p></div><button onClick={handleSignOut} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}><LogOut size={14} />Sign Out</button></div> : <div>
          <div className="flex gap-2 mb-4"><button onClick={() => setAuthMode('signin')} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: authMode === 'signin' ? 'var(--accent)' : 'var(--bg-tertiary)', color: authMode === 'signin' ? 'var(--bg-primary)' : 'var(--text-secondary)' }}>Sign In</button><button onClick={() => setAuthMode('signup')} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: authMode === 'signup' ? 'var(--accent)' : 'var(--bg-tertiary)', color: authMode === 'signup' ? 'var(--bg-primary)' : 'var(--text-secondary)' }}>Sign Up</button></div>
          <form onSubmit={handleAuth} className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}><AtSign size={16} style={{ color: 'var(--text-muted)' }} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" required className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} /></div>
            {authMode === 'signup' && <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}><AtSign size={16} style={{ color: 'var(--text-muted)' }} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email for account recovery" required className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} /></div>}
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}><Lock size={16} style={{ color: 'var(--text-muted)' }} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required minLength={6} className="flex-1 bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} /><button type="button" onClick={() => setShowPassword(!showPassword)} style={{ color: 'var(--text-muted)' }}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
            {authError && <p className="text-xs" style={{ color: '#f43f5e' }}>{authError}</p>}{authSuccess && <p className="text-xs" style={{ color: 'var(--accent)' }}>{authSuccess}</p>}
            <button type="submit" disabled={authLoading} className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--bg-primary)' }}>{authLoading ? 'Please wait...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}</button>
          </form>
        </div>}</div>
      </section>
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}><Palette size={18} style={{ color: 'var(--accent)' }} /><h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Theme</h2></div><div className="p-5 space-y-4"><div><p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Color theme</p><div className="grid grid-cols-5 gap-2">{THEMES.map((item) => <button key={item.id} onClick={() => { onThemeChange(item.id); if (user) void savePrivacySetting('theme', item.id); }} className="flex flex-col items-center gap-1.5 p-2 rounded-lg" style={{ border: `2px solid ${theme === item.id ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--bg-tertiary)' }}><div className="w-8 h-8 rounded-full" style={{ background: item.preview, border: '1px solid var(--border)' }} /><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</span></button>)}</div></div><div><p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Accent color</p><div className="flex gap-2">{ACCENTS.map((item) => <button key={item.id} onClick={() => { onAccentChange(item.id); if (user) void savePrivacySetting('accent_color', item.id); }} className="flex flex-col items-center gap-1 p-2 rounded-lg" style={{ border: `2px solid ${accent === item.id ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--bg-tertiary)' }}><div className="w-8 h-8 rounded-full" style={{ background: item.color }} /><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</span></button>)}</div></div></div></section>
      <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}><div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}><Shield size={18} style={{ color: 'var(--accent)' }} /><h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Privacy</h2></div><div className="p-5 space-y-4"><PrivacyToggle label="Block trackers" description="Prevent third-party tracking scripts from loading" checked={privacySettings.privacy_block_trackers} onChange={(value) => void savePrivacySetting('privacy_block_trackers', value)} disabled={!user} /><PrivacyToggle label="Send Do Not Track" description="Add a DNT header to outgoing requests" checked={privacySettings.privacy_dnt} onChange={(value) => void savePrivacySetting('privacy_dnt', value)} disabled={!user} /><PrivacyToggle label="Clear data on exit" description="Automatically clear browsing data when you close aero." checked={privacySettings.privacy_clear_on_exit} onChange={(value) => void savePrivacySetting('privacy_clear_on_exit', value)} disabled={!user} />{!user && <p className="text-xs pt-2" style={{ color: 'var(--text-muted)' }}>Sign in to save privacy preferences across devices.</p>}{settingsSaved && <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--accent)' }}><Check size={14} />Settings saved</div>}</div></section>
    </div></div>
  );
}

function PrivacyToggle({ label, description, checked, onChange, disabled }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <div className="flex items-center justify-between gap-4"><div className="flex-1"><p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p></div><button onClick={() => !disabled && onChange(!checked)} disabled={disabled} className="relative w-11 h-6 rounded-full disabled:opacity-40 shrink-0" style={{ background: checked ? 'var(--accent)' : 'var(--bg-hover)' }}><div className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }} /></button></div>;
}
