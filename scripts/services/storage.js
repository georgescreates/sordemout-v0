import { storage } from '../firebase-config.js';
import { getImageFeatures } from './clip-service.js';
import { getImageDescription, extractDynamicCategories, generateTags } from './kosmos-service.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';


let sessionDescriptions = [];

// Upload a single file to Firebase Storage
async function uploadFileToStorage(file, progressCallback) {
    // Create unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;

    // Create storage reference
    const storageRef = ref(storage, `uploads/${filename}`);

    // Create upload task
    const uploadTask = uploadBytesResumable(storageRef, file);

    // Monitor upload
    uploadTask.on('state_changed', 
        // Progress
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            const speed = (snapshot.bytesTransferred / 1024 / 1024).toFixed(2); // MB/s
            progressCallback({
                progress,
                speed,
                status: 'uploading'
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
                
                // Get description from Kosmos
                const description = await getImageDescription(downloadURL);
                
                // Add to session descriptions
                sessionDescriptions.push(description);
                
                // Generate dynamic tags
                const tags = generateTags(description);
                console.log('Dynamic tags:', tags);
                
                // Use sessionDescriptions instead of previousDescriptions
                const categories = extractDynamicCategories(sessionDescriptions);
                console.log('Dynamic categories:', categories);
                
                progressCallback({
                    status: 'complete',
                    progress: 100,
                    downloadURL,
                    description,
                    tags,
                    categories
                });
        
            } catch (error) {
                console.error('Processing Error:', error);
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