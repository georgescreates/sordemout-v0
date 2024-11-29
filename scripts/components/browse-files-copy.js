/**
 * browse-files.js
 * 
 * Main file handling file uploads, preview generation, and session management.
 * Coordinates between UI updates, file processing, and Firebase interactions
 * while maintaining application state and user feedback.
 */

import { formatFileSize } from '../utils/formatters.js';
import { validateFile, isValidUrl, validateUrlType, urlPatterns } from '../utils/validators.js';
import { showErrorToast, showStatus, showSuccess, showError, clearStatus, resetStatusMessage } from '../utils/dom-helpers.js';
import { SESSION_CONFIG } from '../config/session-config.js';
import { uploadFileToStorage } from '../services/storage.js';
import { createSession, checkSession, handleUploadBatch, updateSessionFiles, isSessionActive, canAddFiles } from '../services/session.js';

import { db } from '../firebase-config.js';
import { collection, addDoc, getDoc, doc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// =====================================
// State Management
// =====================================

/**
 * Session State - Tracks current session information and status
 */
const sessionState = {
    currentSessionId: null,
    isCreatingSession: false,
    selectedSessionId: null,
    currentSessions: [],
    limits: {
        maxFiles: 50,
        maxSize: 250 * 1024 * 1024,  // 250MB
        duration: 30 * 60 * 1000,     // 30 minutes
        cooldown: 60 * 60 * 1000      // 1 hour
    }
};

/**
 * UI State - Manages interface preferences and display settings
 */
const uiState = {
    isStackMode: false,
    isDropdownOpen: false,
    currentUrlType: 'pin',
    selectedFiles: new Set(),
    previewMode: 'list'  // or 'grid'
};

/**
 * Upload State - Tracks current upload progress and queue
 */
const uploadState = {
    activeUploads: new Map(),  // Tracks ongoing uploads
    queuedFiles: [],           // Files waiting to be processed
    totalProgress: 0,          // Overall upload progress
    uploadedFiles: new Set()   // Successfully uploaded files
};

/**
 * Updates the complete application state
 * @param {Object} newState - New state values to apply
 */
function updateApplicationState(newState) {
    if (newState.session) {
        Object.assign(sessionState, newState.session);
    }
    if (newState.ui) {
        Object.assign(uiState, newState.ui);
    }
    if (newState.upload) {
        Object.assign(uploadState, newState.upload);
    }
    
    // Trigger UI updates based on state changes
    updateUIState();
}

/**
 * Retrieves current state snapshot
 * @returns {Object} Complete current state
 */
function getCurrentState() {
    return {
        session: { ...sessionState },
        ui: { ...uiState },
        upload: { ...uploadState }
    };
}

// =====================================
// Core Operations
// =====================================

/**
 * Processes files after they are selected or dropped
 * @param {File[]} files - Array of files to process
 */
async function handleFiles(files) {
    if (!await isSessionActive()) {
        showErrorToast("Cannot upload files - session inactive or in cooldown");
        return;
    }

    if (!files || files.length === 0) return;

    const previewGrid = document.getElementById('preview-grid');
    const emptyState = document.getElementById('empty-state');

    if (!previewGrid || !emptyState) {
        console.error('Required DOM elements not found');
        return;
    }

    showPreviewSection(previewGrid, emptyState);
    processFiles(files, previewGrid);
}

/**
 * Processes individual files and creates their previews
 * @param {File[]} files - Files to process
 * @param {HTMLElement} previewGrid - Container for previews
 */
function processFiles(files, previewGrid) {
    if (!uiState.isStackMode) {
        previewGrid.innerHTML = '';
    }

    files.forEach(file => {
        const validation = validateFile(file);
        const previewItem = createPreviewItem(file, validation);

        if (validation.valid) {
            addModalClickHandler(previewItem);
            addToPreviewGrid(previewItem, previewGrid);
            simulateUploadProgress(previewItem);
        } else {
            showErrorToast(validation.error);
        }
    });

    updateProcessButtonState();
}

/**
* Handles file upload to Firebase Storage
* @param {File} file - File to upload
* @param {Function} progressCallback - Progress callback
* @returns {Promise} Upload result
*/
function handleFileUpload(previewItem) {
    const progressFill = previewItem.querySelector('[data-status]');
    const statusText = previewItem.querySelector('.status-text');
 
    return uploadFileToStorage(previewItem.file, (progress) => {
        if (progress.status === 'error') {
            progressFill.className = 'h-full bg-red-500 transition-all duration-300';
            statusText.textContent = `Error: ${progress.error}`;
            showErrorToast(`Upload failed: ${progress.error}`);
            return;
        }
 
        progressFill.style.width = `${progress.progress}%`;
        statusText.textContent = `${Math.round(progress.progress)}% • ${progress.speed}MB/s`;
 
        if (progress.status === 'complete') {
            progressFill.className = 'h-full bg-green-500 transition-all duration-300';
            statusText.textContent = 'Upload complete';
            previewItem.uploadedUrl = progress.downloadURL;
        }
    });
 }

/**
 * Updates upload progress UI elements
 * @param {HTMLElement} progressFill - Progress bar element
 * @param {HTMLElement} statusText - Status text element
 * @param {Object} progress - Progress information
 */
function updateUploadProgress(progressFill, statusText, progress) {
    switch(progress.status) {
        case 'uploading':
            progressFill.style.width = `${progress.progress}%`;
            statusText.textContent = `uploading • ${progress.speed}MB/s`;
            break;
        case 'complete':
            progressFill.style.width = '100%';
            progressFill.className = 'h-full bg-green-500 transition-all duration-300';
            statusText.textContent = 'complete';
            break;
        case 'error':
            progressFill.className = 'h-full bg-red-500 transition-all duration-300';
            statusText.textContent = 'failed';
            break;
    }
}

// =====================================
// Session Management
// =====================================

/**
 * Creates or retrieves a session for file uploads
 * @returns {Promise<string>} Session identifier
 */
async function handleUploadSession() {
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

/**
 * Validates session status and limits
 * @param {number} fileCount - Number of files to add
 * @param {number} totalSize - Total size of files in bytes
 * @returns {Promise<Object>} Session capacity information
 */
async function validateSessionCapacity(fileCount, totalSize) {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        return {
            withinLimits: true,
            remainingFiles: sessionState.limits.maxFiles,
            remainingSize: sessionState.limits.maxSize
        };
    }

    const session = await getSessionData(sessionId);
    if (!session) return getDefaultCapacity();

    const currentCount = session.usage.files_count || 0;
    const currentSize = session.usage.total_size || 0;

    return {
        withinLimits: currentCount + fileCount <= sessionState.limits.maxFiles && 
                      (currentSize + totalSize) <= sessionState.limits.maxSize,
        remainingFiles: sessionState.limits.maxFiles - currentCount,
        remainingSize: sessionState.limits.maxSize - currentSize
    };
}

/**
 * Updates session statistics in the UI
 * @returns {Promise<void>}
 */
async function updateSessionStatsUI() {
    const sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
        resetSessionStats();
        return;
    }

    const session = await getSessionData(sessionId);
    if (!session) {
        resetSessionStats();
        return;
    }

    updateSessionTimers(session);
    updateSessionUsage(session);
}

/**
* Updates session usage statistics in UI
* @param {Object} sessionData - Session data with usage info
*/
function updateSessionUsage(sessionData) {
    const filesCount = document.getElementById('session-upload-count-files');
    const sizeCount = document.getElementById('session-upload-count-size');
    
    const usage = sessionData?.usage || { files_count: 0, total_size: 0 };
    
    if (filesCount) {
        filesCount.textContent = `${String(usage.files_count).padStart(2, '0')}/50`;
    }
    
    if (sizeCount) {
        const sizeMB = (usage.total_size / (1024 * 1024)).toFixed(2);
        sizeCount.textContent = `${sizeMB}MB/250MB`;
    }
 }

/**
 * Updates session timers in UI
 * @param {Object} sessionData - Session data with timestamps
 */
function updateSessionTimers(sessionData) {
    if (!sessionData || !sessionData.expires_at || !sessionData.cooldown_ends_at) return;

    const now = new Date();
    const expiresAt = new Date(sessionData.expires_at);
    const cooldownEndsAt = new Date(sessionData.cooldown_ends_at);

    const expiryElement = document.getElementById('session-expires-delay');
    const cooldownElement = document.getElementById('session-cooldown-delay');
    const expiryParagraph = document.getElementById('session-expiry-p');
    const cooldownParagraph = document.getElementById('session-cooldown-p');

    if (now > expiresAt) {
        if (now < cooldownEndsAt) {
            const cooldownLeft = cooldownEndsAt - now;
            const cooldownMinutes = Math.floor(cooldownLeft / 60000);
            const cooldownSeconds = Math.floor((cooldownLeft % 60000) / 1000);
            
            cooldownElement.textContent = `${String(cooldownMinutes).padStart(2, '0')}:${String(cooldownSeconds).padStart(2, '0')}`;
            expiryParagraph.classList.add('hidden');
            cooldownParagraph.classList.remove('hidden');
        } else {
            if (expiryElement) expiryElement.textContent = 'Ready for new session';
            expiryParagraph.classList.remove('hidden');
            cooldownParagraph.classList.add('hidden');
        }
    } else {
        const timeLeft = expiresAt - now;
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
        
        if (expiryElement) {
            expiryElement.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
        }
        expiryParagraph.classList.remove('hidden');
        cooldownParagraph.classList.add('hidden');
    }
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
        
        const data = sessionSnap.data();
        return {
            ...data,
            expires_at: data.expires_at?.toDate(),
            cooldown_ends_at: data.cooldown_ends_at?.toDate()
        };
    } catch (error) {
        console.error("Error getting session data:", error);
        return null;
    }
 }

/**
* Resets session statistics display to default values
* @param {Object} elements - Stats display elements
*/
function resetSessionStats() {
    const elements = {
        filesCount: document.getElementById('session-upload-count-files'),
        sizeCount: document.getElementById('session-upload-count-size'),
        expiryDisplay: document.getElementById('session-expires-delay'),
        cooldownDisplay: document.getElementById('session-cooldown-delay')
    };
 
    if (elements.filesCount) elements.filesCount.textContent = '00/50';
    if (elements.sizeCount) elements.sizeCount.textContent = '0.00MB/250MB';
    if (elements.expiryDisplay) elements.expiryDisplay.textContent = 'Ready for new session';
    if (elements.cooldownDisplay) elements.cooldownDisplay.textContent = '--:--';
 }

// =====================================
// Event Handlers
// =====================================

/**
 * Initializes all event listeners when the DOM loads
 */
function initializeEventHandlers() {
    // File Input Handlers
    initializeFileInputHandlers();
    
    // Drag and Drop Handlers
    initializeDragDropHandlers();
    
    // Session Handlers
    initializeSessionHandlers();
    
    // UI Control Handlers
    initializeUIControlHandlers();
}

/**
 * Sets up file input and upload related event handlers
 */
function initializeFileInputHandlers() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/png,image/jpeg,image/jpg';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    fileInput.addEventListener('change', async (e) => {
        if (!await isSessionActive()) {
            showErrorToast("Cannot upload files - session inactive or in cooldown");
            return;
        }
        const files = Array.from(e.target.files);
        await handleFiles(files);
    });

    const dropZone = document.getElementById('drop-zone');
    dropZone.addEventListener('click', () => fileInput.click());
}

/**
 * Sets up drag and drop event handlers
 */
function initializeDragDropHandlers() {
    const dropZone = document.getElementById('drop-zone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('bg-silver-chalice-50');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('bg-silver-chalice-50');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (!await isSessionActive()) {
            showErrorToast("Cannot upload files - session inactive or in cooldown");
            return;
        }
        dropZone.classList.remove('bg-silver-chalice-50');
        const files = Array.from(e.dataTransfer.files);
        await handleFiles(files);
    });
}

/**
 * Sets up session management related event handlers
 */
function initializeSessionHandlers() {
    const processButton = document.getElementById('upl-client-firebase-btn');
    processButton.addEventListener('click', handleProcessButtonClick);

    // Update session stats periodically
    setInterval(updateSessionStatsUI, 1000);
    setInterval(updateUIState, 10000);
}

/**
 * Handles process button click event
 */
async function handleProcessButtonClick() {
    if (!await isSessionActive()) {
        showErrorToast("Cannot process files - session has expired");
        return;
    }

    const selectedItems = document.querySelectorAll('.preview-item input[type="checkbox"]:checked');
    if (selectedItems.length < SESSION_CONFIG.validation.file.minProcessCount) {
        showErrorToast(SESSION_CONFIG.messages.validation.insufficientFiles);
        return;
    }

    try {
        await processBatchUpload(Array.from(selectedItems).map(checkbox => checkbox.closest('.preview-item')));
    } catch (error) {
        ErrorHandler.handleUploadError(error);
    }
}

/**
* Processes batch upload of selected files
* @param {HTMLElement[]} previewItems - Array of preview items to process
*/
async function processBatchUpload(previewItems) {
    try {
        const sessionId = await handleUploadBatch();
        
        const uploadPromises = previewItems.map(previewItem => {
            const progressFill = previewItem.querySelector('[data-status]');
            const statusText = previewItem.querySelector('.status-text');
            
            progressFill.style.width = '0%';
            progressFill.className = 'h-full bg-blue-500 transition-all duration-300';
            statusText.textContent = 'starting upload...';
            
            return handleFileUpload(previewItem);
        });
 
        await Promise.all(uploadPromises);
        await updateSessionStatsUI();
 
        // Clear preview grid after successful upload
        const previewGrid = document.getElementById('preview-grid');
        const emptyState = document.getElementById('empty-state');
        previewGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        previewGrid.classList.add('hidden');
    } catch (error) {
        throw error;
    }
 }

/**
 * Handles select all checkbox change event
 */
function handleSelectAllChange(e) {
    const previewItems = document.querySelectorAll('.preview-item');
    
    previewItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const statusText = item.querySelector('.status-text');
        
        if (!checkbox.disabled) {
            checkbox.checked = e.target.checked;
            if (e.target.checked) {
                setReadyStatus(statusText, item);
            } else {
                setAbortedStatus(statusText, item);
            }
        }
    });
    
    updateProcessButtonState();
}

/**
 * Sets up UI control event handlers
 */
function initializeUIControlHandlers() {
    // Stack Mode Toggle
    const stackModeContainer = document.querySelector('#stack-mode-container');
    const stackModeToggle = document.querySelector('#stack-mode-toggle');

    stackModeContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        stackModeToggle.checked = !stackModeToggle.checked;
        uiState.isStackMode = stackModeToggle.checked;
        updateStackModeAppearance(stackModeToggle);
    });

    // Select All Functionality
    const selectAllCheckbox = document.getElementById('select-all');
    selectAllCheckbox.addEventListener('change', handleSelectAllChange);

    // Modal Handlers
    initializeModalHandlers();
}

/**
* Updates stack mode toggle appearance
* @param {HTMLElement} toggle - Stack mode toggle element
*/
function updateStackModeAppearance(toggle) {
    toggle.nextElementSibling.classList.toggle('bg-lochmara-600', uiState.isStackMode);
 }

/**
 * Sets up modal related event handlers
 */
function initializeModalHandlers() {
    const modal = document.getElementById('preview-modal');
    const closeBtn = document.getElementById('close-modal');

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closePreviewModal();
    });

    closeBtn.addEventListener('click', closePreviewModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closePreviewModal();
        }
    });
}

// Initialize all handlers when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    initializeEventHandlers();
    updateSessionStatsUI();
    updateProcessButtonState();
    updateUIState();
});

// =====================================
// UI Updates
// =====================================

/**
 * Updates the complete UI state based on current application state
 */
async function updateUIState() {
    const elements = {
        dropZone: document.getElementById('drop-zone'),
        processButton: document.getElementById('upl-client-firebase-btn'),
        processText: document.getElementById('process-text'),
        selectedSessionText: document.getElementById('selected-session-text')
    };

    const isActive = await isSessionActive();
    const sessionLimits = isActive ? await validateSessionCapacity(0, 0) : null;
    const uiConditions = determineUIConditions(isActive, sessionLimits);

    updateDropZoneState(elements.dropZone, uiConditions);
    updateProcessButtonState(elements.processButton, elements.processText, uiConditions);
    updateSessionDisplay(elements.selectedSessionText, uiConditions);
}

/**
* Updates session display information
* @param {HTMLElement} displayElement - Session display element
* @param {Object} conditions - Current UI conditions
*/
function updateSessionDisplay(displayElement, conditions) {
    if (!displayElement) return;
    
    displayElement.textContent = conditions.isActive 
        ? (conditions.withinLimits ? 'Active Session' : 'Session Limit Reached')
        : 'Session Inactive';
 }

/**
 * Updates the preview section with new files
 */
function updatePreviewSection(files) {
    const previewGrid = document.getElementById('preview-grid');
    const emptyState = document.getElementById('empty-state');

    if (!files || files.length === 0) {
        showEmptyState(emptyState, previewGrid);
        return;
    }

    showPreviewGrid(previewGrid, emptyState);
    updatePreviewItems(files, previewGrid);
}

/**
 * Updates the process button state based on selected files
 */
function updateProcessButtonState() {
    const processButton = document.getElementById('upl-client-firebase-btn');
    const processText = document.getElementById('process-text');
    
    if (!processButton || !processText) return;

    const selectedCount = getSelectedFilesCount();
    
    processText.textContent = selectedCount > 0 
        ? `Process ${selectedCount} Selected ${selectedCount === 1 ? 'File' : 'Files'}`
        : 'Process Selected Files';

    const isEnabled = selectedCount >= 3;
    toggleProcessButton(processButton, isEnabled);
}

/**
* Gets count of selected files
* @returns {number} Number of selected files
*/
function getSelectedFilesCount() {
    return document.querySelectorAll('.preview-item input[type="checkbox"]:checked').length;
 }

/**
 * Updates session statistics display
 */
async function updateSessionStats() {
    const sessionId = localStorage.getItem('sessionId');
    const statsElements = {
        filesCount: document.getElementById('session-upload-count-files'),
        sizeCount: document.getElementById('session-upload-count-size'),
        expiryDisplay: document.getElementById('session-expires-delay'),
        cooldownDisplay: document.getElementById('session-cooldown-delay')
    };

    const sessionData = await getSessionData(sessionId);
    updateStatsDisplay(statsElements, sessionData);
}

/**
 * Updates preview item status and appearance
 */
function updatePreviewItemStatus(previewItem, status, message) {
    const statusElements = {
        progressFill: previewItem.querySelector('[data-status]'),
        statusText: previewItem.querySelector('.status-text'),
        checkbox: previewItem.querySelector('input[type="checkbox"]')
    };

    applyStatusStyles(statusElements, status, message);
    updateSelectAllState();
    updateProcessButtonState();
}

// =====================================
// UI Helper Functions
// =====================================

/**
 * Determines UI conditions based on session state
 * @param {boolean} isActive - Whether session is active
 * @param {Object} sessionLimits - Current session limits
 * @returns {Object} UI state conditions
 */
function determineUIConditions(isActive, sessionLimits) {
    if (!isActive) {
        return {
            isActive: false,
            withinLimits: false,
            message: {
                title: 'Upload disabled during cooldown',
                subtitle: 'Check timer for next available session'
            }
        };
    }

    if (!sessionLimits.withinLimits) {
        const remainingMB = (sessionLimits.remainingSize / (1024 * 1024)).toFixed(2);
        return {
            isActive: true,
            withinLimits: false,
            message: {
                title: 'Session limits reached',
                remaining: `Files: ${sessionLimits.remainingFiles}, Space: ${remainingMB}MB`
            }
        };
    }

    return { isActive: true, withinLimits: true };
}

/**
 * Updates drop zone appearance based on state
 * @param {HTMLElement} dropZone - Drop zone element
 * @param {Object} conditions - Current UI conditions
 */
function updateDropZoneState(dropZone, conditions) {
    if (!conditions.isActive || !conditions.withinLimits) {
        dropZone.classList.add('opacity-50', 'pointer-events-none');
        dropZone.innerHTML = generateDropZoneMessage(conditions.message);
    } else {
        dropZone.classList.remove('opacity-50', 'pointer-events-none');
        restoreDropZoneContent(dropZone);
    }
}

function generateDropZoneMessage(message) {
    if (message.subtitle) {
        return `
            <div class="text-silver-chalice-400 text-center">
                <p>${message.title}</p>
                <p class="text-sm">${message.subtitle}</p>
            </div>
        `;
    } else if (message.remaining) {
        return `
            <div class="text-silver-chalice-400 text-center">
                <p>${message.title}</p>
                <p class="text-sm">${message.remaining}</p>
            </div>
        `;
    } else {
        return `
            <div class="text-silver-chalice-400 text-center">
                <p>${message.title}</p>
            </div>
        `;
    }
 }

/**
* Generates drop zone message based on conditions
* @param {Object} message - Message conditions
* @returns {string} HTML for drop zone message
*/
function restoreDropZoneContent(dropZone) {
    dropZone.className = "w-full h-[600px] overflow-y-auto flex flex-col space-y-4";
    dropZone.innerHTML = `
        <div id="drop-zone" class="rounded-sm border-2 border-silver-chalice-300 border-dashed p-8 h-[600px] flex flex-col items-center justify-center gap-2">
            <div class="text-silver-chalice-400 text-center">
                <p>Supported files: <span class="font-bold text-lochmara-950">png, jpg, jpeg</span></p>
                <p>Maximum file size: <span class="font-bold text-lochmara-950">5MB</span></p>
            </div>
            <div class="flex gap-x-4 items-center mt-4">
                <p>Browse Files</p>
                <p>or drag and drop here ...</p>
            </div>
        </div>
    `;
}

/**
 * Updates stats display with current session data
 * @param {Object} elements - Stats display elements
 * @param {Object} sessionData - Current session data
 */
function updateStatsDisplay(elements, sessionData) {
    if (!sessionData) {
        resetStatsDisplay(elements);
        return;
    }

    const { filesCount, sizeCount, expiryDisplay, cooldownDisplay } = elements;
    const usage = sessionData.usage || { files_count: 0, total_size: 0 };

    filesCount.textContent = `${String(usage.files_count).padStart(2, '0')}/${sessionState.limits.maxFiles}`;
    sizeCount.textContent = `${(usage.total_size / (1024 * 1024)).toFixed(2)}MB/${sessionState.limits.maxSize / (1024 * 1024)}MB`;
    
    updateTimerDisplays(expiryDisplay, cooldownDisplay, sessionData);
}

/**
* Updates session timer displays
* @param {HTMLElement} expiryDisplay - Expiry timer element
* @param {HTMLElement} cooldownDisplay - Cooldown timer element
* @param {Object} sessionData - Session data
*/
function updateTimerDisplays(expiryDisplay, cooldownDisplay, sessionData) {
    const now = new Date();
    const expiresAt = sessionData.expires_at;
    const cooldownEndsAt = sessionData.cooldown_ends_at;
 
    if (now > expiresAt) {
        if (now < cooldownEndsAt) {
            const cooldownLeft = cooldownEndsAt - now;
            const cooldownMinutes = Math.floor(cooldownLeft / 60000);
            const cooldownSeconds = Math.floor((cooldownLeft % 60000) / 1000);
            cooldownDisplay.textContent = `${String(cooldownMinutes).padStart(2, '0')}:${String(cooldownSeconds).padStart(2, '0')}`;
        } else {
            expiryDisplay.textContent = 'Ready for new session';
        }
    } else {
        const timeLeft = expiresAt - now;
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
        expiryDisplay.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
    }
 }

/**
 * Toggles process button state
 * @param {HTMLElement} button - Process button element
 * @param {boolean} enabled - Whether button should be enabled
 */
function toggleProcessButton(button, enabled) {
    button.disabled = !enabled;
    button.classList.toggle('opacity-50', !enabled);
    button.classList.toggle('cursor-not-allowed', !enabled);
    button.title = enabled ? '' : 'Select at least 3 files to process';
}

/**
 * Applies status styles to preview item
 * @param {Object} elements - Preview item elements
 * @param {string} status - Current status
 * @param {string} message - Status message
 */
function applyStatusStyles(elements, status, message) {
    const { progressFill, statusText, checkbox } = elements;
    const styles = getStatusStyles(status);

    progressFill.className = styles.progressClass;
    progressFill.setAttribute('data-status', status);
    statusText.innerHTML = styles.getStatusHTML(message);

    if (checkbox) {
        checkbox.checked = status === 'ready';
        checkbox.disabled = status === 'rejected';
    }
}

// =====================================
// Modal Management
// =====================================

/**
 * Handles modal functionality for file previews
 */
class PreviewModal {
    constructor() {
        this.modal = document.getElementById('preview-modal');
        this.image = document.getElementById('modal-image');
        this.filename = document.getElementById('modal-filename');
        this.progress = document.getElementById('modal-progress');
        this.status = document.getElementById('modal-status');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.close();
            }
        });
    }

    open(previewItem) {
        const img = previewItem.querySelector('img');
        const filenameEl = previewItem.querySelector('.text-base.font-bold');
        const progressBar = previewItem.querySelector('.h-1.bg-gray-200').cloneNode(true);
        const statusEl = previewItem.querySelector('.status-text').parentElement.cloneNode(true);

        this.image.src = img.src;
        this.filename.textContent = filenameEl.textContent;
        this.progress.innerHTML = '';
        this.progress.appendChild(progressBar);
        this.status.innerHTML = '';
        this.status.appendChild(statusEl);
        
        this.modal.classList.remove('hidden');
    }

    close() {
        this.modal.classList.add('hidden');
    }
}

const previewModal = new PreviewModal();

/**
* Closes the preview modal
*/
function closePreviewModal() {
    const modal = document.getElementById('preview-modal');
    modal.classList.add('hidden');
 }

// =====================================
// Error Handling
// =====================================

/**
 * Centralized error handler for different types of errors
 */
class ErrorHandler {
    static handle(error, context) {
        console.error(`Error in ${context}:`, error);

        const errorMessages = {
            upload: 'Failed to upload file',
            session: 'Session error occurred',
            validation: 'File validation failed',
            firebase: 'Firebase operation failed',
            unknown: 'An unexpected error occurred'
        };

        const message = errorMessages[context] || errorMessages.unknown;
        showErrorToast(`${message}: ${error.message}`);
    }

    static handleUploadError(error) {
        this.handle(error, 'upload');
        return null;
    }

    static handleSessionError(error) {
        this.handle(error, 'session');
        return false;
    }

    static handleValidationError(error) {
        this.handle(error, 'validation');
        return { valid: false, error: error.message };
    }
}