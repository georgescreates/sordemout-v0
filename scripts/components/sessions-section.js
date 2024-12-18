import { db } from '../firebase-config.js';
import { getDoc, getDocs, doc, updateDoc, deleteDoc, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
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
const sessionItemsContainer = document.querySelector('.sessions-tab-list');

sessionItemsContainer.addEventListener('click', (event) => {
    const sessionItem = event.target.closest('.session-tab-list-item');
    if (sessionItem) {
        // Get the index of the clicked session item
        const index = Array.from(sessionItem.parentNode.children).indexOf(sessionItem);

        // Get current state from data attribute
        const isExpanded = sessionItem.dataset.bodyExpanded === "true";

        // Toggle the state
        sessionItem.dataset.bodyExpanded = (!isExpanded).toString();

        // Update the body height if we have a matching body element
        if (sessionItemBody[index]) {
            if (!isExpanded) {
                sessionItemBody[index].classList.remove('hidden');
            } else {
                sessionItemBody[index].classList.add('hidden');
            }
        }
    }
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
    return `Session ${session.id.substring(0, 3)}...${session.id.slice(-3)}`;
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

function initializeTimeUpdates() {
    const UPDATE_INTERVAL = 10000; // 10 seconds

    setInterval(() => {
        const sessionHeaders = document.querySelectorAll('.session-tab-list-item');
        
        sessionHeaders.forEach(header => {
            const createdSpan = header.querySelector('.text-sm.text-silver-chalice-400.italic');
            const timestamp = createdSpan.dataset.timestamp; // Add this data attribute
            
            if (timestamp) {
                createdSpan.textContent = `Created ${formatCreatedTime(new Date(parseInt(timestamp)))}`;
            }
        });
    }, UPDATE_INTERVAL);
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

function formatLongDuration(expiresAt) {
    if (!expiresAt?.toDate) return '';
    
    const expiry = expiresAt.toDate();
    const now = new Date();
    
    if (now > expiry) return 'Expired';
    
    const timeLeft = expiry - now;
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
 
    if (days > 0) return `Expiring in ${days}d`;
    if (hours > 0) return `Expiring in ${hours}h`;
    return `Expiring in ${minutes}m`;
 }

function createSessionElement(session) {
    const sessionElement = document.createElement('li');
    sessionElement.className = 'session-tab-list-item border-b border-silver-chalice-300 py-2 w-full h-auto flex flex-col';
    sessionElement.dataset.bodyExpanded = "false";
    sessionElement.dataset.sessionId = session.id;

    sessionElement.innerHTML = `
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
                        <span class="text-sm text-silver-chalice-400 italic">${formatLongDuration(session.expires_at)}</span>
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
    `;

    const header = sessionElement.querySelector('.session-item-header');
    header.addEventListener('click', (e) => {
        e.stopPropagation();
        const body = sessionElement.querySelector('.session-item-body');
        const currentState = body.classList.contains('hidden');
        
        if (currentState) {
            body.classList.remove('hidden');
            displaySessionFiles(session.id);
        } else {
            body.classList.add('hidden');
        }
    });

    return sessionElement;
}

// In browse-files.js or a new module
function displaySessionFiles(sessionId) {
    const sessionElement = document.querySelector(`[data-session-id="${sessionId}"]`);
    const sessionBody = sessionElement.querySelector('.session-item-body');
    
    let galleryContainer = sessionBody.querySelector('.session-item-galery-grid');
    if (!galleryContainer) {
        galleryContainer = document.createElement('div');
        galleryContainer.className = 'session-item-galery-grid flex gap-x-2 w-full h-auto overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:\'none\'] [scrollbar-width:\'none\'] mt-2';
        sessionBody.appendChild(galleryContainer);
    }
 
    galleryContainer.innerHTML = '';
 
    const filesRef = collection(db, "sessions", sessionId, "files");
    getDocs(filesRef).then(querySnapshot => {
        querySnapshot.forEach(doc => {
            const fileData = doc.data();
            const fileElement = document.createElement('div');
            fileElement.className = 'session-item-file w-[5rem] h-[5rem] bg-silver-chalice-200 rounded shrink-0 p-1.5 group relative';
            fileElement.dataset.fileId = doc.id;
            fileElement.dataset.fileVisibility = "true";
 
            fileElement.innerHTML = `
                <div class="session-item-file-ctas-container flex gap-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button class="session-file-visibility-btn w-5 h-5 flex items-center justify-center bg-gold-sand-50 rounded">
                        <svg class="fill-lochmara-950 stroke-lochmara-950 visibility-icon" xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px">
                            <path d="M480.09-336.92q67.99 0 115.49-47.59t47.5-115.58q0-67.99-47.59-115.49t-115.58-47.5q-67.99 0-115.49 47.59t-47.5 115.58q0 67.99 47.59 115.49t115.58 47.5ZM480-392q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 172q-126.31 0-231.04-67.39-104.73-67.38-167.19-177.3-5-8.62-7.31-17.37-2.3-8.75-2.3-17.96t2.3-17.94q2.31-8.73 7.31-17.35 62.46-109.92 167.19-177.3Q353.69-780 480-780q126.31 0 231.04 67.39 104.73 67.38 167.19 177.3 5 8.62 7.31 17.37 2.3 8.75 2.3 17.96t-2.3 17.94q-2.31 8.73-7.31 17.35-62.46 109.92-167.19 177.3Q606.31-220 480-220Zm0-280Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z"/>
                        </svg>
                        <svg class="fill-lochmara-950 stroke-lochmara-950 visibility-off-icon hidden" xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px">
                            <path d="M595.08-615.08q24.38 24.39 37.69 59.27 13.31 34.89 10.07 70.04 0 11.54-8.3 19.54-8.31 8-19.85 8-11.54 0-19.54-8t-8-19.54q3.85-26.38-4.34-50-8.19-23.61-25.19-40.61t-41-25.81q-24-8.81-50.62-4.58-11.54.39-19.92-7.73-8.39-8.11-8.77-19.65-.39-11.54 7.42-19.93 7.81-8.38 19.35-8.76 34.92-4 70.19 9.11 35.27 13.12 60.81 38.65ZM480-720q-21.31 0-41.81 2.08-20.5 2.07-40.81 6.84-12.77 2.62-23-3.65t-14.07-18.04q-3.85-12.15 2.54-23.11 6.38-10.96 18.53-13.58 24.16-5.77 48.81-8.15Q454.85-780 480-780q128.92 0 236.85 67 107.92 67 165.99 181.31 4 7.61 5.81 15.34 1.81 7.73 1.81 16.35 0 8.62-1.5 16.35-1.5 7.73-5.5 15.34-18.38 38.46-44.69 71.73t-57.93 61.12q-9.3 8.31-21.26 6.88-11.97-1.42-19.66-11.96-7.69-10.54-6.38-22.61 1.31-12.08 10.61-20.39 27.08-24.54 49.39-53.65Q815.85-466.31 832-500q-50-101-144.5-160.5T480-720Zm0 500q-126.31 0-231.54-67.5Q143.23-355 81.16-465.31q-5-7.61-7.31-16.54-2.31-8.92-2.31-18.15 0-9.23 2-17.85 2-8.61 7-16.84 22.31-40.77 50.54-77.66 28.23-36.88 64.92-66.11l-90.31-90.93q-8.3-8.92-8.19-21.19.12-12.27 8.81-20.96 8.69-8.69 21.08-8.69 12.38 0 21.07 8.69l663.08 663.08q8.31 8.31 8.81 20.57.5 12.27-8.81 21.58-8.69 8.69-21.08 8.69-12.38 0-21.07-8.69L628.62-245.85q-35.39 13.69-72.74 19.77Q518.54-220 480-220ZM238.16-636.31q-35.16 27.16-63.2 61.42Q146.92-540.62 128-500q50 101 144.5 160.5T480-280q25.77 0 50.73-3.46 24.96-3.46 49.58-10.69L529.69-346q-12.15 5.31-24.27 7.19-12.11 1.89-25.42 1.89-68.08 0-115.58-47.5T316.92-500q0-13.31 2.08-25.42 2.08-12.12 7-24.27l-87.84-86.62ZM541-531Zm-131.77 65.77Z"/>
                        </svg>
                    </button>
                    <button class="session-file-delete-btn w-5 h-5 flex items-center justify-center bg-gold-sand-50 rounded">
                        <svg class="fill-lochmara-950 stroke-lochmara-950" xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px">
                            <path d="M292.31-140q-29.83 0-51.07-21.24Q220-182.48 220-212.31V-720h-10q-12.75 0-21.37-8.63-8.63-8.63-8.63-21.38 0-12.76 8.63-21.37Q197.25-780 210-780h150q0-14.69 10.35-25.04 10.34-10.34 25.03-10.34h169.24q14.69 0 25.03 10.34Q600-794.69 600-780h150q12.75 0 21.37 8.63 8.63 8.63 8.63 21.38 0 12.76-8.63 21.37Q762.75-720 750-720h-10v507.69q0 29.83-21.24 51.07Q697.52-140 667.69-140H292.31ZM680-720H280v507.69q0 5.39 3.46 8.85t8.85 3.46h375.38q5.39 0 8.85-3.46t3.46-8.85V-720ZM406.17-280q12.75 0 21.37-8.62 8.61-8.63 8.61-21.38v-300q0-12.75-8.63-21.38-8.62-8.62-21.38-8.62-12.75 0-21.37 8.62-8.61 8.63-8.61 21.38v300q0 12.75 8.62 21.38 8.63 8.62 21.39 8.62Zm147.69 0q12.75 0 21.37-8.62 8.61-8.63 8.61-21.38v-300q0-12.75-8.62-21.38-8.63-8.62-21.39-8.62-12.75 0-21.37 8.62-8.61 8.63-8.61 21.38v300q0 12.75 8.63 21.38 8.62 8.62 21.38 8.62ZM280-720v520-520Z"/>
                        </svg>
                    </button>
                </div>
            `;
 
            galleryContainer.appendChild(fileElement);

            // Set background after append
            requestAnimationFrame(() => {
                fileElement.style.cssText = `
                    background-image: url('${fileData.storage_url}');
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                `;
            });

            // Add click handler in displaySessionFiles()
            fileElement.querySelector('.session-file-delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();

                if (await handleFileDelete(sessionId, doc.id)) {
                    fileElement.remove();
                }
            });
        });
    });
 }

async function handleFileDelete(sessionId, fileId) {
    const sessionRef = doc(db, "sessions", sessionId);
    const sessionSnap = await getDoc(sessionRef);
    const session = sessionSnap.data();

    // Check remaining files count
    const filesRef = collection(db, "sessions", sessionId, "files");
    const filesSnap = await getDocs(filesRef);

    if (filesSnap.size <= 3) {
        showError("Cannot delete - minimum 3 files required");
        return false;
    }

    try {
        // Delete from Firestore
        await deleteDoc(doc(filesRef, fileId));

        // Update session stats
        await updateDoc(sessionRef, {
            "usage.files_count": increment(-1),
            "usage.total_size": increment(-session.files[fileId].size)
        });

        return true;
    } catch (error) {
        console.error("Error deleting file:", error);
        return false;
    }
}

function showError(message) {
    const errorToast = document.createElement('div');
    errorToast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg';
    errorToast.textContent = message;
    document.body.appendChild(errorToast);
    setTimeout(() => errorToast.remove(), 3000);
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
document.addEventListener('DOMContentLoaded', initializeTimeUpdates);

// Export for use in other modules
export { initializeSessionsList, initializeSessionRename };