// Mock Firebase configuration for web
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD_cJ0z0QysF-w4f0FsUXIQS4CHQndcM5Y",
  authDomain: "jimmy-school.firebaseapp.com",
  projectId: "jimmy-school",
  storageBucket: "jimmy-school.firebasestorage.app",
  messagingSenderId: "700597241185",
  appId: "1:700597241185:web:8e835f6d0b322aa6f2b120",
  measurementId: "G-8VZRH4WF0Q"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Export Firestore functions
export {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Export Auth functions
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
export type { User as FirebaseUser } from 'firebase/auth';
