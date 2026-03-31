/**
 * User Settings — persisted to localStorage
 */

const STORAGE_KEY = 'tn3270-settings';

export interface UserSettings {
  theme: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline';
}

const DEFAULTS: UserSettings = {
  theme: 'green',
  fontSize: 16,
  cursorStyle: 'block',
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
