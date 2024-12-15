import { db } from '../firebase-config.js';
import { getDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { collection, query, orderBy, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    const sessionSortDropDownButton = document.getElementById('sessions-sort-dropdown');
    const sessionSortDropDownMenu = document.getElementById('sessions-sort-menu');
    const sessionSortSelectedType = document.getElementById('session-selected-type');

    // Toggle dropdown when button is clicked
    sessionSortDropDownButton.addEventListener('click', function(e) {
        e.stopPropagation();
        sessionSortDropDownMenu.classList.toggle('hidden');
    });

    // Handle menu item selection
    sessionSortDropDownMenu.addEventListener('click', function(e) {
        if (e.target.tagName === 'A') {
            e.preventDefault();
            const value = e.target.getAttribute('data-value');
            sessionSortSelectedType.textContent = e.target.textContent;
            sessionSortDropDownMenu.classList.add('hidden');
            
            // You can add additional logic here to handle the selection
            // For example, trigger a sort function or update the UI
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!sessionSortDropDownButton.contains(e.target) && !sessionSortDropDownMenu.contains(e.target)) {
            sessionSortDropDownMenu.classList.add('hidden');
        }
    });
});

let sessionItem = Array.from(document.getElementsByClassName('session-tab-list-item'));
let sessionItemHead = Array.from(document.getElementsByClassName('session-item-header'));
let sessionItemBody = Array.from(document.getElementsByClassName('session-item-body'));

sessionItem.forEach((item, index) => {
    item.addEventListener('click', () => {
        // Get current state from data attribute
        const isExpanded = item.dataset.bodyExpanded === "true";
        
        // Toggle the state
        item.dataset.bodyExpanded = (!isExpanded).toString();
        
        // Update the body height if we have a matching body element
        if (sessionItemBody[index]) {
            if (!isExpanded) {
                sessionItemBody[index].classList.remove('hidden');
            } else {
                sessionItemBody[index].classList.add('hidden');
            }
        }
    })
});

// Get all filter containers
const filterContainers = document.querySelectorAll('.session-filter-container');

// Add click handler to each container
filterContainers.forEach(container => {
    container.addEventListener('click', (e) => {
        e.stopPropagation();
        // Find the checkbox within this container
        const checkbox = container.querySelector('input[type="checkbox"]');
        
        // Don't toggle if clicking the checkbox itself (it will handle its own state)
        if (e.target !== checkbox) {
            // Toggle the checkbox
            checkbox.checked = !checkbox.checked;
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all sliders
    document.querySelectorAll('.session-slider-container').forEach(initializeSlider);
});

function initializeSlider(container) {
    const minHandle = container.querySelector('.min-handle');
    const maxHandle = container.querySelector('.max-handle');
    const activeTrack = container.querySelector('.active-track');
    const minValue = container.querySelector('.min-value');
    const maxValue = container.querySelector('.max-value');
    
    let isDragging = null;
    
    function positionToPercent(position) {
        const bounds = container.getBoundingClientRect();
        let percent = ((position - bounds.left) / bounds.width) * 100;
        return Math.min(Math.max(percent, 0), 100);
    }
    
    function updateSlider(handle, percent) {
        const minPercent = parseFloat(minHandle.style.left);
        const maxPercent = parseFloat(maxHandle.style.left);
        
        if (handle === minHandle && percent <= maxPercent) {
            handle.style.left = `${percent}%`;
            minValue.textContent = `${Math.round(percent)}%`;
        }
        
        if (handle === maxHandle && percent >= minPercent) {
            handle.style.left = `${percent}%`;
            maxValue.textContent = `${Math.round(percent)}%`;
        }

        // Always update active track
        activeTrack.style.left = `${minPercent}%`;
        activeTrack.style.right = `${100 - maxPercent}%`;
    }

    function showLabels() {
        minValue.style.opacity = '1';
        maxValue.style.opacity = '1';
    }

    function hideLabels() {
        if (!isDragging) {
            minValue.style.opacity = '0';
            maxValue.style.opacity = '0';
        }
    }
    
    function handleMouseDown(e) {
        isDragging = e.target;
        showLabels();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    function handleMouseMove(e) {
        if (!isDragging) return;
        const percent = positionToPercent(e.clientX);
        updateSlider(isDragging, percent);
    }
    
    function handleMouseUp() {
        isDragging = null;
        hideLabels();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
    
    function handleTouchStart(e) {
        isDragging = e.target;
        showLabels();
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', handleTouchEnd);
    }
    
    function handleTouchMove(e) {
        if (!isDragging) return;
        const touch = e.touches[0];
        const percent = positionToPercent(touch.clientX);
        updateSlider(isDragging, percent);
        e.preventDefault();
    }
    
    function handleTouchEnd() {
        isDragging = null;
        hideLabels();
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
    }
    
    // Add event listeners for this specific slider
    minHandle.addEventListener('mousedown', handleMouseDown);
    maxHandle.addEventListener('mousedown', handleMouseDown);
    minHandle.addEventListener('touchstart', handleTouchStart);
    maxHandle.addEventListener('touchstart', handleTouchStart);
    minHandle.addEventListener('mouseenter', showLabels);
    minHandle.addEventListener('mouseleave', hideLabels);
    maxHandle.addEventListener('mouseenter', showLabels);
    maxHandle.addEventListener('mouseleave', hideLabels);
}

let sessionFiles = document.getElementsByClassName('session-item-file');
let sessionFileVisibilityBtn = document.getElementsByClassName('session-file-visibility-btn');
let sessionFileVisibilityIcon = document.getElementsByClassName('visibility-icon');
let sessionFileVisibilityOffIcon = document.getElementsByClassName('visibility-off-icon');

for(let i = 0; i < sessionFiles.length; i++){
    sessionFileVisibilityBtn[i].addEventListener('click', (e) => {
        e.stopPropagation();

        if(sessionFiles[i].dataset.fileVisibility == "true"){
            sessionFiles[i].dataset.fileVisibility = "false";

            sessionFileVisibilityIcon[i].classList.add('hidden');
            sessionFileVisibilityOffIcon[i].classList.remove('hidden');

            sessionFiles[i].classList.add('opacity-50');
        }else{
            sessionFiles[i].dataset.fileVisibility = "true";

            sessionFileVisibilityIcon[i].classList.remove('hidden');
            sessionFileVisibilityOffIcon[i].classList.add('hidden');

            sessionFiles[i].classList.remove('opacity-50');
        }
    })
}




// DOM Elements
const sessionsTabList = document.querySelector('.sessions-tab-list');
const emptyState = document.querySelector('.sessions-tab-empty');

function getSessionDisplayName(session) {
    // Check if session has a name property and it's not empty
    if (session.name && session.name.trim() !== '') {
        return session.name;
    }
    // Fallback to ID with prefix
    return `Session ${session.id.substring(0, 6)}`;
}

function isValidTimestamp(timestamp) {
    return timestamp && timestamp.toDate && typeof timestamp.toDate === 'function';
}

function formatTimeRemaining(timestamp) {
    if (!isValidTimestamp(timestamp)) return 'N/A';

    try {
        const expiresAt = timestamp.toDate();
        const now = new Date();

        if (now > expiresAt) {
            return 'Expired';
        }

        const timeLeft = expiresAt - now;
        const minutes = Math.floor(timeLeft / 60000); // 60000ms = 1 minute

        if (minutes < 60) return `${minutes}m`;
        if (minutes < 1440) return `${Math.floor(minutes/60)}h`; // 1440 = minutes in a day
        return `${Math.floor(minutes/1440)}d`;
    } catch {
        return 'N/A';
    }
}

function formatCreatedTime(timestamp) {
    if (!timestamp) return 'N/A';

    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }

        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days > 0) {
            return `${days}d ago`;
        } else if (hours > 0) {
            return `${hours}h ago`;
        } else {
            return `${minutes}m ago`;
        }
    } catch (error) {
        console.error('Error formatting creation time:', error);
        return 'N/A';
    }
}

function createSessionElement(session) {
    const template = `
        <li class="session-tab-list-item border-b border-silver-chalice-300 py-2 w-full h-auto flex flex-col" data-body-expanded="false">
            <div class="w-full h-10 session-item-header flex justify-between gap-x-4 cursor-pointer hover:bg-silver-chalice-50">
                <div class="h-full min-h-10 w-8 flex items-center justify-center">
                    <input type="checkbox" class="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500">
                </div>
                <div class="h-full min-h-10 w-10 flex items-center">
                    <div class="h-10 w-10 rounded bg-silver-chalice-200">
                        ${session.preview_image ? `<img src="${session.preview_image}" class="h-full w-full object-cover rounded" alt="Preview"/>` : ''}
                    </div>
                </div>
                <div class="flex-[2] h-full min-h-10 flex flex-col overflow-hidden">
                    <h4 class="text-lochmara-950 font-medium leading-none w-full truncate">${getSessionDisplayName(session)}</h4>
                    <div class="flex gap-x-2">
                        <span class="text-sm text-silver-chalice-400 italic">Created ${formatCreatedTime(session.created_at)}</span>
                        <span class="text-sm text-silver-chalice-400 italic">•</span>
                        <span class="text-sm text-silver-chalice-400 italic">Expiring in ${formatTimeRemaining(session.expires_at)}</span>
                    </div>
                </div>
                <div class="flex-[2] h-full min-h-10 flex flex-col justify-center gap-y-1">
                    <div class="session-file-count-progress-bar-container w-[80%] h-2 rounded-[1rem] bg-lochmara-200">
                        <div class="session-file-count-progress-bar h-full rounded-[1rem] bg-lochmara-600" 
                            style="width: ${((session.usage?.files_count || 0) / session.limits.max_files) * 100}%"></div>
                    </div>
                    <div class="flex justify-between text-sm mb-1 w-[80%] font-medium">
                        <span>${session.usage?.files_count || 0} files</span>
                        <span>out of ${session.limits.max_files} files</span>
                    </div>
                </div>
                <div class="flex-[2] h-full min-h-10 flex flex-col justify-center gap-y-1">
                    <div class="session-usage-progress-bar-container w-[80%] h-2 rounded-full bg-lochmara-200">
                        <div class="session-usage-progress-bar h-full rounded-[1rem] bg-lochmara-600" 
                            style="width: ${((session.usage?.total_size || 0) / ((session.limits.max_size / (1024 * 1024)) * 1024 * 1024)) * 100}%"></div>
                    </div>
                    <div class="flex justify-between text-sm mb-1 w-[80%] font-medium">
                        <span>${((session.usage?.total_size || 0) / (1024 * 1024)).toFixed(2)}MB</span>
                        <span>out of ${(session.limits.max_size / (1024 * 1024))}MB</span>
                    </div>
                </div>
                <div class="flex-[1] h-full min-h-10 flex items-center">
                    ${getStatusLabel(session)}
                </div>
            </div>
            <div class="session-item-body w-full h-auto px-3 py-2 flex flex-col gap-y-2 hidden">
                <!-- Body content populated when expanded -->
            </div>
        </li>
    `;

    const element = document.createElement('div');
    element.innerHTML = template;
    return element.firstElementChild;
}

function getStatusLabel(session) {
    if (!session.expires_at) {
        return `<span class="session-item-status-label px-2 py-1 bg-silver-chalice-100 rounded flex items-center justify-center text-sm text-silver-chalice-700 font-medium">unknown</span>`;
    }

    const now = new Date();
    const expiresAt = session.expires_at.toDate();
    const cooldownEndsAt = session.cooldown_ends_at?.toDate();

    if (now > expiresAt) {
        if (cooldownEndsAt && now < cooldownEndsAt) {
            return `<span class="session-item-status-label px-2 py-1 bg-froly-100 rounded flex items-center justify-center text-sm text-froly-700 font-medium">cooldown</span>`;
        }
        return `<span class="session-item-status-label px-2 py-1 bg-silver-chalice-100 rounded flex items-center justify-center text-sm text-silver-chalice-700 font-medium">expired</span>`;
    }
    return `<span class="session-item-status-label px-2 py-1 bg-puerto-rico-100 rounded flex items-center justify-center text-sm text-puerto-rico-700 font-medium">active</span>`;
}

function initializeSessionsList() {
    // Create query for sessions sorted by creation time
    const sessionsQuery = query(collection(db, "sessions"), orderBy("created_at", "desc"));

    // Set up real-time listener
    onSnapshot(sessionsQuery, (snapshot) => {
        const sessions = [];
        snapshot.forEach((doc) => {
            sessions.push({ id: doc.id, ...doc.data() });
        });

        // Update UI based on sessions
        if (sessions.length === 0) {
            sessionsTabList.classList.add('hidden');
            emptyState.classList.remove('hidden');
        } else {
            sessionsTabList.classList.remove('hidden');
            emptyState.classList.add('hidden');
            
            // Clear existing sessions and add new ones
            sessionsTabList.innerHTML = '';
            sessions.forEach(session => {
                const sessionElement = createSessionElement(session);
                sessionsTabList.appendChild(sessionElement);
                initializeSessionRename(sessionElement, session);
            });
        }
    }, (error) => {
        console.error("Error fetching sessions:", error);
        // Show error state if needed
    });
}

function makeSessionNameEditable(sessionElement, session) {
    const nameElement = sessionElement.querySelector('h4');
    
    nameElement.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (nameElement.querySelector('input')) return;
        
        const currentName = session.name || `Session ${session.id.substring(0, 6)}`;
        const originalHtml = nameElement.innerHTML;
        
        nameElement.innerHTML = `
            <input type="text" 
                class="w-full px-1 py-0.5 border border-lochmara-300 rounded text-base focus:outline-none focus:border-lochmara-500" 
                value="${currentName}"
                maxlength="50">
        `;
        
        const input = nameElement.querySelector('input');
        input.focus();
        input.select();
        
        const validateName = (name) => {
            return /^[a-zA-Z0-9-_ ]{1,50}$/.test(name);
        };

        const saveNewName = async (newName) => {
            if (!validateName(newName)) {
                alert('Name must be 1-50 characters and contain only letters, numbers, spaces, dash or underscore');
                input.focus();
                return false;
            }

            try {
                const sessionRef = doc(db, "sessions", session.id);
                nameElement.innerHTML = `
                    <span class="inline-flex items-center gap-2">
                        ${newName}
                        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </span>
                `;
                
                await updateDoc(sessionRef, {
                    name: newName
                });
                
                nameElement.innerHTML = newName;
                return true;
            } catch (error) {
                console.error('Error updating session name:', error);
                nameElement.innerHTML = originalHtml;
                alert('Failed to update session name. Please try again.');
                return false;
            }
        };

        const handleBlur = () => {
            const newName = input.value.trim();
            if (newName !== currentName) {
                saveNewName(newName);
            } else {
                nameElement.innerHTML = originalHtml;
            }
        };

        input.addEventListener('blur', handleBlur);
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                nameElement.innerHTML = originalHtml;
            }
        });
    });
}

// Add this to your session element creation
function initializeSessionRename(sessionElement, session) {
    makeSessionNameEditable(sessionElement, session);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', initializeSessionsList);

// Export for use in other modules
export { initializeSessionsList, initializeSessionRename };