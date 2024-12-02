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