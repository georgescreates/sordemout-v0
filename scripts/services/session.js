import { db } from '../firebase-config.js';
import { collection, addDoc, getDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { writeBatch, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { updateSessionStatsUI } from '../components/browse-files.js';

export const SESSION_TIERS = {
    guest: {
        1: {
            max_files: 20,
            max_size: 100 * 1024 * 1024, // 100MB
            max_file_size: 5 * 1024 * 1024 // 5MB
        },
        2: {
            max_files: 30,
            max_size: 150 * 1024 * 1024,
            max_file_size: 5 * 1024 * 1024,
            cooldown_duration: 30 * 60 * 1000 // 30 minutes for first cooldown
        },
        3: {
            max_files: 40,
            max_size: 200 * 1024 * 1024,
            max_file_size: 5 * 1024 * 1024,
            cooldown_duration: 60 * 60 * 1000 // 1 hour for second cooldown
        }
    }
};

async function createSession(type = 'guest') {
    const session = {
        type,
        created_at: serverTimestamp(),
        expires_at: new Date(now + limits[type].duration),
        tier: {
            current: 1,
            cooldowns_used: 0,
            last_cooldown_at: null,
            current_cooldown_ends_at: null
        },
        limits: {
            ...SESSION_TIERS[type][1]
        },
        usage: {
            files_count: 0,
            total_size: 0
        },
        preview_image: null,
        preview_image_size: 0,
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
    
    const sessionSnap = await getDoc(sessionRef);
    const session = sessionSnap.data();
    
    // Add file to files collection
    const fileRef = collection(db, "sessions", sessionId, "files");
    batch.set(doc(fileRef), fileInfo);
    
    const updates = {
        "usage.files_count": increment(1),
        "usage.total_size": increment(fileInfo.size)
    };

    // Set preview if none exists or if smaller
    if (!session.preview_image || fileInfo.size < session.preview_image_size) {
        updates.preview_image = fileInfo.storage_url;
        updates.preview_image_size = fileInfo.size;
    }
    
    // Check if this update triggers cooldown
    const currentTier = session.tier.current;
    const tierLimits = SESSION_TIERS[session.type][currentTier];
    
    const newFileCount = session.usage.files_count + 1;
    const newTotalSize = session.usage.total_size + fileInfo.size;
    
    if (newFileCount >= tierLimits.max_files || newTotalSize >= tierLimits.max_size) {
        if (currentTier < 3) {
            const now = Date.now();
            const nextTier = SESSION_TIERS[session.type][currentTier + 1];
            
            updates["tier.cooldowns_used"] = increment(1);
            updates["tier.current_cooldown_ends_at"] = new Date(now + nextTier.cooldown_duration);
            updates["tier.last_cooldown_at"] = new Date(now);
        }
    }

    batch.update(sessionRef, updates);
    await batch.commit();
}

async function isSessionActive() {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) return true;

    const session = await getSessionData(sessionId);
    if (!session || !session.tier) {
        localStorage.removeItem('sessionId');
        return true;
    }

    // Check if in cooldown
    const isInCooldown = session.tier.current_cooldown_ends_at && 
                        Date.now() < new Date(session.tier.current_cooldown_ends_at).getTime();

    // Check if maxed out
    const isMaxedOut = session.tier.current === 3 && 
                      (session.usage.files_count >= session.limits.max_files || 
                       session.usage.total_size >= session.limits.max_size);

    return !isInCooldown && !isMaxedOut;
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
        
        const session = sessionSnap.data();
        const now = Date.now();
        
        return {
            ...session,
            cooldown: {
                active: session.tier.current_cooldown_ends_at ? 
                        now < new Date(session.tier.current_cooldown_ends_at).getTime() : false,
                timeRemaining: session.tier.current_cooldown_ends_at ? 
                        new Date(session.tier.current_cooldown_ends_at).getTime() - now : 0
            },
            nextTier: session.tier.current < 3 ? 
                     SESSION_TIERS[session.type][session.tier.current + 1] : null,
            remainingCapacity: {
                files: session.limits.max_files - session.usage.files_count,
                size: session.limits.max_size - session.usage.total_size
            }
        };
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
        remainingFiles: SESSION_TIERS.guest[1].max_files,
        remainingSize: SESSION_TIERS.guest[1].max_size
    };

    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (!sessionSnap.exists()) return null;

    const session = sessionSnap.data();
    const currentTier = session.tier.current;
    const tierLimits = SESSION_TIERS[session.type][currentTier];
    
    // Check if in cooldown
    if (session.tier.current_cooldown_ends_at) {
        const cooldownEnd = new Date(session.tier.current_cooldown_ends_at);
        if (Date.now() < cooldownEnd) {
            return {
                withinLimits: false,
                inCooldown: true,
                cooldownEnds: cooldownEnd,
                remainingFiles: 0,
                remainingSize: 0
            };
        }
    }

    const currentCount = session.usage.files_count || 0;
    const currentSize = session.usage.total_size || 0;
    
    // Check if this upload would trigger cooldown
    const wouldTriggerCooldown = (currentCount + fileCount >= tierLimits.max_files) || 
                                (currentSize + totalSize >= tierLimits.max_size);
    
    return {
        withinLimits: currentCount + fileCount <= tierLimits.max_files && 
                      (currentSize + totalSize) <= tierLimits.max_size,
        remainingFiles: tierLimits.max_files - currentCount,
        remainingSize: tierLimits.max_size - currentSize,
        wouldTriggerCooldown,
        currentTier,
        nextTier: currentTier < 3 ? SESSION_TIERS[session.type][currentTier + 1] : null
    };
}

export { createSession, checkSession, handleUploadBatch, updateSessionFiles, isSessionActive, canAddFiles };