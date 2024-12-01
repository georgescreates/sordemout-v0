// Get all bottom navigation buttons and sections
const uploadBtn = document.querySelector('[data-nav="upload"]');
const sessionBtn = document.querySelector('[data-nav="session"]');
const settingsBtn = document.querySelector('[data-nav="settings"]');

const uploadSection = document.getElementById('upload-section');
const sessionSection = document.getElementById('session-section');
const settingsSection = document.getElementById('settings-section');

// Initially hide session and settings sections
uploadSection.classList.add('hidden');
// sessionSection.classList.add('hidden');
settingsSection.classList.add('hidden');

// Initially set upload button as active
uploadBtn.classList.remove('text-lochmara-600');
sessionBtn.classList.add('text-lochmara-600');
settingsBtn.classList.remove('text-lochmara-600');

// Function to show active section and hide others
function toggleSection(activeSectionId, activeButton) {
    // Get all sections and buttons
    const sections = [uploadSection, sessionSection, settingsSection];
    const buttons = [uploadBtn, sessionBtn, settingsBtn];
    
    // Hide all sections first and reset button styles
    sections.forEach(section => {
        section.classList.toggle('hidden', section.id !== activeSectionId);
    });

    // Reset all buttons to default color and set active button
    buttons.forEach(button => {
        button.classList.remove('text-lochmara-600');
        button.classList.add('text-gray-500');
    });
    
    // Set active button color
    activeButton.classList.remove('text-gray-500');
    activeButton.classList.add('text-lochmara-600');
}

// Add click handlers to navigation buttons
uploadBtn.addEventListener('click', () => {
    toggleSection('upload-section', uploadBtn);
});

sessionBtn.addEventListener('click', () => {
    toggleSection('session-section', sessionBtn);
});

settingsBtn.addEventListener('click', () => {
    toggleSection('settings-section', settingsBtn);
});