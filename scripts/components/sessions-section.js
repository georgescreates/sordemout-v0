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