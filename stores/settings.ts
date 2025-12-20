import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  darkMode: boolean;
  notificationsEnabled: boolean;
  language: 'fr' | 'en';
  
  // Actions
  toggleDarkMode: () => void;
  setDarkMode: (darkMode: boolean) => void;
  toggleNotifications: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setLanguage: (language: 'fr' | 'en') => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      notificationsEnabled: false,
      language: 'fr',

      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      
      setDarkMode: (darkMode) => set({ darkMode }),
      
      toggleNotifications: () => set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'settings-storage',
    }
  )
);
