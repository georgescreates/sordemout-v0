import { db, storage } from '../firebase-config.js';
import { canAddFiles, createSession, getSessionData, SESSION_TIERS } from './session.js';
import { getImageFeatures, getConceptualCategories, extractConceptsFromDescription } from './clip-service.js';
import { getImageDescription, extractDynamicCategories, generateTags, processCategories } from './kosmos-service.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
// import { getDoc, getDocs, doc, updateDoc, deleteDoc, increment } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getDoc, getDocs, doc, collection, addDoc, serverTimestamp, increment, writeBatch, updateDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let sessionDescriptions = [];

function flattenIfArray(value) {
    return Array.isArray(value) ? value.flat().filter(v => v !== null && v !== undefined) : value;
}

// Upload a single file to Firebase Storage
async function uploadFileToStorage(file, progressCallback, sessionId) {
    const toast = showProcessingToast('Processing image...');
    const limitCheck = await canAddFiles(1, file.size);
 
    if (!limitCheck.withinLimits) {
        hideProcessingToast(toast);
        progressCallback({
            status: 'error',
            error: limitCheck.inCooldown ? 'Session in cooldown' : 'Session limits reached'
        });
        return null;
    }
 
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
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                // Get existing session images
                const sessionFilesSnap = await getDocs(collection(db, "sessions", sessionId, "files"));
                updateProcessingToast(toast, 'Analyzing image content...');

                const description = await getImageDescription(downloadURL);
                const contextualCategories = processCategories(generateTags(description));
                const conceptualCategories = extractConceptsFromDescription(description);
 
                await addDoc(collection(db, "sessions", sessionId, "files"), {
                    storage_url: downloadURL,
                    name: file.name,
                    size: file.size,
                    upload_time: serverTimestamp(),
                    contextual_categories: flattenIfArray(contextualCategories) || [],
                    conceptual_categories: conceptualCategories,
                    description: description,
                    processed: true
                });
 
                // Check cooldown trigger
                const sessionRef = doc(db, "sessions", sessionId);
                const sessionSnap = await getDoc(sessionRef);
                const session = sessionSnap.data();
 
                const updates = {
                    "usage.files_count": increment(1),
                    "usage.total_size": increment(file.size)
                };
 
                if (!session.preview_image || file.size < session.preview_image_size) {
                    updates.preview_image = downloadURL;
                    updates.preview_image_size = file.size;
                }
 
                await updateDoc(sessionRef, updates);
 
                hideProcessingToast(toast);
                progressCallback({
                    status: 'complete',
                    progress: 100,
                    downloadURL
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