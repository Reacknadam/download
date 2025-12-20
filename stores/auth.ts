import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { authService } from '@/services/auth';

interface AuthState {
  user: User | null;
  isTeacher: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  token: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshUser: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isTeacher: false,
      isAdmin: false,
      isLoading: false,
      token: null,

      setUser: (user) => {
        const isTeacher = !!(
          user?.role === 'teacher' || 
          user?.role === 'admin' || 
          user?.isTeacherVerified === true
        );
        
        const isAdmin = user?.role === 'admin';
        
        set({ user, isTeacher, isAdmin });
      },

      setToken: (token) => set({ token }),

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { user, token } = await authService.login(email, password);
          set({ user, token, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signUp: async (email: string, password: string, displayName: string) => {
        set({ isLoading: true });
        try {
          const user = await authService.signUp(email, password, displayName);
          set({ user, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      signOut: async () => {
        set({ user: null, isTeacher: false, isAdmin: false, token: null });
      },

      deleteAccount: async () => {
        // Implementation would delete from Supabase and Firestore
        set({ user: null, isTeacher: false, isAdmin: false, token: null });
      },

      refreshUser: async () => {
        const { token, user } = get();
        if (!token || !user) return;

        try {
          // Re-fetch user data from Firestore
          // This would need a function to get user by ID
          console.log('Refreshing user data...');
        } catch (error) {
          console.error('Error refreshing user:', error);
        }
      },

      initializeAuth: async () => {
        const { token } = get();
        if (!token) return;

        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser(token);
          if (user) {
            set({ user, isLoading: false });
          } else {
            set({ token: null, user: null, isLoading: false });
          }
        } catch (error) {
          console.error('Error initializing auth:', error);
          set({ token: null, user: null, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
