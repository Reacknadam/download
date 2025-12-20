import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD_cJ0z0QysF-w4f0FsUXIQS4CHQndcM5Y",
  authDomain: "jimmy-school.firebaseapp.com",
  projectId: "jimmy-school",
  storageBucket: "jimmy-school.firebasestorage.app",
  messagingSenderId: "700597241185",
  appId: "1:700597241185:web:8e835f6d0b322aa6f2b120",
  measurementId: "G-8VZRH4WF0Q"
};

// Initialize Firebase (Singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use initializeFirestore to ensure settings are applied and service is registered
// This often fixes "Service firestore is not available" on CDNs
const db = initializeFirestore(app, {}); 
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth };