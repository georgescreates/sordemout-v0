import { db } from '../firebase-config.js';
import { collection, addDoc, getDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { writeBatch, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { updateSessionStatsUI } from '../components/browse-files.js';

async function createSession(type = 'guest') {
    const limits = {
        guest: {
            duration: 30 * 60 * 1000, // 30 minutes
            cooldown: 60 * 60 * 1000, // 60 minutes
            maxFiles: 30,
            maxSize: 150 * 1024 * 1024
        }
    };

    const now = Date.now();
    const session = {
        type,
        created_at: serverTimestamp(),
        expires_at: new Date(now + limits[type].duration),
        cooldown_ends_at: new Date(now + limits[type].duration + limits[type].cooldown),
        usage: {
            files_count: 0,
            total_size: 0
        },
        files: {}
    };

    try {
        const docRef = await addDoc(collection(db, "sessions"), session);
        return docRef.id;
    } catch (error) {
        console.error("Error creating session:", error);
        throw error;
    }
}

// Check if session is valid
async function checkSession(sessionId) {
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) return null;
    
    const session = sessionSnap.data();
    const now = new Date();
    const expiresAt = session.expires_at.toDate();
    
    if (now > expiresAt) {
        localStorage.removeItem('sessionId');  // Clear session from localStorage
        return null;
    }
    
    return session;
}

// Handle batch upload session
async function handleUploadBatch() {
    const currentSessionId = localStorage.getItem('sessionId');
    
    if (currentSessionId) {
        const session = await checkSession(currentSessionId);
        if (session) return currentSessionId;
    }
    
    const sessionId = await createSession();
    localStorage.setItem('sessionId', sessionId);
    await updateSessionStatsUI();
    return sessionId;
}

// Update session with file info
async function updateSessionFiles(sessionId, fileInfo) {
    const sessionRef = doc(db, "sessions", sessionId);
    const batch = writeBatch(db);
    
    // Add file to files collection
    const fileRef = collection(db, "sessions", sessionId, "files");
    batch.set(doc(fileRef), fileInfo);
    
    // Update session counters
    batch.update(sessionRef, {
        "usage.files_count": increment(1),
        "usage.total_size": increment(fileInfo.size)
    });

    await batch.commit();
}

async function isSessionActive() {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return false;

    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) return false;

    const session = sessionSnap.data();
    const now = new Date();
    const expiresAt = session.expires_at.toDate();

    return now < expiresAt;
}

export { createSession, checkSession, handleUploadBatch, updateSessionFiles, isSessionActive };