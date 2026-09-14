import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA--pOHMfToRs8r5987I_vIoyF_RpI-19k",
  authDomain: "conduzapp-d9beb.firebaseapp.com",
  projectId: "conduzapp-d9beb",
  storageBucket: "conduzapp-d9beb.firebasestorage.app",
  messagingSenderId: "577954776623",
  appId: "1:577954776623:web:d52a80680c051f0b5ea8da",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);