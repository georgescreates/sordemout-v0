/**
* dom-helpers.js
* 
* Centralizes common DOM manipulation operations and UI feedback functions.
* Provides consistent user interface messaging through toasts, status updates,
* and error handling. This ensures a uniform user experience across the application
* while reducing code duplication.
*/

/**
* Displays an error toast message at the bottom of the screen
* @param {string} message - Error message to display
*/
function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity duration-300';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
 }
 
 /**
 * Shows loading status with spinner
 * @param {string} message - Status message to display
 */
 function showStatus(message) {
    const statusContainer = document.getElementById('status-text-container');
    if (!statusContainer) return;
    
    const statusText = document.createElement('div');
    statusText.className = 'text-sm text-gray-600 flex items-center gap-2';
    statusText.innerHTML = `
        <svg class="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>${message}</span>
    `;
    
    statusContainer.innerHTML = '';
    statusContainer.appendChild(statusText);
 }
 
 /**
 * Shows success message with checkmark icon
 * @param {string} message - Success message to display
 */
 function showSuccess(message) {
    const statusContainer = document.getElementById('status-text-container');
    if (!statusContainer) return;
    
    const successText = document.createElement('div');
    successText.className = 'text-sm text-green-600 flex items-center gap-2';
    successText.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>${message}</span>
    `;
    
    statusContainer.innerHTML = '';
    statusContainer.appendChild(successText);
    
    setTimeout(resetStatusMessage, 3000);
 }
 
 /**
 * Shows error message with warning icon
 * @param {string} message - Error message to display
 */
 function showError(message) {
    const statusContainer = document.getElementById('status-text-container');
    if (!statusContainer) return;
    
    const errorText = document.createElement('div');
    errorText.className = 'text-sm text-red-600 flex items-center gap-2';
    errorText.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${message}</span>
    `;
    
    statusContainer.innerHTML = '';
    statusContainer.appendChild(errorText);
    
    setTimeout(resetStatusMessage, 5000);
 }
 
 /**
 * Clears any status messages
 */
 function clearStatus() {
    resetStatusMessage();
 }
 
 /**
 * Resets status container to default message
 */
 function resetStatusMessage() {
    const statusContainer = document.getElementById('status-text-container');
    if (!statusContainer) return;
    
    statusContainer.innerText = "Note: Due to technical limitations, only the first ~30 pins from boards will be shown.";
 }
 
 export { 
    showErrorToast, 
    showStatus, 
    showSuccess, 
    showError, 
    clearStatus, 
    resetStatusMessage 
 };