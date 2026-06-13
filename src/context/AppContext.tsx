import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppContextType {
  eventId: string;
  setEventId: (id: string) => void;
  serverUrl: string;
  setServerUrl: (url: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_SERVER_URL = 'https://www.aurapixel.live/rsvp';

/**
 * Normalize the server URL so requests hit the canonical host directly.
 * Bare `aurapixel.live` 307-redirects to `www.aurapixel.live`, and that
 * cross-host redirect makes axios throw "Network Error" (CORS on web /
 * unfollowed redirect on native). Upgrading to www avoids the redirect.
 * Also strips trailing slashes.
 */
function normalizeServerUrl(url: string): string {
  const trimmed = (url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_SERVER_URL;
  return trimmed.replace(/^https?:\/\/aurapixel\.live/i, 'https://www.aurapixel.live');
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [eventId, setEventIdState] = useState('');
  const [serverUrl, setServerUrlState] = useState(DEFAULT_SERVER_URL);

  useEffect(() => {
    // Load saved settings
    const loadSettings = async () => {
      try {
        const savedEventId = await AsyncStorage.getItem('eventId');
        const savedServerUrl = await AsyncStorage.getItem('serverUrl');

        if (savedEventId) setEventIdState(savedEventId);
        if (savedServerUrl) {
          // Auto-upgrade any previously-saved non-www value so existing
          // installs self-correct without the user re-entering it.
          const normalized = normalizeServerUrl(savedServerUrl);
          setServerUrlState(normalized);
          if (normalized !== savedServerUrl) {
            await AsyncStorage.setItem('serverUrl', normalized);
          }
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const setEventId = async (id: string) => {
    const clean = id.trim();
    setEventIdState(clean);
    await AsyncStorage.setItem('eventId', clean);
  };

  const setServerUrl = async (url: string) => {
    const clean = normalizeServerUrl(url);
    setServerUrlState(clean);
    await AsyncStorage.setItem('serverUrl', clean);
  };

  return (
    <AppContext.Provider value={{ eventId, setEventId, serverUrl, setServerUrl }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
