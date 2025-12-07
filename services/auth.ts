import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

const SUPABASE_URL = 'https://fsbehwyhsfojqxrfczdu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYmVod3loc2ZvanF4cmZjemR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAwNzIwNDcsImV4cCI6MjA2NTY0ODA0N30.UxS0A-NkWE61m-8fWYxtRtBtu3t5bvTITmXmfgUvt0Q';

async function supabaseRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export const authService = {
  async signUp(email: string, password: string, displayName: string): Promise<User> {
    // 1. Create Supabase User
    const signupRes = await supabaseRequest<{ user: { id: string }, session: any }>(`/auth/v1/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { displayName } }),
    });

    const uid = signupRes.user?.id;
    if (!uid) throw new Error("Supabase signup failed to return UID");

    // 2. Create Firebase Profile
    const newUser: User = {
      uid,
      email,
      displayName,
      role: 'student',
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', uid), newUser);
    return newUser;
  },

  async login(email: string, password: string): Promise<{ user: User, token: string }> {
    // 1. Get Token from Supabase
    const tokenRes = await supabaseRequest<{ access_token: string, user: { id: string } }>(`/auth/v1/token?grant_type=password`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const uid = tokenRes.user.id;

    // 2. Get Profile from Firebase
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) {
      throw new Error("Profil utilisateur introuvable.");
    }

    return {
      user: userDoc.data() as User,
      token: tokenRes.access_token
    };
  }
};
