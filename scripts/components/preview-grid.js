// Get DOM elements


// Add this log to check if we're getting the elements
console.log('Elements:', { fileInput, emptyState, previewGrid });

function handleFiles(e) {
    const files = Array.from(e.target.files);
    
    // Filter valid files
    const validFiles = files.filter(file => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        const validSize = file.size <= 5 * 1024 * 1024; // 5MB in bytes
        
        return validTypes.includes(file.type) && validSize;
    });

    // Update session counts
    updateSessionCounts(validFiles);
    
    // Toggle between empty state and preview grid
    if (validFiles.length > 0) {
        emptyState.classList.add('hidden');
        previewGrid.classList.remove('hidden');
        // Add preview grid content
        updatePreviewGrid(validFiles);
    } else {
        emptyState.classList.remove('hidden');
        previewGrid.classList.add('hidden');
    }
}

function updatePreviewGrid(files) {
    previewGrid.innerHTML = ''; // Clear existing previews
    previewGrid.className = 'w-full h-[500px] my-4 grid grid-cols-2 gap-4 overflow-y-auto p-4';

    files.forEach(file => {
        // Create preview container
        const preview = document.createElement('div');
        preview.className = 'relative group aspect-square border border-silver-chalice-200 rounded-sm overflow-hidden';

        // Create image preview
        const img = document.createElement('img');
        img.className = 'w-full h-full object-cover';
        
        // Create overlay with file info
        const overlay = document.createElement('div');
        overlay.className = 'absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 transform translate-y-full group-hover:translate-y-0 transition-transform';
        
        // Read and display the image
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Add file info to overlay
        const fileName = file.name.length > 20 ? file.name.substring(0, 20) + '...' : file.name;
        const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
        overlay.innerHTML = `
            <p class="text-sm truncate">${fileName}</p>
            <p class="text-xs text-gray-300">${fileSize}</p>
        `;

        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', () => removeFile(file));

        // Assemble preview
        preview.appendChild(img);
        preview.appendChild(overlay);
        preview.appendChild(removeBtn);
        previewGrid.appendChild(preview);
    });
}

function removeFile(fileToRemove) {
    // Convert FileList to Array and remove the file
    const currentFiles = Array.from(fileInput.files).filter(file => file !== fileToRemove);
    
    // Create a new FileList-like object
    const dataTransfer = new DataTransfer();
    currentFiles.forEach(file => dataTransfer.items.add(file));
    
    // Update the file input
    fileInput.files = dataTransfer.files;
    
    // Trigger handleFiles to update the UI
    handleFiles({ target: { files: fileInput.files } });
}