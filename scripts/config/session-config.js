/**
 * session-config.js
 * 
 * This configuration file defines all session-related settings and constraints.
 * It works alongside firebase-config.js to provide specific configuration
 * for session management, including duration limits, file constraints,
 * and capacity thresholds.
 */

export const SESSION_CONFIG = {
    limits: {
        guest: {
            duration: 30 * 60 * 1000,    // 30 minutes in milliseconds
            cooldown: 60 * 60 * 1000,    // 60 minutes in milliseconds
            maxFiles: 30,                // Maximum files per session
            maxSize: 150 * 1024 * 1024   // 150MB total size limit
        }
    },
    
    validation: {
        file: {
            maxSize: 5 * 1024 * 1024,    // 5MB per file
            allowedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
            minProcessCount: 3           // Minimum files needed for processing
        }
    },

    messages: {
        session: {
            expired: "Session has expired",
            cooldown: "Session in cooldown period",
            limitReached: "Session limits reached"
        },
        validation: {
            sizeExceeded: "File size exceeds limit",
            invalidType: "Invalid file type",
            insufficientFiles: "Minimum 3 files required"
        }
    }
};