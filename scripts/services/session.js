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
        usage: {
            files_count: 0,
            total_size: 0
        },
        preview_image: null,  // Will store the URL
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
    
    // Get session data to check if preview exists
    const sessionSnap = await getDoc(sessionRef);
    const sessionData = sessionSnap.data();

    // Update session data
    const updates = {
        "usage.files_count": increment(1),
        "usage.total_size": increment(fileInfo.size)
    };

    // Set preview image if none exists or if this file is smaller
    if (!sessionData.preview_image || fileInfo.size < sessionData.preview_image_size) {
        updates.preview_image = fileInfo.storage_url;
        updates.preview_image_size = fileInfo.size;
    }

    batch.update(sessionRef, updates);
    await batch.commit();
}

async function isSessionActive() {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return true;

    const session = await getSessionData(sessionId);
    if (!session) {
        localStorage.removeItem('sessionId');
        return true;
    }

    const now = new Date();
    const expiresAt = new Date(session.expires_at);
    const cooldownEndsAt = new Date(session.cooldown_ends_at);

    if (now > expiresAt && now > cooldownEndsAt) {
        localStorage.removeItem('sessionId');
        return true;
    }

    return now < expiresAt;
}

/**
 * Gets session data from Firebase
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Session data
 */
async function getSessionData(sessionId) {
    if (!sessionId) return null;
    
    try {
        const sessionRef = doc(db, "sessions", sessionId);
        const sessionSnap = await getDoc(sessionRef);
        
        if (!sessionSnap.exists()) return null;
        
        return sessionSnap.data();
    } catch (error) {
        console.error("Error getting session data:", error);
        return null;
    }
}

export { getSessionData };

// function to check session limits
async function canAddFiles(fileCount, totalSize) {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return {
        withinLimits: true,
        remainingFiles: 30,
        remainingSize: 150 * 1024 * 1024
    };

    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) return {
        withinLimits: true,
        remainingFiles: 30,
        remainingSize: 150 * 1024 * 1024
    };

    const session = sessionSnap.data();
    const currentCount = session.usage.files_count || 0;
    const currentSize = session.usage.total_size || 0;

    return {
        withinLimits: currentCount + fileCount <= 30 && 
                      (currentSize + totalSize) <= 150 * 1024 * 1024,
        remainingFiles: 30 - currentCount,
        remainingSize: (150 * 1024 * 1024) - currentSize
    };
}

export { createSession, checkSession, handleUploadBatch, updateSessionFiles, isSessionActive, canAddFiles };