/**
 * formatters.js
 * 
 * This utility file handles data formatting operations across the application.
 * It provides consistent formatting for different data types like file sizes,
 * ensuring uniform data presentation throughout the user interface.
 */

/**
 * Converts bytes to human readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size with units (B, KB, MB)
 */

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export { formatFileSize }