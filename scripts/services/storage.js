import { db, storage } from '../firebase-config.js';
import { canAddFiles } from './session.js';
import { getImageFeatures } from './clip-service.js';
import { getImageDescription, extractDynamicCategories, generateTags } from './kosmos-service.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
// import { getDoc, getDocs, doc, updateDoc, deleteDoc, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let sessionDescriptions = [];

// Upload a single file to Firebase Storage
async function uploadFileToStorage(file, progressCallback, sessionId) {
    const toast = showProcessingToast('Processing image with AI...');
 
    // Check session limits
    const limitCheck = await canAddFiles(1, file.size);
    if (!limitCheck.withinLimits) {
        hideProcessingToast(toast);
        progressCallback({
            status: 'error',
            error: limitCheck.inCooldown ? 
                'Session in cooldown' : 
                'Session limits reached'
        });
        return null;
    }
 
    // Upload process
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `uploads/${filename}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
 
    uploadTask.on('state_changed',
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const speed = (snapshot.bytesTransferred / 1024 / 1024).toFixed(2);
            
            progressCallback({
                progress,
                speed,
                status: 'uploading',
                willTriggerCooldown: limitCheck.wouldTriggerCooldown,
                nextTier: limitCheck.nextTier
            });
        },
        (error) => {
            hideProcessingToast(toast);
            progressCallback({
                status: 'error',
                error: error.message
            });
        },
        async () => {
            try {
                updateProcessingToast(toast, 'Analyzing image with AI...');
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                const description = await getImageDescription(downloadURL);
                const categories = extractDynamicCategories([description]);
        
                console.log('Creating file document for:', file.name);
                
                // Create a new file document
                await addDoc(collection(db, "sessions", sessionId, "files"), {
                    storage_url: downloadURL,
                    categories: Object.values(categories)
                        .flat()
                        .map(c => c.term)
                        .filter(c => c.confidence > 0.5),
                    processed: true,
                    name: file.name,
                    size: file.size,
                    upload_time: serverTimestamp()
                });

                hideProcessingToast(toast);
        
                progressCallback({
                    status: 'complete',
                    progress: 100,
                    downloadURL,
                    triggeredCooldown: limitCheck.wouldTriggerCooldown,
                    nextTier: limitCheck.nextTier
                });
        
            } catch (error) {
                hideProcessingToast(toast);
                progressCallback({
                    status: 'error',
                    error: error.message
                });
            }
        }
    );
 
    return uploadTask;
 }
 
 function showProcessingToast(message) {
    const existingToast = document.getElementById('processing-toast');
   if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'processing-toast';
    toast.className = 'fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-lochmara-600 text-white px-4 py-2 rounded flex items-center gap-2';
    toast.innerHTML = `
        <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>${message}</span>
    `;
    document.body.appendChild(toast);
    return toast;
 }
 
function updateProcessingToast(toast, message) {
    if (!toast) return;
    const messageSpan = toast.querySelector('span');
    if (messageSpan) messageSpan.textContent = message;
}
 
 function hideProcessingToast(toast) {
    if (!toast) return;
    toast.remove();
 }

function clearSessionDescriptions() {
    sessionDescriptions = [];
}

async function processUploadedImage(downloadURL) {
    try {
        // Get both image and text features
        const features = await getImageFeatures(downloadURL);
        
        // Get categories for this image
        const categories = await getCategoriesForImage(features.image_features);
        
        return {
            features,
            categories
        };
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}
 
export { uploadFileToStorage };