import { REPLICATE_API_TOKEN } from '../replicate-config.js';

const CORS_PROXY = 'http://localhost:8080/';
const REPLICATE_API_ENDPOINT = 'https://api.replicate.com/v1/predictions';
const CLIP_MODEL = '75b33f253f7714a281ad3e9b28f63e3232d583716ef6718f2e46641077ea040a';

// Add this after your constants in clip-service.js
const COMMON_CATEGORIES = [
    "landscape", "portrait", "architecture", "nature", "urban",
    "black and white", "colorful", "abstract", "minimalist",
    "night scene", "sunset", "sunrise", "indoor", "outdoor",
    "people", "animals", "water", "mountain", "beach", "forest",
    "vintage", "modern", "aerial view", "close-up", "panoramic"
];

// Add this function to clip-service.js
async function getCategoriesForImage(imageUrl) {
    try {
        // First get image embeddings
        const imageFeatures = await getImageFeatures(imageUrl);
        console.log('Image features:', imageFeatures);

        let categoryResults = [];
        for (const category of COMMON_CATEGORIES) {
            console.log(`\nProcessing category: ${category}`);
            const response = await fetch(CORS_PROXY + REPLICATE_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify({
                    version: CLIP_MODEL,
                    input: {
                        text: category,
                        modality: "text",
                        return_text_features: true
                    }
                })
            });
            
            const prediction = await response.json();
            const result = await pollPredictionStatus(prediction.id);
            console.log('Category result:', result);

            try {
                const similarity = calculateSimilarity(imageFeatures, result);
                console.log(`Similarity score for ${category}:`, similarity);
                categoryResults.push({ category, similarity });
            } catch (error) {
                console.error(`Error calculating similarity for ${category}:`, error);
                continue;
            }
        }

        // Filter and sort results
        const matches = categoryResults
            .filter(pred => pred.similarity > 0.25)
            .sort((a, b) => b.similarity - a.similarity)
            .map(pred => ({
                category: pred.category,
                similarity: pred.similarity
            }));

        console.log('Final category matches:', matches);
        return matches;

    } catch (error) {
        console.error('Error getting categories:', error);
        throw error;
    }
}


async function getImageFeatures(imageUrl) {
    try {
        // Start prediction
        const response = await fetch(CORS_PROXY + REPLICATE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                version: CLIP_MODEL,
                input: {
                    image: imageUrl,
                    modality: "image",
                    return_image_features: true
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Replicate API error: ${errorData.detail || response.statusText}`);
        }

        const prediction = await response.json();
        
        // Poll for results
        const result = await pollPredictionStatus(prediction.id);
        return result;

    } catch (error) {
        console.error('Error getting image features:', error);
        throw error;
    }
}

async function pollPredictionStatus(predictionId) {
    const maxAttempts = 15; // 30 seconds total
    const interval = 2000; // 2 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(CORS_PROXY + `${REPLICATE_API_ENDPOINT}/${predictionId}`, {
                headers: {
                    'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!response.ok) {
                throw new Error(`Polling error: ${response.statusText}`);
            }

            const prediction = await response.json();

            if (prediction.status === 'succeeded') {
                return prediction.output;
            } else if (prediction.status === 'failed') {
                throw new Error(`Prediction failed: ${prediction.error}`);
            }

            await new Promise(resolve => setTimeout(resolve, interval));
            attempts++;

        } catch (error) {
            console.error('Error polling prediction status:', error);
            throw error;
        }
    }

    throw new Error('Prediction timed out');
}

// Function to calculate similarity between two embeddings
function calculateSimilarity(embedding1, embedding2) {
    try {
        // Log full structures
        console.log('Raw embedding 1:', JSON.stringify(embedding1));
        console.log('Raw embedding 2:', JSON.stringify(embedding2));

        // Try to extract the actual numeric arrays
        let array1, array2;

        if (Array.isArray(embedding1)) {
            array1 = embedding1;
        } else if (embedding1.image_features) {
            array1 = embedding1.image_features;
        } else if (embedding1.text_features) {
            array1 = embedding1.text_features;
        }

        if (Array.isArray(embedding2)) {
            array2 = embedding2;
        } else if (embedding2.image_features) {
            array2 = embedding2.image_features;
        } else if (embedding2.text_features) {
            array2 = embedding2.text_features;
        }

        // Validate we have actual numeric arrays
        if (!array1 || !array2) {
            console.error('Could not extract numeric arrays from:', { embedding1, embedding2 });
            throw new Error('Could not extract numeric arrays from embeddings');
        }

        // Log the actual arrays we'll use
        console.log('Using array1:', array1);
        console.log('Using array2:', array2);

        // Verify arrays have numbers
        if (!array1.every(n => typeof n === 'number') || !array2.every(n => typeof n === 'number')) {
            console.error('Arrays contain non-numeric values:', { array1, array2 });
            throw new Error('Arrays contain non-numeric values');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < array1.length; i++) {
            dotProduct += array1[i] * array2[i];
            norm1 += array1[i] * array1[i];
            norm2 += array2[i] * array2[i];
        }

        // Log intermediate calculations
        console.log('Calculations:', {
            dotProduct,
            norm1,
            norm2,
            sqrt1: Math.sqrt(norm1),
            sqrt2: Math.sqrt(norm2)
        });

        const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
        console.log('Final similarity:', similarity);

        return Math.max(0, Math.min(1, Number(similarity.toFixed(3))));
    } catch (error) {
        console.error('Error in calculateSimilarity:', error);
        return 0; // Return 0 for no similarity instead of throwing
    }
}

// Function to group similar images
function groupSimilarImages(images, threshold = 0.8) {
    const groups = [];
    const used = new Set();

    for (let i = 0; i < images.length; i++) {
        if (used.has(i)) continue;

        const group = {
            master: images[i],
            similar: []
        };
        used.add(i);

        for (let j = 0; j < images.length; j++) {
            if (i === j || used.has(j)) continue;

            const similarity = calculateSimilarity(
                images[i].embeddings,
                images[j].embeddings
            );

            if (similarity >= threshold) {
                group.similar.push({
                    ...images[j],
                    similarity
                });
                used.add(j);
            }
        }

        if (group.similar.length > 0) {
            groups.push(group);
        }
    }

    return groups;
}

export { getImageFeatures, calculateSimilarity, groupSimilarImages, getCategoriesForImage };