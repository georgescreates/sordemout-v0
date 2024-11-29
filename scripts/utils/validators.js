/**
* validators.js
* 
* Handles all validation logic for files and URLs across the application.
* Includes checks for file types/sizes and URL format verification to ensure
* data integrity and security before processing.
*/

// URL validation patterns for different sources
const urlPatterns = {
    'pin': {
        pattern: /pin\.it|pinterest\.com\/pin/i,
        errorMessage: 'Please provide a valid Pinterest pin link'
    },
    'board': {
        pattern: /pinterest\.com\/.*\/[^/]+(?:\/)?$|pin\.it/i,
        errorMessage: 'Please provide a valid Pinterest board link'
    },
    'unsplash': {
        pattern: /unsplash\.com\/(photos|p|photo)\//i,
        errorMessage: 'Please provide a valid Unsplash image link'
    }
};

/**
 * Validates file type and size
 * @param {File} file - File to validate
 * @returns {Object} Validation result with valid status and error message
 */
function validateFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!validTypes.includes(file.type)) {
        return {
            valid: false,
            error: `Invalid file type: ${file.type}. Only JPG, JPEG and PNG files are allowed.`
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size (${formatFileSize(file.size)}) exceeds 5MB limit`
        };
    }

    return { valid: true };
}

/**
 * Validates URL string format
 * @param {string} string - URL to validate
 * @returns {boolean} Whether URL is valid
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Validates URL against specific type pattern
 * @param {string} url - URL to validate
 * @param {string} type - Type to validate against (pin/board/unsplash)
 * @returns {Object} Validation result with valid status and message
 */
function validateUrlType(url, type) {
    if (!urlPatterns[type]) {
        return { valid: false, message: 'Unsupported URL type' };
    }

    const isValid = urlPatterns[type].pattern.test(url);
    return {
        valid: isValid,
        message: isValid ? '' : urlPatterns[type].errorMessage
    };
}

export { validateFile, isValidUrl, validateUrlType, urlPatterns };