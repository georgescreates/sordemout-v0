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

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    // dropZone.classList.remove('border-lochmara-500');
    dropZone.classList.remove('bg-silver-chalice-50');
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
});

// Handle file selection
fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
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
            updateAllStats();
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
function handleFiles(files) {
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
            updateAllStats();
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

function handleSelectAll(checked) {
    const previewItems = document.querySelectorAll('.preview-item');
    
    previewItems.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        const statusText = item.querySelector('.status-text');
        const progressFill = item.querySelector('div[data-status]');
        
        // Skip rejected files
        if (progressFill?.classList.contains('bg-red-500')) {
            return;
        }

        // Update checkbox state
        if (!checkbox.disabled) {
            checkbox.checked = checked;
            
            // Update status based on checkbox state
            if (checked) {
                setReadyStatus(statusText, item);
            } else {
                setAbortedStatus(statusText, item);
            }
        }
    });
    
    // Update UI states
    updateProcessButtonState();
    updateQueueStats();
}

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

function updateQueueStats() {
    const queueStatsFiles = document.querySelectorAll('.queue-stats-file');
    
    if (queueStatsFiles.length) {
        const selectedCount = previewGrid.querySelectorAll('input[type="checkbox"]:checked').length;
        queueStatsFiles[0].textContent = `${selectedCount}/10`; // Adjust max as needed
    }
}

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
    // Show preview grid if hidden
    emptyState.classList.add('hidden');
    previewGrid.classList.remove('hidden');

    // Only set base classes
    previewGrid.className = 'w-full h-[552px] overflow-y-auto flex flex-col space-y-4';
    
    if (!isStackMode) {
        previewGrid.innerHTML = '';
    }

    for (const url of urls) {
        // Get size before creating preview
        const sizeInfo = await getImageSize(url);

        const preview = document.createElement('div');
        preview.setAttribute('data-preview-id', url);
        preview.setAttribute('data-file-size', sizeInfo.size);
        // Default to list view layout
        preview.className = 'preview-item h-20 min-h-[5rem] flex items-center w-full bg-white rounded-sm overflow-hidden relative';

        // Checkbox container
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'absolute top-2 left-2 z-10';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500';
        checkbox.checked = sizeInfo.size <= 5; // Only check if valid size

        // Image container - default to list view
        const imgContainer = document.createElement('div');
        imgContainer.className = 'h-20 w-20 flex-shrink-0';

        const img = document.createElement('img');
        img.className = 'w-full h-full object-cover';
        img.src = url;

        // File info section - default to list view
        const fileInfo = document.createElement('div');
        fileInfo.className = 'flex-1 h-20 px-4 flex flex-col justify-center gap-2';

        // Progress container
        const progressContainer = document.createElement('div');
        progressContainer.className = 'w-full flex flex-col gap-1';

        const progressBar = document.createElement('div');
        progressBar.className = 'h-1 bg-gray-200 rounded-full overflow-hidden';

        const progressFill = document.createElement('div');
        progressFill.className = 'h-full transition-all duration-300';
        progressFill.style.width = '0%';
        progressFill.setAttribute('data-status', 'uploading');

        const statusContainer = document.createElement('div');
        statusContainer.className = 'flex items-center justify-between text-xs';

        const statusText = document.createElement('span');
        statusText.className = 'status-text text-gray-500';

        const progressSize = document.createElement('span');
        progressSize.className = 'text-xs text-gray-500';
        progressSize.textContent = sizeInfo.displaySize;

        // File header
        const fileHeader = document.createElement('div');
        fileHeader.className = 'flex justify-between items-center';
        const fileName = url.split('/').pop() || 'image';
        fileHeader.innerHTML = `
            <p class="text-base font-bold truncate">${fileName}</p>
        `;

        // Assemble all elements
        statusContainer.appendChild(statusText);
        statusContainer.appendChild(progressSize);
        
        progressBar.appendChild(progressFill);
        progressContainer.appendChild(progressBar);
        progressContainer.appendChild(statusContainer);

        fileInfo.appendChild(fileHeader);
        fileInfo.appendChild(progressContainer);

        imgContainer.appendChild(img);
        checkboxContainer.appendChild(checkbox);

        preview.appendChild(checkboxContainer);
        preview.appendChild(imgContainer);
        preview.appendChild(fileInfo);

        // Handle initial state based on size validation
        if (sizeInfo.size > 5) {
            setRejectedStatus(statusText, preview);
            showErrorToast(`File size (${sizeInfo.displaySize}) exceeds 5MB limit`);
            checkbox.checked = false;
            checkbox.disabled = true;
            
            progressFill.className = 'h-full bg-red-500 transition-all duration-300';
            progressFill.setAttribute('data-status', 'rejected');
            progressFill.style.width = '100%';
        } else {
            // For valid files, start upload simulation
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
                    setReadyStatus(statusText, preview);
                    updateAllStats();
                    updateProcessButtonState();
                    updateSelectAllState();
                }
            }, 100);

            // Add checkbox event listener only for valid files
            checkbox.addEventListener('change', (e) => {
                if (!e.target.checked) {
                    setAbortedStatus(statusText, preview);
                } else {
                    setReadyStatus(statusText, preview);
                }
                updateAllStats();
                updateProcessButtonState();
                updateSelectAllState();
            });
        }

        if (isStackMode) {
            previewGrid.insertBefore(preview, previewGrid.firstChild);
        } else {
            previewGrid.appendChild(preview);
        }

        // Add click hint
        const clickHint = document.createElement('span');
        clickHint.className = 'absolute right-2 top-2 text-xs text-gray-400';
        clickHint.textContent = 'Click to preview';
        preview.appendChild(clickHint);

        // Add cursor pointer and hover effect to preview item
        preview.classList.add('cursor-pointer', 'hover:bg-gray-50');

        // Add modal click handler
        addModalClickHandler(preview);
    }

    // Apply current view layout after adding all items
    updateProcessButtonState();
}

// Function to update all stats
function updateAllStats() {
    updateSessionStats();
    updateQueueStats();
}

// Add function to update session stats
function updateSessionStats() {
    const previewItems = document.querySelectorAll('.preview-item');
    let totalFiles = 0;
    let totalSize = 0;

    previewItems.forEach(item => {
        const progressFill = item.querySelector('div[data-status]');
        const status = progressFill?.getAttribute('data-status');
        const checkbox = item.querySelector('input[type="checkbox"]');
        
        if (status === 'ready' && checkbox?.checked) {
            totalFiles++;
            const fileSize = parseInt(item.getAttribute('data-file-size'));
            totalSize += fileSize;
        }
    });

    document.getElementById('session-upload-count-files').textContent = `${String(totalFiles).padStart(2, '0')}/50`;
    document.getElementById('session-upload-count-size').textContent = `${(totalSize / (1024 * 1024)).toFixed(2)}MB/250MB`;
}

// Helper function to convert size text to bytes
function convertSizeToBytes(sizeText) {
    const size = parseFloat(sizeText);
    if (sizeText.includes('MB')) return size * 1024 * 1024;
    if (sizeText.includes('KB')) return size * 1024;
    return size;
}

// Function to update queue stats
function updateQueueStats() {
    const previewItems = document.querySelectorAll('.preview-item');
    let queueFiles = 0;
    let queueSize = 0;

    previewItems.forEach(item => {
        const progressFill = item.querySelector('.bg-blue-500, .bg-green-500, .bg-gray-200');
        const status = progressFill.getAttribute('data-status');
        const checkbox = item.querySelector('input[type="checkbox"]');
        
        if (status === 'ready' && checkbox.checked) {
            queueFiles++;
            const sizeText = item.querySelector('.text-xs').textContent;
            queueSize += parseFloat(sizeText) * (sizeText.includes('MB') ? 1024 * 1024 : 1024);
        }
    });

    // Update DOM elements
    const queueStatsFiles = document.getElementById('queue-stats-file-count');
    const queueStatsUsage = document.getElementById('queue-stats-file-usage');
    
    if (queueStatsFiles) {
        queueStatsFiles.textContent = `${String(queueFiles).padStart(2, '0')}/10`;
    }
    
    if (queueStatsUsage) {
        queueStatsUsage.textContent = `${(queueSize / (1024 * 1024)).toFixed(2)}MB/50MB`;
    }
}

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
function updateProcessButtonState() {
    const processButton = document.querySelector('#upl-client-firebase-btn');
    if (!processButton) return;

    const fileItems = document.querySelectorAll('.preview-item');
    const readyFiles = Array.from(fileItems).filter(item => {
        const progressFill = item.querySelector('div[data-status]');
        const checkbox = item.querySelector('input[type="checkbox"]');
        const status = progressFill?.getAttribute('data-status');
        
        // Must be ready, checked, and not rejected
        return status === 'ready' && 
               checkbox?.checked && 
               !checkbox?.disabled && 
               !progressFill.classList.contains('bg-red-500');
    });

    const count = readyFiles.length;
    processButton.innerHTML = `Process ${count > 2 ? `${count}` : ''} Selected Files`;

    if (count >= 3) {
        processButton.classList.remove('cursor-not-allowed', 'opacity-50');
        processButton.disabled = false;
    } else {
        processButton.classList.add('cursor-not-allowed', 'opacity-50');
        processButton.disabled = true;
    }
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
});