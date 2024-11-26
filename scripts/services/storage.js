import { storage } from '../firebase-config.js';
import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

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
                progressCallback({
                    status: 'complete',
                    progress: 100,
                    downloadURL
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
 
export { uploadFileToStorage };