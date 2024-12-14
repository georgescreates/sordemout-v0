import { storage } from '../firebase-config.js';
import { canAddFiles } from './session.js';
import { getImageFeatures } from './clip-service.js';
import { getImageDescription, extractDynamicCategories, generateTags } from './kosmos-service.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

let sessionDescriptions = [];

// Upload a single file to Firebase Storage
async function uploadFileToStorage(file, progressCallback) {
    // Check session limits before upload
    const limitCheck = await canAddFiles(1, file.size);
    if (!limitCheck.withinLimits) {
        progressCallback({
            status: 'error',
            error: limitCheck.inCooldown ? 
                   'Session in cooldown' : 
                   'Session limits reached'
        });
        return null;
    }

    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `uploads/${filename}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
        // Progress
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
        // Error
        (error) => {
            progressCallback({
                status: 'error',
                error: error.message
            });
        },
        // Complete
        async () => {
            try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                
                progressCallback({
                    status: 'complete',
                    progress: 100,
                    downloadURL,
                    triggeredCooldown: limitCheck.wouldTriggerCooldown,
                    nextTier: limitCheck.nextTier
                });

            } catch (error) {
                progressCallback({
                    status: 'error',
                    error: error.message
                });
            }
        }
    );

    return uploadTask;
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