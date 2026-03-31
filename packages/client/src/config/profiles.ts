/**
 * Connection Profile Storage
 *
 * Saves and loads connection profiles to/from localStorage.
 */

const STORAGE_KEY = 'tn3270-profiles';

export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  terminalType: string;
  luName: string;
}

export function loadProfiles(): ConnectionProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProfiles(profiles: ConnectionProfile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function addProfile(profile: Omit<ConnectionProfile, 'id'>): ConnectionProfile {
  const profiles = loadProfiles();
  const newProfile: ConnectionProfile = {
    ...profile,
    id: `profile-${Date.now()}`,
  };
  profiles.push(newProfile);
  saveProfiles(profiles);
  return newProfile;
}

export function deleteProfile(id: string): void {
  const profiles = loadProfiles().filter((p) => p.id !== id);
  saveProfiles(profiles);
}
