import { uploadFileToStorage } from '../services/storage.js';
import { handleUploadBatch, updateSessionFiles, isSessionActive, canAddFiles } from '../services/session.js';
import { collection, addDoc, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '../firebase-config.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { createSession, getSessionData, SESSION_TIERS } from '../services/session.js';

// Constants
const EXTRACT_PICS_API = 'https://api.extract.pics/v0/extractions';
const EXTRACT_PICS_API_KEY = '0eotRRMZyW9p4dyJrfKMzKUZQEv0qpOUTRgdX6xtSb'; // Your actual API key
const CORS_PROXY = 'http://localhost:8080/';

// Elements
const dropdownButton = document.getElementById('url-type-dropdown');
const dropdownMenu = document.getElementById('url-type-menu');
const selectedTypeSpan = document.getElementById('selected-type');
const dropdownOptions = dropdownMenu.querySelectorAll('a');
const linkInput = document.getElementById('link-input');
const linkInputContainer = linkInput.parentElement;
const importButton = document.getElementById('import-link-btn');

const emptyState = document.getElementById('empty-state');
const previewGrid = document.getElementById('preview-grid');

const listViewBtn = document.getElementById('list-view-btn');
const gridViewBtn = document.getElementById('grid-view-btn');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.multiple = true;
fileInput.accept = 'image/png,image/jpeg,image/jpg';
fileInput.style.display = 'none';
document.body.appendChild(fileInput);

const processButton = document.querySelector('#upl-client-firebase-btn');
if (processButton) {
    processButton.disabled = true;
    processButton.classList.add('cursor-not-allowed', 'opacity-50');
 }

// Add at the top with other constants
let isStackMode = false;
const stackModeContainer = document.querySelector('#stack-mode-container');
const stackModeToggle = document.querySelector('#stack-mode-toggle');

const selectAllCheckbox = document.getElementById('select-all');
let selectedFiles = new Set(); // To track selected files

// Add click handler to the drop zone
dropZone.addEventListener('click', () => fileInput.click());

// Handle drag and drop events
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    // dropZone.classList.add('border-lochmara-500');
    dropZone.classList.add('bg-silver-chalice-50');
});

dropZone.addEventListener('dragleave', () => {
    // dropZone.classList.remove('border-lochmara-500');
    dropZone.classList.remove('bg-silver-chalice-50');
});

dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();

    // Check session before handling files
    if (!await isSessionActive()) {
        showErrorToast("Cannot upload files - session inactive or in cooldown");
        return;
    }

    dropZone.classList.remove('bg-silver-chalice-50');
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
});

// Handle file selection
fileInput.addEventListener('change', async (e) => {
    // Check session before handling files
    if (!await isSessionActive()) {
        showErrorToast("Cannot upload files - session inactive or in cooldown");
        return;
    }

    const files = Array.from(e.target.files);
    await handleFiles(files);
});

// Function to format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Function to validate file
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

// Function to create preview item
function createPreviewItem(file, validation) {
    const previewItem = document.createElement('div');
    previewItem.setAttribute('data-file-size', file.size);
    previewItem.className = 'preview-item h-20 min-h-[5rem] flex items-center w-full bg-white rounded-sm overflow-hidden relative cursor-pointer hover:bg-gray-50';

    // Checkbox container
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'absolute top-2 left-2 z-10';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500';
    checkbox.checked = validation.valid;
    if (!validation.valid) {
        checkbox.disabled = true;
    }

    // Image container - default to list view (thumbnail)
    const imgContainer = document.createElement('div');
    imgContainer.className = 'h-20 w-20 flex-shrink-0';

    const img = document.createElement('img');
    img.className = 'w-full h-full object-cover';
    
    // Create file reader for image preview
    const reader = new FileReader();
    reader.onload = (e) => {
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // File info section - default to list view
    const fileInfo = document.createElement('div');
    fileInfo.className = 'flex-1 h-20 px-4 flex flex-col justify-center gap-2';

    // Progress container
    const progressContainer = document.createElement('div');
    progressContainer.className = 'w-full flex flex-col gap-1';

    const progressBar = document.createElement('div');
    progressBar.className = 'h-1 bg-gray-200 rounded-full overflow-hidden';

    const progressFill = document.createElement('div');
    if (validation.valid) {
        progressFill.className = 'h-full bg-blue-500 transition-all duration-300';
        progressFill.style.width = '0%';
        progressFill.setAttribute('data-status', 'uploading');
    } else {
        progressFill.className = 'h-full bg-red-500 transition-all duration-300';
        progressFill.style.width = '100%';
        progressFill.setAttribute('data-status', 'rejected');
    }

    const statusContainer = document.createElement('div');
    statusContainer.className = 'flex items-center justify-between text-xs';

    const statusText = document.createElement('span');
    statusText.className = 'status-text text-gray-500';
    
    const fileSize = document.createElement('span');
    fileSize.className = 'text-xs text-gray-500';
    fileSize.textContent = formatFileSize(file.size);

    // File header (name and size)
    const fileHeader = document.createElement('div');
    fileHeader.className = 'flex justify-between items-center';
    fileHeader.innerHTML = `
        <p class="text-base font-bold truncate">${file.name}</p>
    `;

    // Assemble all elements
    checkboxContainer.appendChild(checkbox);
    imgContainer.appendChild(img);
    
    progressBar.appendChild(progressFill);
    statusContainer.appendChild(statusText);
    statusContainer.appendChild(fileSize);
    
    progressContainer.appendChild(progressBar);
    progressContainer.appendChild(statusContainer);
    
    fileInfo.appendChild(fileHeader);
    fileInfo.appendChild(progressContainer);

    previewItem.appendChild(checkboxContainer);
    previewItem.appendChild(imgContainer);
    previewItem.appendChild(fileInfo);

    // Handle status based on validation
    if (!validation.valid) {
        setRejectedStatus(statusText, previewItem);
    } else {
        // Add checkbox change handler only for valid files
        checkbox.addEventListener('change', (e) => {
            if (!e.target.checked) {
                setAbortedStatus(statusText, previewItem);
            } else {
                setReadyStatus(statusText, previewItem);
            }
            // updateAllStats();
            updateProcessButtonState();
            updateSelectAllState();
        });
    }

    // Add click hint before final return
    const clickHint = document.createElement('span');
    clickHint.className = 'absolute right-2 top-2 text-xs text-gray-400';
    clickHint.textContent = 'Click to preview';
    previewItem.appendChild(clickHint);

    return { previewItem, progressFill, statusText };
}

// Function to handle files
async function handleFiles(files) {
    if (!await isSessionActive()) {
        showErrorToast("Cannot upload files - session inactive or in cooldown");
        return;
    }
    // First check if we actually have files to process
    if (!files || files.length === 0) {
        return; // Exit if no files were selected
    }

    const emptyState = document.getElementById('empty-state');
    const previewGrid = document.getElementById('preview-grid');

    if (!emptyState || !previewGrid) {
        console.error('Required DOM elements not found');
        return;
    }
    
    // Show preview grid and hide empty state
    emptyState.classList.add('hidden');
    previewGrid.classList.remove('hidden');
    
    // Only set base classes
    previewGrid.className = 'w-full h-[552px] overflow-y-auto flex flex-col space-y-4';

    // Clear existing items if stack mode is OFF
    if (!isStackMode && files.length > 0) {
        previewGrid.innerHTML = '';
    }

    files.forEach(file => {
        const validation = validateFile(file);
        const { previewItem, progressFill, statusText } = createPreviewItem(file, validation);
        previewItem.file = file;
        console.log('Stored file:', previewItem.file);
    
        // Add modal click handler
        addModalClickHandler(previewItem);
    
        // Add to grid
        if (isStackMode) {
            previewGrid.insertBefore(previewItem, previewGrid.firstChild);
        } else {
            previewGrid.appendChild(previewItem);
        }
    
        if (validation.valid) {
            simulateProgress(progressFill, statusText, previewItem);
        } else {
            showErrorToast(validation.error);
        }
    });
}

// Function to simulate upload progress (remove when implementing real upload)
function simulateProgress(progressFill, statusText, previewItem) {
    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        progressFill.style.width = `${progress}%`;
        
        if (progress < 100) {
            statusText.textContent = 'uploading';
            progressFill.setAttribute('data-status', 'uploading');
            progressFill.className = 'h-full bg-blue-500 transition-all duration-300';
        } else {
            clearInterval(interval);
            setReadyStatus(statusText, previewItem);
            // updateAllStats();
            updateProcessButtonState();
            updateSelectAllState();
        }
    }, 100);
}

// Status setting functions
// Status setting functions
function setReadyStatus(statusText, previewItem) {
    if (previewItem) {
        previewItem.classList.remove('opacity-50');
        
        const progressFill = previewItem.querySelector('div[data-status]');
        if (progressFill) {
            progressFill.className = 'h-full bg-gray-200 transition-all duration-300';
            progressFill.setAttribute('data-status', 'ready');
        }
    }

    statusText.innerHTML = `
        <span class="inline-flex items-center gap-1 h-auto">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
            <span>ready</span>
        </span>
    `;
}

function setAbortedStatus(statusText, previewItem) {
    if (!previewItem) {
        previewItem = statusText.closest('.preview-item');
    }

    if (previewItem) {
        previewItem.classList.add('opacity-50');
        
        const progressFill = previewItem.querySelector('div[data-status]');
        if (progressFill) {
            progressFill.className = 'h-full bg-gray-400 transition-all duration-300';
            progressFill.setAttribute('data-status', 'aborted');
        }
    }

    statusText.innerHTML = `
        <span class="inline-flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" height="12px" viewBox="0 -960 960 960" width="12px" fill="#a6a6a6">
                <path d="M480.07-100q-78.84 0-148.21-29.92t-120.68-81.21q-51.31-51.29-81.25-120.63Q100-401.1 100-479.93q0-78.84 29.92-148.21t81.21-120.68q51.29-51.31 120.63-81.25Q401.1-860 479.93-860q78.84 0 148.21 29.92t120.68 81.21q51.31 51.29 81.25 120.63Q860-558.9 860-480.07q0 78.84-29.92 148.21t-81.21 120.68q-51.29 51.31-120.63 81.25Q558.9-100 480.07-100Z"/>
            </svg>
            <span class="text-silver-chalice-400">aborted</span>
        </span>
    `;
}

function setRejectedStatus(statusText, previewItem) {
    if (!previewItem) {
        previewItem = statusText.closest('.preview-item');
    }

    if (previewItem) {
        previewItem.classList.add('opacity-50');
        
        const progressFill = previewItem.querySelector('div[data-status]');
        if (progressFill) {
            progressFill.className = 'h-full bg-red-500 transition-all duration-300';
            progressFill.setAttribute('data-status', 'rejected');
        }

        const checkbox = previewItem.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = false;
            checkbox.disabled = true;
        }
    }

    statusText.innerHTML = `
        <span class="inline-flex items-center gap-1 h-auto">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="red">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            <span class="text-red-500">rejected</span>
        </span>
    `;
}

// Placeholder texts for each type
const placeholders = {
    'pin': 'or paste Pinterest pin link here ...',
    'board': 'or paste Pinterest board link here ...',
    'unsplash': 'or paste Unsplash image link here ...',
    'other': 'or paste image link here ...'
};

// URL validation patterns
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

// State
let currentUrlType = 'pin'; // Default to Pinterest Pin
let isDropdownOpen = false;

// Dropdown functionality
dropdownButton.addEventListener('click', (e) => {
    e.stopPropagation();
    isDropdownOpen = !isDropdownOpen;
    dropdownMenu.classList.toggle('hidden');
});

dropdownOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const selectedValue = e.target.dataset.value;
        currentUrlType = selectedValue;
        const selectedText = e.target.textContent;
        
        selectedTypeSpan.textContent = selectedText;
        linkInput.placeholder = placeholders[selectedValue];
        
        dropdownMenu.classList.add('hidden');
        isDropdownOpen = false;
        
        console.log('Selected type:', selectedValue);
    });
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (isDropdownOpen && !dropdownButton.contains(e.target)) {
        dropdownMenu.classList.add('hidden');
        isDropdownOpen = false;
    }
});

// Close dropdown on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isDropdownOpen) {
        dropdownMenu.classList.add('hidden');
        isDropdownOpen = false;
    }
});

// function handleSelectAll(checked) {
//     const previewItems = document.querySelectorAll('.preview-item');
    
//     previewItems.forEach(item => {
//         const checkbox = item.querySelector('input[type="checkbox"]');
//         const statusText = item.querySelector('.status-text');
//         const progressFill = item.querySelector('div[data-status]');
        
//         // Skip rejected files
//         if (progressFill?.classList.contains('bg-red-500')) {
//             return;
//         }

//         // Update checkbox state
//         if (!checkbox.disabled) {
//             checkbox.checked = checked;
            
//             // Update status based on checkbox state
//             if (checked) {
//                 setReadyStatus(statusText, item);
//             } else {
//                 setAbortedStatus(statusText, item);
//             }
//         }
//     });
    
//     // Update UI states
//     updateProcessButtonState();
//     // updateQueueStats();
// }

function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all');
    if (!selectAllCheckbox) return;

    const allItems = document.querySelectorAll('.preview-item');
    const validItems = Array.from(allItems).filter(item => {
        const progressFill = item.querySelector('div[data-status]');
        return progressFill && !progressFill.classList.contains('bg-red-500');
    });
    
    const selectedItems = Array.from(allItems).filter(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        return checkbox?.checked && !checkbox?.disabled;
    });

    selectAllCheckbox.checked = validItems.length > 0 && selectedItems.length === validItems.length;
    selectAllCheckbox.indeterminate = selectedItems.length > 0 && selectedItems.length < validItems.length;
}

function getItemStatus(previewItem) {
    const progressFill = previewItem.querySelector('div[data-status]');
    const checkbox = previewItem.querySelector('input[type="checkbox"]');
    const statusText = previewItem.querySelector('.status-text');
    
    return {
        dataStatus: progressFill?.getAttribute('data-status'),
        progressClasses: progressFill?.className,
        isChecked: checkbox?.checked,
        isDisabled: checkbox?.disabled,
        statusText: statusText?.textContent.trim(),
        opacity: previewItem.classList.contains('opacity-50')
    };
}

selectAllCheckbox.addEventListener('change', (e) => {
    const previewItems = previewGrid.querySelectorAll('.preview-item');
    
    previewItems.forEach(item => {
        const progressFill = item.querySelector('div[data-status]');
        const statusText = item.querySelector('.status-text');
        const checkbox = item.querySelector('input[type="checkbox"]');
        
        // Skip rejected files
        if (progressFill?.classList.contains('bg-red-500')) {
            checkbox.checked = false;
            checkbox.disabled = true;
            return;
        }

        checkbox.checked = e.target.checked;
        if (e.target.checked) {
            setReadyStatus(statusText, item);
        } else {
            setAbortedStatus(statusText, item);
        }
    });
    
    updateProcessButtonState();
});

// Constants for queue limits
const QUEUE_LIMITS = {
    maxFiles: 10,
    maxSize: 50 * 1024 * 1024 // 50MB in bytes
};

async function updateQueueStats() {
    const queueStatsFiles = document.getElementById('queue-stats-file-count');
    const queueStatsUsage = document.getElementById('queue-stats-file-usage');
    const selectedItems = document.querySelectorAll('.preview-item input[type="checkbox"]:checked:not(:disabled)');
    
    const sessionId = localStorage.getItem('sessionId');
    const sessionData = await getSessionData(sessionId);
    
    // Use default tier 1 limits if no session
    const currentTier = sessionData?.tier?.current || 1;
    const tierLimits = SESSION_TIERS['guest'][currentTier];
    const currentUsage = {
        files_count: sessionData?.usage?.files_count || 0,
        total_size: sessionData?.usage?.total_size || 0
    };
    
    const totalSize = Array.from(selectedItems).reduce((sum, checkbox) => {
        const previewItem = checkbox.closest('.preview-item');
        return sum + parseInt(previewItem.getAttribute('data-file-size') || 0);
    }, 0);
    
    if (selectedItems.length + currentUsage.files_count > tierLimits.max_files) {
        const lastSelected = selectedItems[selectedItems.length - 1];
        lastSelected.checked = false;
        setAbortedStatus(lastSelected.closest('.preview-item').querySelector('.status-text'));
        showErrorToast(`Queue limit exceeded. Current tier allows ${tierLimits.max_files} files.`);
        return updateQueueStats();
    }
    
    if (totalSize + currentUsage.total_size > tierLimits.max_size) {
        const lastSelected = selectedItems[selectedItems.length - 1];
        lastSelected.checked = false;
        setAbortedStatus(lastSelected.closest('.preview-item').querySelector('.status-text'));
        showErrorToast(`Queue size limit exceeded. Current tier allows ${formatFileSize(tierLimits.max_size)}`);
        return updateQueueStats();
    }
    
    if (queueStatsFiles) {
        queueStatsFiles.textContent = `${String(selectedItems.length).padStart(2, '0')}/${tierLimits.max_files}`;
    }
    
    if (queueStatsUsage) {
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        queueStatsUsage.textContent = `${sizeMB}MB/${tierLimits.max_size / (1024 * 1024)}MB`;
    }
    
    updateProcessButtonState();
}

// Initialize event listeners
function initQueueStats() {
    const previewGrid = document.getElementById('preview-grid');
    previewGrid.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            updateQueueStats();
            updateProcessButtonState();
            updateSelectAllState();
        }
    });
    
    const observer = new MutationObserver(updateQueueStats);
    observer.observe(previewGrid, { childList: true, subtree: true });
}

// Handle "Select All" with validation
document.getElementById('select-all')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        const allValidItems = document.querySelectorAll('.preview-item input[type="checkbox"]:not(:disabled)');
        const totalSize = Array.from(allValidItems).reduce((sum, checkbox) => {
            const previewItem = checkbox.closest('.preview-item');
            return sum + parseInt(previewItem.getAttribute('data-file-size') || 0);
        }, 0);
        
        if (!validateQueueAddition(0, 0, allValidItems.length, totalSize)) {
            e.target.checked = false;
            return;
        }
    }
    updateQueueStats();
});

document.addEventListener('DOMContentLoaded', () => {
    const sessionDropDownMenu = document.getElementById('session-dropdown-menu');
    sessionDropDownMenu.classList.add('hidden');

    initSessionChecks();
    initQueueStats();
    updateQueueStats();
});

export { updateQueueStats };

// function updateQueueStats() {
//     const queueStatsFiles = document.querySelectorAll('.queue-stats-file');
    
//     if (queueStatsFiles.length) {
//         const selectedCount = previewGrid.querySelectorAll('input[type="checkbox"]:checked').length;
//         queueStatsFiles[0].textContent = `${selectedCount}/10`; // Adjust max as needed
//     }
// }

// Status handling functions
function showStatus(message) {
    const statusContainer = document.getElementById('status-text-container');
    if (!linkInputContainer) return;
    
    // Find or create the status container
    // let statusContainer = linkInputContainer.querySelector('.absolute.h-6');
    // if (!statusContainer) {
    //     statusContainer = document.createElement('div');
    //     statusContainer.className = 'absolute -bottom-6 left-0 h-6 w-full';
    //     linkInputContainer.appendChild(statusContainer);
    // }
    
    const statusText = document.createElement('div');
    statusText.className = 'text-sm text-gray-600 flex items-center gap-2';
    statusText.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>${message}</span>
    `;
    
    // Clear existing status messages
    statusContainer.innerHTML = '';
    statusContainer.appendChild(statusText);
}

function showError(message) {
    const statusContainer = document.getElementById('status-text-container');
    if (!linkInputContainer) return;
    
    // Find or create the status container
    // let statusContainer = linkInputContainer.querySelector('.absolute.h-6');
    // if (!statusContainer) {
    //     statusContainer = document.createElement('div');
    //     statusContainer.className = 'absolute -bottom-6 left-0 h-6 w-full';
    //     linkInputContainer.appendChild(statusContainer);
    // }
    
    const errorText = document.createElement('div');
    errorText.className = 'text-sm text-red-600 flex items-center gap-2';
    errorText.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${message}</span>
    `;
    
    // Clear existing status messages
    statusContainer.innerHTML = '';
    statusContainer.appendChild(errorText);
    
    // Remove error message after 5 seconds
    setTimeout(() => {
        resetStatusMessage();
    }, 5000);
}

function showSuccess(message) {
    const statusContainer = document.getElementById('status-text-container');
    if (!linkInputContainer) return;
    
    // Find or create the status container
    // let statusContainer = linkInputContainer.querySelector('.absolute.h-6');
    // if (!statusContainer) {
    //     statusContainer = document.createElement('div');
    //     statusContainer.className = 'absolute -bottom-6 left-0 h-6 w-full';
    //     linkInputContainer.appendChild(statusContainer);
    // }
    
    const successText = document.createElement('div');
    successText.className = 'text-sm text-green-600 flex items-center gap-2';
    successText.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>${message}</span>
    `;
    
    // Clear existing status messages
    statusContainer.innerHTML = '';
    statusContainer.appendChild(successText);
    
    // Remove success message after 3 seconds
    setTimeout(() => {
        resetStatusMessage();
    }, 3000);
}

function clearStatus() {
    resetStatusMessage();
}

function resetStatusMessage() {
    const statusContainer = document.getElementById('status-text-container');
    if (!statusContainer) return;
    
    statusContainer.innerText = "Note: Due to technical limitations, only the first ~30 pins from boards will be shown.";
}

// URL validation
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

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

// Image extraction functions
function getExactPinImage(data) {
    console.log('Analyzing Pinterest data for exact pin image...');
    
    if (!data.data || !data.data.images) {
        console.log('No image data found');
        return [];
    }

    const allImages = data.data.images;
    console.log('All available images:', allImages);

    // Look strictly for original size images only
    let mainImage = allImages.find(img => {
        const url = img.url;
        // Must be a Pinterest image URL
        if (!url.includes('i.pinimg.com')) return false;
        
        // Must be in /originals/ folder
        if (!url.includes('/originals/')) return false;
        
        // Exclude all thumbnails and variants
        if (url.includes('_RS') || 
            url.includes('236x') || 
            url.includes('75x75') ||
            url.includes('140x140') ||
            url.includes('_custom_') ||
            url.includes('b.jpg') || 
            url.includes('_b.') ||
            url.includes('/474x/') ||
            url.includes('/736x/')) return false;
            
        return true;
    });

    if (mainImage) {
        console.log('Found original pin image:', mainImage.url);
        return [mainImage.url];
    }

    console.log('Could not find original pin image');
    return [];
}

function getBoardImages(data) {
    console.log('Extracting board images...');
    
    if (!data.data || !data.data.images) {
        console.log('No image data found');
        return [];
    }

    const allImages = data.data.images;
    const imageMap = new Map();

    // First, group images by their base ID
    const imageGroups = allImages.reduce((acc, img) => {
        const url = img.url;
        if (!url.includes('i.pinimg.com')) return acc;
        
        const imageId = url.split('/').pop().split('.')[0];
        if (!acc[imageId]) acc[imageId] = [];
        acc[imageId].push(url);
        return acc;
    }, {});

    // Process each group
    Object.entries(imageGroups).forEach(([imageId, urls]) => {
        // Prefer images that have multiple size variants (likely actual pins)
        if (urls.length > 1) {
            // Find the best quality version
            let bestUrl = urls.find(url => url.includes('/originals/'));
            if (!bestUrl) bestUrl = urls.find(url => url.includes('/736x/'));
            if (!bestUrl) bestUrl = urls.find(url => url.includes('/474x/'));
            if (!bestUrl) bestUrl = urls.find(url => url.includes('/236x/'));
            if (!bestUrl) bestUrl = urls.find(url => url.includes('/170x/'));
            
            if (bestUrl) {
                imageMap.set(imageId, {
                    url: bestUrl,
                    score: bestUrl.includes('/originals/') ? 5 :
                           bestUrl.includes('/736x/') ? 4 :
                           bestUrl.includes('/474x/') ? 3 : 
                           bestUrl.includes('/236x/') ? 2 : 
                           bestUrl.includes('/170x/') ? 1 : 0
                });
            }
        }
    });

    const boardImages = Array.from(imageMap.values())
        .sort((a, b) => b.score - a.score)
        .map(item => item.url);

    console.log(`Found ${boardImages.length} likely board pins with quality distribution:`, 
        Array.from(imageMap.values()).reduce((acc, curr) => {
            acc[curr.score] = (acc[curr.score] || 0) + 1;
            return acc;
        }, {}));

    return boardImages;
}

function getUnsplashImage(data) {
    console.log('Analyzing Unsplash data for image...');
    
    if (!data.data || !data.data.images) {
        console.log('No image data found');
        return [];
    }

    const allImages = data.data.images;
    console.log('All available images:', allImages);

    // Look for Unsplash image with valid URLs
    let mainImage = allImages.find(img => 
        img.url.includes('unsplash.com') &&
        img.url.includes('/photo-') &&
        !img.url.includes('profile') &&
        !img.url.includes('avatar')
    );

    if (mainImage) {
        // Remove any query parameters and size modifiers
        let cleanUrl = mainImage.url.split('?')[0];
        console.log('Found Unsplash image:', cleanUrl);
        return [cleanUrl];
    }

    console.log('Could not find valid Unsplash image');
    return [];
}

// Main extraction functions
async function extractPinterestPin(url) {
    const response = await fetch(CORS_PROXY + EXTRACT_PICS_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${EXTRACT_PICS_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ url: url })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const initialData = await response.json();
    console.log('Initial response:', initialData);

    showStatus('Starting pin extraction...');

    const imageUrls = await pollExtractionStatus(initialData.data.id, 'pin');
    console.log('Found image URLs:', imageUrls);

    if (!imageUrls || imageUrls.length === 0) {
        throw new Error('No images found');
    }

    clearStatus();
    showSuccess('Successfully extracted pin image!');

    return imageUrls;
}

async function extractPinterestBoard(url) {
    const response = await fetch(CORS_PROXY + EXTRACT_PICS_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${EXTRACT_PICS_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ url: url })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const initialData = await response.json();
    console.log('Initial response:', initialData);

    showStatus('Starting board extraction...');

    const imageUrls = await pollExtractionStatus(initialData.data.id, 'board');
    console.log('Found image URLs:', imageUrls);

    if (!imageUrls || imageUrls.length === 0) {
        throw new Error('No images found in board');
    }

    clearStatus();
    showSuccess(`Successfully extracted ${imageUrls.length} images from board!`);

    return imageUrls;
}

async function extractUnsplashImage(url) {
    const response = await fetch(CORS_PROXY + EXTRACT_PICS_API, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${EXTRACT_PICS_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ url: url })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const initialData = await response.json();
    console.log('Initial response:', initialData);

    showStatus('Starting Unsplash image extraction...');

    const imageUrls = await pollExtractionStatus(initialData.data.id, 'unsplash');
    console.log('Found image URLs:', imageUrls);

    if (!imageUrls || imageUrls.length === 0) {
        throw new Error('No Unsplash image found');
    }

    clearStatus();
    showSuccess('Successfully extracted Unsplash image!');

    return imageUrls;
}

async function pollExtractionStatus(extractionId, urlType) {
    const maxAttempts = 30;
    const delayMs = 3000;
    let attempt = 0;
    
    while (attempt < maxAttempts) {
        try {
            const response = await fetch(CORS_PROXY + EXTRACT_PICS_API + '/' + extractionId, {
                headers: {
                    'Authorization': `Bearer ${EXTRACT_PICS_API_KEY}`,
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const data = await response.json();
            console.log(`Attempt ${attempt + 1}/${maxAttempts}:`, data);
            
            if (data.data && data.data.images && data.data.images.length > 0) {
                const images = urlType === 'pin' 
                    ? getExactPinImage(data)
                    : urlType === 'board'
                        ? getBoardImages(data)
                        : urlType === 'unsplash'
                            ? getUnsplashImage(data)
                            : [];

                            if (images.length > 0) {
                                const message = urlType === 'pin' 
                                    ? 'Found pin image!' 
                                    : urlType === 'board'
                                        ? `Found ${images.length} board images!`
                                        : 'Found Unsplash image!';
                                showStatus(message);
                                return images;
                            }
            }
                        
            showStatus(`Extracting ${urlType}... (Attempt ${attempt + 1}/${maxAttempts})`);
            attempt++;
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
        } catch (error) {
            console.error('Polling error:', error);
            throw new Error('Error checking extraction status');
        }
    }
    
    throw new Error('Extraction timed out. Please try again.');
}
            
// Main extraction function
async function extractImagesFromLink(url) {
    if (!isValidUrl(url)) {
        showError('Please enter a valid URL');
        return;
    }

    // Add type validation before proceeding
    const validation = validateUrlType(url, currentUrlType);
    if (!validation.valid) {
        showError(validation.message);
        return;
    }

    if (!await isSessionActive()) {
        showErrorToast("Cannot import images - session inactive or in cooldown");
        return;
    }

    setImportButtonLoading(true);

    try {
        let extractedImages;

        switch(currentUrlType) {
            case 'pin':
                showStatus('Extracting Pinterest pin...');
                extractedImages = await extractPinterestPin(url);
                break;
                
            case 'board':
                showStatus('Extracting Pinterest board...');
                extractedImages = await extractPinterestBoard(url);
                break;
                
            case 'unsplash':
                showStatus('Extracting Unsplash image...');
                extractedImages = await extractUnsplashImage(url);
                break;
                
            case 'other':
                showStatus('Extracting image...');
                showError('General image extraction coming soon');
                return;
                
            default:
                throw new Error('Invalid URL type selected');
        }

        // Only if we successfully got images
        if (extractedImages && extractedImages.length > 0) {
            handleImageUrls(extractedImages);
            // Clear input only after successful extraction and handling
            if (linkInput) {
                linkInput.value = '';
            }
        }

    } catch (error) {
        console.error('Full error:', error);
        if (linkInputContainer) {
            showError(error.message);
        }
    } finally {
        setImportButtonLoading(false);
    }
}

// Helper function to get image size through CORS proxy
async function getImageSize(url) {
    try {
        const response = await fetch(CORS_PROXY + url, { 
            method: 'HEAD',
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        const size = response.headers.get('content-length');
        if (size) {
            const sizeInMB = (size / (1024 * 1024)).toFixed(2);
            console.log(`Size for ${url}: ${sizeInMB} MB`);
            return {
                size: parseFloat(sizeInMB),
                displaySize: sizeInMB + ' MB'
            };
        }
        throw new Error('No content length header');
    } catch (error) {
        console.error('Error getting image size:', error);
        return {
            size: 0,
            displaySize: 'Size unknown'
        };
    }
}

// Add this function to browse-files.js
async function handleImageUrls(urls) {
    emptyState.classList.add('hidden');
    previewGrid.classList.remove('hidden');
    previewGrid.className = 'w-full h-[552px] overflow-y-auto flex flex-col space-y-4';

    if (!isStackMode) {
        previewGrid.innerHTML = '';
    }

    for (const url of urls) {
        try {
            const response = await fetch(CORS_PROXY + url, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            const blob = await response.blob();
            const filename = url.split('/').pop() || 'image';
            const file = new File([blob], filename, { type: blob.type });
            
            const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);
            const sizeInfo = {
                size: parseFloat(sizeInMB),
                displaySize: sizeInMB + ' MB'
            };

            const preview = document.createElement('div');
            preview.setAttribute('data-preview-id', url);
            preview.setAttribute('data-file-size', sizeInfo.size);
            preview.file = file;
            preview.className = 'preview-item h-20 min-h-[5rem] flex items-center w-full bg-white rounded-sm overflow-hidden relative cursor-pointer hover:bg-gray-50';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500';
            checkbox.checked = sizeInfo.size <= 5;
            checkbox.disabled = sizeInfo.size > 5;

            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'absolute top-2 left-2 z-10';
            checkboxContainer.appendChild(checkbox);

            const imgContainer = document.createElement('div');
            imgContainer.className = 'h-20 w-20 flex-shrink-0';
            const img = document.createElement('img');
            img.src = url;
            img.className = 'w-full h-full object-cover';
            imgContainer.appendChild(img);

            const fileInfo = document.createElement('div');
            fileInfo.className = 'flex-1 h-20 px-4 flex flex-col justify-center gap-2';

            const progressContainer = document.createElement('div');
            progressContainer.className = 'w-full flex flex-col gap-1';

            const progressBar = document.createElement('div');
            progressBar.className = 'h-1 bg-gray-200 rounded-full overflow-hidden';

            const progressFill = document.createElement('div');
            progressFill.className = 'h-full bg-blue-500 transition-all duration-300';
            progressFill.style.width = '0%';
            progressFill.setAttribute('data-status', 'uploading');

            const statusContainer = document.createElement('div');
            statusContainer.className = 'flex items-center justify-between text-xs';

            const statusText = document.createElement('span');
            statusText.className = 'status-text text-gray-500';

            const fileSize = document.createElement('span');
            fileSize.className = 'text-xs text-gray-500';
            fileSize.textContent = sizeInfo.displaySize;

            const fileHeader = document.createElement('div');
            fileHeader.className = 'flex justify-between items-center';
            fileHeader.innerHTML = `<p class="text-base font-bold truncate">${filename}</p>`;

            // Assemble elements
            progressBar.appendChild(progressFill);
            statusContainer.appendChild(statusText);
            statusContainer.appendChild(fileSize);
            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(statusContainer);
            fileInfo.appendChild(fileHeader);
            fileInfo.appendChild(progressContainer);

            preview.appendChild(checkboxContainer);
            preview.appendChild(imgContainer);
            preview.appendChild(fileInfo);

            if (sizeInfo.size <= 5) {
                simulateProgress(progressFill, statusText, preview);
                checkbox.addEventListener('change', (e) => {
                    if (!e.target.checked) {
                        setAbortedStatus(statusText, preview);
                    } else {
                        setReadyStatus(statusText, preview);
                    }
                    // updateAllStats();
                    updateProcessButtonState();
                    updateSelectAllState();
                });
            } else {
                setRejectedStatus(statusText, preview);
                showErrorToast(`File size (${sizeInfo.displaySize}) exceeds 5MB limit`);
            }

            const clickHint = document.createElement('span');
            clickHint.className = 'absolute right-2 top-2 text-xs text-gray-400';
            clickHint.textContent = 'Click to preview';
            preview.appendChild(clickHint);

            addModalClickHandler(preview);

            if (isStackMode) {
                previewGrid.insertBefore(preview, previewGrid.firstChild);
            } else {
                previewGrid.appendChild(preview);
            }

        } catch (error) {
            console.error('Error processing URL:', error);
            showErrorToast(`Failed to process image: ${url}`);
        }
    }
    updateProcessButtonState();
}


// Function to update all stats
// function updateAllStats() {
//     updateSessionStats();
//     // updateQueueStats();
// }

// Add function to update session stats
// function updateSessionStats() {
//     const previewItems = document.querySelectorAll('.preview-item');
//     let totalFiles = 0;
//     let totalSize = 0;

//     previewItems.forEach(item => {
//         const progressFill = item.querySelector('div[data-status]');
//         const status = progressFill?.getAttribute('data-status');
//         const checkbox = item.querySelector('input[type="checkbox"]');
        
//         if (status === 'ready' && checkbox?.checked) {
//             totalFiles++;
//             const fileSize = parseInt(item.getAttribute('data-file-size'));
//             totalSize += fileSize;
//         }
//     });

//     document.getElementById('session-upload-count-files').textContent = `${String(totalFiles).padStart(2, '0')}/50`;
//     document.getElementById('session-upload-count-size').textContent = `${(totalSize / (1024 * 1024)).toFixed(2)}MB/250MB`;
// }

// Helper function to convert size text to bytes
// function convertSizeToBytes(sizeText) {
//     const size = parseFloat(sizeText);
//     if (sizeText.includes('MB')) return size * 1024 * 1024;
//     if (sizeText.includes('KB')) return size * 1024;
//     return size;
// }

// Function to update queue stats
// function updateQueueStats() {
//     const previewItems = document.querySelectorAll('.preview-item');
//     let queueFiles = 0;
//     let queueSize = 0;

//     previewItems.forEach(item => {
//         const progressFill = item.querySelector('.bg-blue-500, .bg-green-500, .bg-gray-200');
//         const status = progressFill.getAttribute('data-status');
//         const checkbox = item.querySelector('input[type="checkbox"]');
        
//         if (status === 'ready' && checkbox.checked) {
//             queueFiles++;
//             const sizeText = item.querySelector('.text-xs').textContent;
//             queueSize += parseFloat(sizeText) * (sizeText.includes('MB') ? 1024 * 1024 : 1024);
//         }
//     });

//     // Update DOM elements
//     const queueStatsFiles = document.getElementById('queue-stats-file-count');
//     const queueStatsUsage = document.getElementById('queue-stats-file-usage');
    
//     if (queueStatsFiles) {
//         queueStatsFiles.textContent = `${String(queueFiles).padStart(2, '0')}/10`;
//     }
    
//     if (queueStatsUsage) {
//         queueStatsUsage.textContent = `${(queueSize / (1024 * 1024)).toFixed(2)}MB/50MB`;
//     }
// }

// Helper function to set loading state
function setImportButtonLoading(isLoading) {
    if (isLoading) {
        importButton.disabled = true;
        importButton.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-lochmara-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        `;
    } else {
        importButton.disabled = false;
        importButton.innerHTML = 'Extract';
    }
}

// Add input validation
linkInput.addEventListener('input', () => {
    const url = linkInput.value.trim();
    importButton.disabled = !url;
});

// Add paste event listener for convenience
linkInput.addEventListener('paste', (e) => {
    // Small delay to ensure the pasted content is in the input
    setTimeout(() => {
        const url = e.target.value.trim();
        if (url) {
            extractImagesFromLink(url);
        }
    }, 100);
});

// Add enter key listener
linkInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const url = e.target.value.trim();
        if (url) {
            extractImagesFromLink(url);
        }
    }
});

// Extract button click handler
importButton.addEventListener('click', () => {
    const url = linkInput.value.trim();
    if (url) {
        extractImagesFromLink(url);
    }
});

// Function to update process button state
async function updateProcessButtonState() {
    const processButton = document.getElementById('upl-client-firebase-btn');
    const processText = document.getElementById('process-text');
    
    if (processButton.hasAttribute('data-uploading')) return;
    
    const sessionData = await getSessionData(localStorage.getItem('sessionId'));
    const isInCooldown = sessionData?.cooldown?.active;
    
    if (isInCooldown) {
        processButton.disabled = true;
        processButton.classList.add('opacity-50', 'cursor-not-allowed');
        processText.textContent = `In cooldown: ${formatTime(sessionData.cooldown.timeRemaining)}`;
        return;
    }
    
    const selectedFiles = document.querySelectorAll('.preview-item input[type="checkbox"]:checked');
    processButton.disabled = selectedFiles.length === 0;
    processButton.classList.toggle('opacity-50', selectedFiles.length === 0);
    processButton.classList.toggle('cursor-not-allowed', selectedFiles.length === 0);
    processText.textContent = selectedFiles.length > 0 ? 
        `Process ${selectedFiles.length} Selected ${selectedFiles.length === 1 ? 'File' : 'Files'}` : 
        'Select Files to Process';
}

// Function to show error toast
function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Fade out and remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

//Toggling Stack mode and features

// Add the event listener for the toggle
stackModeContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    stackModeToggle.checked = !stackModeToggle.checked;
    isStackMode = stackModeToggle.checked;
    console.log('clicked', isStackMode);
    
    // Update toggle appearance
    if (isStackMode) {
        stackModeToggle.nextElementSibling.classList.add('bg-lochmara-600');
    } else {
        stackModeToggle.nextElementSibling.classList.remove('bg-lochmara-600');
    }
});

// Add modal click handler to preview item
function addModalClickHandler(previewItem) {
    // Add click handler to the entire preview item
    previewItem.addEventListener('click', (e) => {
        // Prevent modal from opening when clicking these elements
        if (e.target.type === 'checkbox' || 
            e.target.closest('.status-text') ||
            e.target.closest('.progress-container')) {
            return;
        }
        openPreviewModal(previewItem);
    });
}

// Modal functions
function openPreviewModal(previewItem) {
    const modal = document.getElementById('preview-modal');
    const modalImage = document.getElementById('modal-image');
    const modalFilename = document.getElementById('modal-filename');
    const modalProgress = document.getElementById('modal-progress');
    const modalStatus = document.getElementById('modal-status');
    
    // Get data from preview item
    const img = previewItem.querySelector('img');
    const filename = previewItem.querySelector('.text-base.font-bold').textContent;
    const progressBar = previewItem.querySelector('.h-1.bg-gray-200').cloneNode(true);
    const status = previewItem.querySelector('.status-text').parentElement.cloneNode(true);
    
    // Set modal content
    modalImage.src = img.src;
    modalFilename.textContent = filename;
    modalProgress.innerHTML = '';
    modalProgress.appendChild(progressBar);
    modalStatus.innerHTML = '';
    modalStatus.appendChild(status);
    
    // Show modal
    modal.classList.remove('hidden');
}

function closePreviewModal() {
    const modal = document.getElementById('preview-modal');
    modal.classList.add('hidden');
}

// Initialize modal event listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('preview-modal');
    const closeBtn = document.getElementById('close-modal');
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePreviewModal();
        }
    });
    
    // Close on button click
    closeBtn.addEventListener('click', closePreviewModal);
    
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closePreviewModal();
        }
    });

    //Update session stats
    updateSessionStatsUI();

    setInterval(updateSessionStatsUI, 1000);
    updateProcessButtonState();
    updateUIState();
    setInterval(updateUIState, 10000);
});

processButton.addEventListener('click', async (e) => {
    e.stopPropagation(); // Prevent this from triggering document click

    // Prevent multiple simultaneous session creations
    if (isCreatingSession) {
        return;
    }

    if (!await isSessionActive()) {
        showErrorToast("Cannot process files - session has expired");
        return;
    }

    const previewItems = Array.from(document.querySelectorAll('.preview-item'))
        .filter(item => item.querySelector('input[type="checkbox"]:checked'));
 
    try {
        // Disable button immediately
        processButton.setAttribute('data-uploading', 'true');
        processButton.disabled = true;
        processButton.classList.add('opacity-50', 'cursor-not-allowed');
        const processText = document.getElementById('process-text');
        processText.textContent = 'Process Selected Files in';

        isCreatingSession = true;
        let sessionId = selectedSessionId;

        // Create or get session
        if (!sessionId) {
            sessionId = await createSession();
            selectedSessionId = sessionId;
            selectedSessionText.textContent = `${sessionId.substring(0, 3)}...${sessionId.slice(-3)}`;
            await updateSessionsList();
        }

        // Use the session we just created/selected
        const session = sessionId; // No need to call handleUploadBatch() since we already have a session

        if (!session) {
            showErrorToast("Couldn't create session. Please try again.");
            return;
        }

        processButton.disabled = true;
 
        const uploadPromises = previewItems.map(previewItem => {
            const progressFill = previewItem.querySelector('[data-status]');
            const statusText = previewItem.querySelector('.status-text');
            
            progressFill.style.width = '0%';
            progressFill.className = 'h-full bg-blue-500 transition-all duration-300';
            statusText.textContent = 'starting upload...';
 
            return uploadFileToStorage(previewItem.file, (progress) => {
                if (progress.status === 'error') {
                    progressFill.className = 'h-full bg-red-500 transition-all duration-300';
                    statusText.textContent = `Error: ${progress.error.substring(0, 50)}`;
                    showErrorToast(`Upload failed: ${progress.error}`);
                    return;
                }
 
                progressFill.style.width = `${progress.progress}%`;
                statusText.textContent = `${Math.round(progress.progress)}% • ${progress.speed}MB/s`;
 
                if (progress.status === 'complete') {
                    progressFill.className = 'h-full bg-green-500 transition-all duration-300';
                    statusText.textContent = 'Upload complete';
                    previewItem.uploadedUrl = progress.downloadURL;
                    
                    // Update session with file info
                    updateSessionFiles(session, {
                        name: previewItem.file.name,
                        size: previewItem.file.size,
                        upload_time: new Date(),
                        storage_url: progress.downloadURL,
                        processed: false
                    });
                }
            }).catch(error => {
                progressFill.className = 'h-full bg-red-500 transition-all duration-300';
                statusText.textContent = 'Upload failed';
                console.error('Upload error:', error);
                showErrorToast(`Upload failed: ${error.message}`);
            });
        });
 
        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        // Show success notification
        const uploadedCount = previewItems.length;
        showSuccessNotification(uploadedCount, session);

        // Add the notification badge
        toggleSessionsBadge(true);

        // Wait a brief moment for Firestore updates to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update stats
        await updateSessionStatsUI();

        // Clear preview grid after successful upload
        previewGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        previewGrid.classList.add('hidden');
    } catch (error) {
        console.error('Processing error:', error);
        showErrorToast("Failed to process files");
    } finally {
        processButton.removeAttribute('data-uploading');
        isCreatingSession = false;
    }
 });

 async function updateSessionStatsUI() {
    const sessionId = localStorage.getItem('sessionId');
    const expiryParagraph = document.getElementById('session-expiry-p');
    const cooldownParagraph = document.getElementById('session-cooldown-p');
    const expiryElement = document.getElementById('session-expires-delay');
    const cooldownElement = document.getElementById('session-cooldown-delay');
    const filesCountElement = document.getElementById('session-upload-count-files');
    const sizeElement = document.getElementById('session-upload-count-size');
    
    if (!sessionId) {
        // Reset all stats when no session
        if (filesCountElement) filesCountElement.textContent = '00/50';
        if (sizeElement) sizeElement.textContent = '0.00MB/250MB';
        if (expiryParagraph) expiryParagraph.classList.add('hidden');
        if (cooldownParagraph) cooldownParagraph.classList.add('hidden');
        return;
    }
 
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    
    if (sessionSnap.exists()) {
        const session = sessionSnap.data();
        const now = new Date();
        const expiresAt = session.expires_at.toDate();
        const cooldownEndsAt = session.cooldown_ends_at ? session.cooldown_ends_at.toDate() : new Date(expiresAt.getTime() + (60 * 60 * 1000));
 
        if (now > expiresAt) {
            // Session expired
            if (now < cooldownEndsAt) {
                // In cooldown period
                const cooldownLeft = cooldownEndsAt - now;
                const cooldownMinutes = Math.floor(cooldownLeft / 60000);
                const cooldownSeconds = Math.floor((cooldownLeft % 60000) / 1000);
                
                // Show cooldown, hide expiry
                if (cooldownElement) {
                    cooldownElement.textContent = `${String(cooldownMinutes).padStart(2, '0')}:${String(cooldownSeconds).padStart(2, '0')}`;
                }
                expiryParagraph.classList.add('hidden');
                cooldownParagraph.classList.remove('hidden');
            } else {
                // Cooldown finished
                if (expiryElement) {
                    expiryElement.textContent = 'Ready for new session';
                }
                expiryParagraph.classList.remove('hidden');
                cooldownParagraph.classList.add('hidden');

                localStorage.removeItem('sessionId');
            }
            
            // Reset usage stats
            if (filesCountElement) filesCountElement.textContent = '00/50';
            if (sizeElement) sizeElement.textContent = '0.00MB/250MB';            
        } else {
            // Active session
            const timeLeft = expiresAt - now;
            const minutesLeft = Math.floor(timeLeft / 60000);
            const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
            
            // Show expiry, hide cooldown
            if (expiryElement) {
                expiryElement.textContent = `${String(minutesLeft).padStart(2, '0')}:${String(secondsLeft).padStart(2, '0')}`;
            }
            expiryParagraph.classList.remove('hidden');
            cooldownParagraph.classList.add('hidden');
 
            // Update usage stats
            if (filesCountElement) {
                filesCountElement.textContent = `${String(session.usage.files_count).padStart(2, '0')}/50`;
            }
            
            if (sizeElement) {
                const sizeMB = (session.usage.total_size / (1024 * 1024)).toFixed(2);
                sizeElement.textContent = `${sizeMB}MB/250MB`;
            }
        }
    }
 }
export {updateSessionStatsUI};

// function to update UI based on session state
async function updateUIState() {
    // Get all UI elements
    const elements = {
        dropZone: document.getElementById('drop-zone'),
        linkInput: document.getElementById('link-input'),
        importButton: document.getElementById('import-link-btn'),
        processButton: document.getElementById('upl-client-firebase-btn'),
        processText: document.getElementById('process-text'),
        selectedSessionText: document.getElementById('selected-session-text'),
        dropdownMenu: document.getElementById('session-dropdown-menu')
    };

    // Get session state
    const isActive = await isSessionActive();
    const sessionLimits = isActive ? await canAddFiles(0, 0) : null;

    // Determine UI state
    const state = getUIState(isActive, sessionLimits);

    // Update UI based on state
    updateDropZone(elements.dropZone, state);
    updateProcessButton(elements, state);
    updateInputSection(elements, state);
    
    // Hide dropdown if inactive or limits reached
    if (!state.isActive || !state.withinLimits) {
        elements.dropdownMenu.classList.add('hidden');
    }
}

function getUIState(isActive, sessionLimits) {
    if (!isActive) {
        return {
            isActive: false,
            withinLimits: false,
            message: {
                title: 'Upload disabled during cooldown',
                subtitle: 'Check timer for next available session'
            },
            processState: {
                text: 'Processing unavailable',
                sessionText: 'Session cooldown',
                title: 'Wait for session cooldown to end'
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
                files: sessionLimits.remainingFiles,
                space: remainingMB
            },
            processState: {
                text: 'Cannot process more files',
                sessionText: 'Limits reached',
                title: `Files: ${sessionLimits.remainingFiles} remaining, Space: ${remainingMB}MB remaining`
            }
        };
    }

    return {
        isActive: true,
        withinLimits: true
    };
}

function updateDropZone(dropZone, state) {
    if (!state.isActive || !state.withinLimits) {
        dropZone.classList.add('opacity-50', 'pointer-events-none');
        
        if (!state.withinLimits && state.message.files !== undefined) {
            dropZone.innerHTML = `
                <div class="text-silver-chalice-400 text-center">
                    <p>${state.message.title}</p>
                    <p class="text-sm">Files: ${state.message.files} remaining</p>
                    <p class="text-sm">Space: ${state.message.space}MB remaining</p>
                </div>
            `;
        } else {
            dropZone.innerHTML = `
                <div class="text-silver-chalice-400 text-center">
                    <p>${state.message.title}</p>
                    <p class="text-sm">${state.message.subtitle}</p>
                </div>
            `;
        }
    } else {
        dropZone.classList.remove('opacity-50', 'pointer-events-none');
        // Restore original drop zone content here
    }
}

function updateProcessButton(elements, state) {
    const { processButton, processText, selectedSessionText } = elements;

    if (!state.isActive || !state.withinLimits) {
        processButton.disabled = true;
        processButton.classList.add('opacity-50', 'cursor-not-allowed');
        processText.textContent = state.processState.text;
        selectedSessionText.textContent = state.processState.sessionText;
        processButton.title = state.processState.title;
    } else {
        updateProcessButtonState();
    }
}

function updateInputSection(elements, state) {
    const { linkInput, importButton } = elements;
    const isDisabled = !state.isActive || !state.withinLimits;

    linkInput.disabled = isDisabled;
    importButton.disabled = isDisabled;

    if (isDisabled) {
        linkInput.classList.add('bg-gray-100');
        importButton.classList.add('opacity-50');
    } else {
        linkInput.classList.remove('bg-gray-100');
        importButton.classList.remove('opacity-50');
    }
}

// Get DOM elements
const sessionDropDownBtn = document.getElementById('session-dropdown-btn');
const sessionDropDownMenu = document.getElementById('session-dropdown-menu');
const selectedSessionText = document.getElementById('selected-session-text');
const activeSessionsList = document.getElementById('active-sessions-list');

// Track selected session
let selectedSessionId = null;
// Add a flag to track session creation in progress
let isCreatingSession = false;

// Toggle dropdown only when clicking the session dropdown button
sessionDropDownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
   e.preventDefault();
   sessionDropDownMenu.classList.toggle('hidden');
   updateSessionsList();
});

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    sessionDropDownMenu.classList.add('hidden');
});

sessionDropDownMenu.className = 'absolute right-0 z-10 mt-2 w-96 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none overflow-y-auto max-h-32';
activeSessionsList.className = 'py-1 divide-y divide-gray-100';

sessionDropDownMenu.style.scrollbarWidth = 'thin';
sessionDropDownMenu.style.scrollbarColor = '#E5E7EB transparent';

// Function to create session element
function createSessionElement(session) {
    const { id, timeRemaining, usage } = session;
    
    // Calculate if session is selectable
    const isInCooldown = session.tier?.current_cooldown_ends_at ?
        Date.now() < new Date(session.tier.current_cooldown_ends_at).getTime() : false;
    
    const isSelectable = !isInCooldown && session.tier?.current <= 3;

    const sessionDiv = document.createElement('div');
    sessionDiv.className = `px-4 py-2 text-sm text-gray-700 ${
        isSelectable ? 'hover:bg-gray-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'
    }`;

    // Build session element HTML
    sessionDiv.innerHTML = `
        <div class="flex gap-x-3 p-x-0 hover:bg-gray-50 ${isSelectable ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}">
            <!-- Thumbnail column -->
            <div class="w-12 h-12 flex-shrink-0 relative rounded overflow-hidden bg-gray-100">
                ${session.preview_image ? `
                    <img src="${session.preview_image}" 
                        class="w-12 h-12 object-cover"
                        loading="lazy"
                        onerror="this.parentElement.innerHTML='<div class=\'w-12 h-12 flex items-center justify-center text-gray-400\'><svg class=\'w-4 h-4\' fill=\'none\' stroke=\'currentColor\' viewBox=\'0 0 24 24\'><path stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\'></path></svg></div>\';"
                        alt="">
                ` : `<div class="w-12 h-12 flex items-center justify-center text-gray-400">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </div>`}
            </div>
            
            <!-- Info column -->
            <div class="flex flex-col flex-1 justify-between">
                <!-- Top row: Session ID -->
                <h4 class="font-medium text-base w-full overflow-hidden text-ellipsis">${id}</h4>
                
                <!-- Bottom row: Usage stats -->
                <div class="flex justify-between text-xs text-gray-500">
                    <span>${usage.files_count}/50 files</span>
                    <span>${(usage.total_size / (1024 * 1024)).toFixed(2)}MB/250MB</span>
                </div>
            </div>
        </div>
    `;

    if (isSelectable) {
        sessionDiv.addEventListener('click', () => selectSession(session));
    }

    return sessionDiv;
}

// Keep track of current sessions state
let currentSessions = [];

function haveSessionsChanged(newSessions) {
    // Different number of sessions
   if (currentSessions.length !== newSessions.length) return true;

   // Compare each session for changes
   return newSessions.some((newSession, index) => {
       const currentSession = currentSessions[index];
       return (
           newSession.id !== currentSession.id ||
           newSession.usage.files_count !== currentSession.usage.files_count ||
           newSession.usage.total_size !== currentSession.usage.total_size ||
           Math.abs(newSession.timeRemaining - currentSession.timeRemaining) > 1000
       );
   });
}

// Function to update sessions list
async function updateSessionsList() {
    try {
        const newSessions = await getActiveSessions();
        activeSessionsList.innerHTML = '';
        
        // Add "New Session" option
        const newSessionDiv = createNewSessionOption();
        activeSessionsList.appendChild(newSessionDiv);

        if (newSessions && newSessions.length > 0) {
            const validSessions = newSessions.filter(session => session && session.tier);
            
            if (validSessions.length > 0) {
                validSessions.forEach(session => {
                    const sessionElement = createSessionElement(session);
                    activeSessionsList.appendChild(sessionElement);
                });
            } else {
                addNoSessionsMessage('No active sessions available');
            }
        } else {
            addNoSessionsMessage('No active sessions found');
        }

        handleSelectedSessionValidity(newSessions);
    } catch (error) {
        console.error('Error updating sessions list:', error);
        activeSessionsList.innerHTML = `
            <div class="px-4 py-3 text-sm text-froly-600 text-center">
                Error loading sessions
            </div>
        `;
        resetSelectedSession();
    }
}

function createNewSessionOption() {
    const div = document.createElement('div');
    div.className = 'px-4 py-3 text-sm hover:bg-gray-50 cursor-pointer border-b border-gray-100';
    div.innerHTML = `
        <div class="flex items-center justify-center gap-x-3">
            <div class="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded bg-gray-100">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
            </div>
            <span class="font-medium">New Session</span>
        </div>
    `;
    
    div.addEventListener('click', () => {
        selectedSessionId = null;
        selectedSessionText.textContent = 'New Session';
        sessionDropDownMenu.classList.add('hidden');
        updateProcessButtonState();
    });
    
    return div;
}

function addNoSessionsMessage(message) {
    const div = document.createElement('div');
    div.className = 'px-4 py-3 text-sm text-gray-500 text-center';
    div.textContent = message;
    activeSessionsList.appendChild(div);
}

function handleSelectedSessionValidity(sessions) {
    if (selectedSessionId) {
        const selectedSessionStillValid = sessions.some(session => 
            session.id === selectedSessionId && 
            session.tier && 
            !session.tier.current_cooldown_ends_at
        );

        if (!selectedSessionStillValid) {
            resetSelectedSession();
        }
    }
}

function resetSelectedSession() {
    selectedSessionId = null;
    selectedSessionText.textContent = 'New Session';
    updateProcessButtonState();
}

// Add periodic check for session validity
function initSessionChecks() {
    setInterval(async () => {
        if (selectedSessionId) {
            const sessions = await getActiveSessions();
            const selectedSessionStillValid = sessions.some(session => 
                session.id === selectedSessionId && 
                (!session.tier.current_cooldown_ends_at || 
                 Date.now() > new Date(session.tier.current_cooldown_ends_at).getTime())
            );

            if (!selectedSessionStillValid) {
                selectedSessionId = null;
                selectedSessionText.textContent = 'New Session';
                updateProcessButtonState();
                showErrorToast('Selected session is in cooldown');
            }
        }
    }, 10000);
}

// Function to handle session selection
function selectSession(session) {
    selectedSessionId = session.id;
    selectedSessionText.textContent = `${session.id.substring(0, 3)}...${session.id.slice(-3)}`;
    sessionDropDownMenu.classList.add('hidden');
    updateProcessButtonState();
}

// Helper functions
function calculateQueueSize() {
    const selectedItems = document.querySelectorAll('.preview-item input[type="checkbox"]:checked');
    return Array.from(selectedItems).reduce((total, item) => {
        const previewItem = item.closest('.preview-item');
        return total + parseInt(previewItem.getAttribute('data-file-size'), 10);
    }, 0);
}

// Don't forget to update these in your checkbox change handlers
document.querySelectorAll('.preview-item input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
        updateProcessButtonState();
    });
});

function canSessionAcceptQueue(session, queueSize) {
    const remainingStorage = (250 * 1024 * 1024) - session.usage.total_size;
    const remainingFiles = 50 - session.usage.files_count;
    const selectedCount = document.querySelectorAll('.preview-item input[type="checkbox"]:checked').length;
    
    return remainingStorage >= queueSize && remainingFiles >= selectedCount;
}

// Initial setup
updateSessionsList();
setInterval(updateSessionsList, 10000); // Update every 10 seconds

async function getActiveSessions() {
    try {
        const sessionsRef = collection(db, "sessions");
        const querySnapshot = await getDocs(sessionsRef);
        const activeSessions = [];
        
        querySnapshot.forEach((doc) => {
            const session = doc.data();
            if (!session || !session.tier) return; // Skip invalid sessions
            
            const now = Date.now();

            const isMaxedOut = session.tier?.current === 3 && 
                             (session.usage?.files_count >= session.limits?.max_files || 
                              session.usage?.total_size >= session.limits?.max_size);

            if (!isMaxedOut) {
                activeSessions.push({
                    id: doc.id,
                    timeRemaining: session.tier?.current_cooldown_ends_at ? 
                                 new Date(session.tier.current_cooldown_ends_at).getTime() - now : 0,
                    usage: session.usage || { files_count: 0, total_size: 0 },
                    preview_image: session.preview_image,
                    tier: session.tier
                });
            }
        });

        return activeSessions;
    } catch (error) {
        console.error("Error getting active sessions:", error);
        throw error;
    }
}

// Prevent dropdown from closing when clicking inside it
sessionDropDownMenu.addEventListener('click', (e) => {
    e.stopPropagation();
});

// Function to create and show success notification
function showSuccessNotification(count, sessionId) {
    // Remove any existing notifications first
    const existingNotification = document.querySelector('.success-notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Create notification container
    const notification = document.createElement('div');
    notification.className = 'success-notification fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-4 z-50 flex items-start gap-3 max-w-md transition-all duration-300';
    notification.style.opacity = '0';

    // Create success icon
    const icon = document.createElement('div');
    icon.className = 'flex-shrink-0 w-6 h-6 rounded-full bg-green-100 flex items-center justify-center';
    icon.innerHTML = `
        <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
    `;

    // Create content container
    const content = document.createElement('div');
    content.className = 'flex-1';

    // Add title
    const title = document.createElement('h3');
    title.className = 'text-sm font-medium text-gray-900';
    title.textContent = `Successfully uploaded ${count} ${count === 1 ? 'image' : 'images'}`;

    // Add message
    const message = document.createElement('p');
    message.className = 'mt-1 text-sm text-gray-500';
    message.textContent = 'Your images are now being processed. Check Sessions to view progress.';

    // Add session ID if provided
    if (sessionId) {
        const sessionInfo = document.createElement('p');
        sessionInfo.className = 'mt-1 text-xs text-gray-400';
        sessionInfo.textContent = `Session ID: ${sessionId.substring(0, 3)}...${sessionId.slice(-3)}`;
        content.appendChild(sessionInfo);
    }

    // Add view button
    const button = document.createElement('button');
    button.className = 'mt-2 text-sm text-lochmara-600 hover:text-lochmara-500 font-medium flex items-center gap-1';
    button.innerHTML = `
        View Progress
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
        </svg>
    `;
    button.addEventListener('click', () => {
        // Handle view progress click - you can trigger the sessions view here
        console.log('View progress clicked');
        // Add your navigation logic here
    });

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'flex-shrink-0 ml-4 text-gray-400 hover:text-gray-500';
    closeButton.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
    `;
    closeButton.addEventListener('click', () => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    });

    // Assemble notification
    content.appendChild(title);
    content.appendChild(message);
    content.appendChild(button);
    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(closeButton);

    // Add to document
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
        notification.style.opacity = '1';
    }, 100);

    // Auto-hide after 10 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 20000);
}

// Function to add or remove the notification badge
function toggleSessionsBadge(show = true) {
    const sessionsButton = document.querySelector('[data-nav="sessions"]');
    if (!sessionsButton) return;

    // Remove existing badge if any
    const existingBadge = sessionsButton.querySelector('.session-badge');
    if (existingBadge) {
        existingBadge.remove();
    }

    if (show) {
        // Create the badge
        const badge = document.createElement('div');
        badge.className = 'session-badge absolute -top-1 -right-2 w-2 h-2 bg-froly-500 rounded-full';
        
        // Add a subtle pulse animation
        //badge.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
        
        // Add keyframes for pulse animation if not already in document
        // if (!document.querySelector('#session-badge-keyframes')) {
        //     const keyframes = document.createElement('style');
        //     keyframes.id = 'session-badge-keyframes';
        //     keyframes.textContent = `
        //         @keyframes pulse {
        //             0%, 100% {
        //                 opacity: 1;
        //             }
        //             50% {
        //                 opacity: .5;
        //             }
        //         }
        //     `;
        //     document.head.appendChild(keyframes);
        // }

        // Make sure the sessions button is positioned relatively
        if (getComputedStyle(sessionsButton).position === 'static') {
            sessionsButton.style.position = 'relative';
        }

        sessionsButton.appendChild(badge);
    }
}

// Function to remove badge when sessions view is opened
function removeSessionsBadge() {
    toggleSessionsBadge(false);
}

// Add click handler to sessions button to remove badge
document.querySelector('[data-nav="sessions"]')?.addEventListener('click', removeSessionsBadge);

// Example usage:
// Show badge after successful upload
// toggleSessionsBadge(true);

// Remove badge when viewing sessions
// removeSessionsBadge();

function updateUploadUI(previewItem, progress) {
    const progressFill = previewItem.querySelector('[data-status]');
    const statusText = previewItem.querySelector('.status-text');

    switch(progress.status) {
        case 'uploading':
            progressFill.style.width = `${progress.progress}%`;
            let statusMessage = `${Math.round(progress.progress)}% • ${progress.speed}MB/s`;
            if (progress.willTriggerCooldown) {
                statusMessage += ' • Will trigger cooldown';
                progressFill.classList.add('bg-gold-sand-500');
            }
            statusText.textContent = statusMessage;
            break;

        case 'complete':
            progressFill.style.width = '100%';
            progressFill.className = 'h-full bg-green-500 transition-all duration-300';
            statusText.textContent = progress.triggeredCooldown ? 
                'Complete - Cooldown Started' : 
                'Complete';
            previewItem.uploadedUrl = progress.downloadURL;
            
            if (progress.triggeredCooldown) {
                updateSessionStatsUI();
                showCooldownNotification(progress.nextTier);
            }
            break;

        case 'error':
            progressFill.className = 'h-full bg-red-500 transition-all duration-300';
            statusText.textContent = progress.error;
            break;
    }
}

function showCooldownNotification(nextTier) {
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white shadow-lg rounded-lg p-4 z-50 flex items-start gap-3';
    
    notification.innerHTML = `
        <div class="flex-shrink-0 w-6 h-6 rounded-full bg-gold-sand-100 flex items-center justify-center">
            <svg class="w-4 h-4 text-gold-sand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        </div>
        <div>
            <h3 class="font-medium">Tier Cooldown Started</h3>
            <p class="text-sm text-gray-500">Next tier: ${nextTier.max_files} files, ${formatFileSize(nextTier.max_size)} total</p>
        </div>
    `;

    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}