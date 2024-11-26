// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA_dsqLEJfyNZcI0QrNsclSWyP1crI3yEE",
  authDomain: "sordemout-v0.firebaseapp.com",
  projectId: "sordemout-v0",
  storageBucket: "sordemout-v0.firebasestorage.app",
  messagingSenderId: "902550532045",
  appId: "1:902550532045:web:df3d5cd9912733d3ff1e84",
  measurementId: "G-61YFRWTM10"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);