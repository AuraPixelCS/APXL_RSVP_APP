import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppContextType {
  eventId: string;
  setEventId: (id: string) => void;
  serverUrl: string;
  setServerUrl: (url: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [eventId, setEventIdState] = useState('');
  const [serverUrl, setServerUrlState] = useState('https://aurapixel.live/rsvp');

  useEffect(() => {
    // Load saved settings
    const loadSettings = async () => {
      try {
        const savedEventId = await AsyncStorage.getItem('eventId');
        const savedServerUrl = await AsyncStorage.getItem('serverUrl');
        
        if (savedEventId) setEventIdState(savedEventId);
        if (savedServerUrl) setServerUrlState(savedServerUrl);
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const setEventId = async (id: string) => {
    setEventIdState(id);
    await AsyncStorage.setItem('eventId', id);
  };

  const setServerUrl = async (url: string) => {
    setServerUrlState(url);
    await AsyncStorage.setItem('serverUrl', url);
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
