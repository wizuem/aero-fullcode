export type ViewId = 'home' | 'browser' | 'chat' | 'settings' | 'movies' | 'games' | 'jsdelivr';

export type Theme = 'dark' | 'light' | 'midnight' | 'sunset' | 'forest';

export type AccentColor = 'blue' | 'cyan' | 'emerald' | 'amber' | 'rose';

export interface ChatMessage {
  id: string;
  username: string;
  content: string;
  created_at: string;
}

export interface UserSettings {
  id?: string;
  theme: Theme;
  accent_color: AccentColor;
  privacy_clear_on_exit: boolean;
  privacy_block_trackers: boolean;
  privacy_dnt: boolean;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon: string | null;
  created_at: string;
}

export interface JsdelivrLink {
  url: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}
