import { REPLICATE_API_TOKEN } from '../replicate-config.js';

const CORS_PROXY = 'http://localhost:8080/';
const REPLICATE_API_ENDPOINT = 'https://api.replicate.com/v1/predictions';
const KOSMOS_MODEL = 'd5098d8db2a801b45ca11451a0ce421e27353b0298fb3aeba4a9055bd67c582a';

async function getImageDescription(imageUrl) {
    try {
        console.log('Getting Kosmos description for:', imageUrl);
        
        const response = await fetch(CORS_PROXY + REPLICATE_API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: JSON.stringify({
                version: KOSMOS_MODEL,
                input: {
                    image: imageUrl,
                    detect_text: true,
                    mode: "describe"
                }
            })
        });

        // Log status
        console.log('Response status:', response.status);
        
        // Read response JSON only once and store it
        const responseData = await response.json();
        console.log('Response data:', responseData);

        if (!response.ok) {
            throw new Error(`Kosmos API error: ${JSON.stringify(responseData)}`);
        }

        // Use stored response data instead of reading again
        console.log('Initial prediction:', responseData);

        // Poll for results
        const result = await pollPredictionStatus(responseData.id);
        console.log('Kosmos result:', result);

        return result;

    } catch (error) {
        console.error('Error getting image description:', error);
        throw error;
    }
}

async function pollPredictionStatus(predictionId) {
    const maxAttempts = 60;  // Increase to 2 minutes total
    const interval = 6000;   // Check every 2 seconds
    let attempts = 0;

    while (attempts < maxAttempts) {
        try {
            // console.log(`\nPolling attempt ${attempts + 1}/${maxAttempts} for prediction ${predictionId}`);
            
            const response = await fetch(CORS_PROXY + `${REPLICATE_API_ENDPOINT}/${predictionId}`, {
                headers: {
                    'Authorization': `Token ${REPLICATE_API_TOKEN}`,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            const prediction = await response.json();
            // console.log('Current status:', prediction.status);
            
            // Log full prediction for debugging
            // console.log('Full prediction response:', prediction);

            if (prediction.status === 'succeeded') {
                console.log('Success! Output:', prediction.output);
                return prediction.output;
            } 
            
            if (prediction.status === 'failed') {
                throw new Error(`Prediction failed: ${prediction.error}`);
            }

            // More detailed status logging
            // if (prediction.status === 'processing') {
            //     console.log('Still processing...');
            // } else if (prediction.status === 'starting') {
            //     console.log('Still starting...');
            // } else {
            //     console.log('Current status:', prediction.status);
            // }

            await new Promise(resolve => setTimeout(resolve, interval));
            attempts++;

        } catch (error) {
            console.error('Polling error:', error);
            throw error;
        }
    }

    throw new Error(`Prediction timed out after ${maxAttempts * interval / 1000} seconds`);
}

// Common words to filter out
const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
    'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
    'that', 'the', 'to', 'was', 'were', 'will', 'with'
]);

function analyzeSentence(description) {
    // Type check and handle possible formats
    let textToAnalyze = '';
    
    if (typeof description === 'string') {
        textToAnalyze = description;
    } else if (description && description.text) {
        textToAnalyze = description.text;
    } else if (description && Array.isArray(description)) {
        // If it's an array, try to find text content
        textToAnalyze = description.find(item => typeof item === 'string') || '';
    } else {
        console.log('Received description:', description);
        return {
            subjects: [],
            actions: [],
            attributes: [],
            context: [],
            objects: []
        };
    }

    // Clean the text
    const cleanText = textToAnalyze.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
        .replace(/\s{2,}/g, ' ');

    // Split into words
    const words = cleanText.split(' ');

    // Extract patterns
    const patterns = {
        subjects: [], // nouns that appear as main subjects
        actions: [],  // verbs describing what's happening
        attributes: [], // adjectives describing qualities
        context: [],   // location, time, or situation words
        objects: []    // things being interacted with
    };

    // Simple pattern recognition
    words.forEach((word, index) => {
        const prevWord = words[index - 1];
        const nextWord = words[index + 1];

        if (STOP_WORDS.has(word)) return;

        // Subject detection (often follows "a", "an", "the")
        if (prevWord === 'a' || prevWord === 'an' || prevWord === 'the') {
            patterns.subjects.push(word);
        }

        // Action detection (often ends in "ing" or "ed")
        if (word.endsWith('ing') || word.endsWith('ed')) {
            patterns.actions.push(word);
        }

        // Attribute detection (often before nouns)
        if (nextWord && !STOP_WORDS.has(nextWord) && !nextWord.endsWith('ing')) {
            patterns.attributes.push(word);
        }

        // Context detection (words about place or time)
        if (word.includes('room') || word.includes('outside') || 
            word.includes('inside') || word.includes('during') ||
            word.includes('time') || word.includes('place')) {
            patterns.context.push(word);
        }

        // Object detection (often follows verbs)
        if (prevWord && prevWord.endsWith('ing')) {
            patterns.objects.push(word);
        }
    });

    return patterns;
}

function extractDynamicCategories(descriptions) {
    const categoryPatterns = new Map();
    
    descriptions.forEach(description => {
        const patterns = analyzeSentence(description);
        
        // Group similar terms
        Object.entries(patterns).forEach(([category, terms]) => {
            if (!categoryPatterns.has(category)) {
                categoryPatterns.set(category, new Map());
            }
            
            const categoryMap = categoryPatterns.get(category);
            terms.forEach(term => {
                categoryMap.set(term, (categoryMap.get(term) || 0) + 1);
            });
        });
    });

    // Convert to structured categories
    const categories = {};
    categoryPatterns.forEach((terms, category) => {
        // Sort by frequency and convert to array
        categories[category] = Array.from(terms.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([term, count]) => ({
                term,
                count,
                confidence: count / descriptions.length // How often this term appears
            }))
            .filter(item => item.confidence > 0.2); // Only keep terms that appear in at least 20% of descriptions
    });

    return categories;
}

function generateTags(description) {
    const patterns = analyzeSentence(description);
    const tags = new Set();

    // Add all identified patterns as tags
    Object.values(patterns).forEach(terms => {
        terms.forEach(term => tags.add(term));
    });

    // Generate compound tags for important combinations
    patterns.attributes.forEach(attr => {
        patterns.subjects.forEach(subj => {
            tags.add(`${attr} ${subj}`);
        });
    });

    // Add scene type tags based on combinations
    if (patterns.context.some(c => c.includes('outside') || c.includes('outdoor'))) {
        tags.add('outdoor scene');
    }
    if (patterns.context.some(c => c.includes('inside') || c.includes('indoor'))) {
        tags.add('indoor scene');
    }

    return Array.from(tags);
}

// Function to find related concepts
function findRelatedConcepts(tag, descriptions) {
    const cooccurrences = new Map();
    
    descriptions.forEach(description => {
        if (description.toLowerCase().includes(tag.toLowerCase())) {
            const tags = generateTags(description);
            tags.forEach(otherTag => {
                if (otherTag !== tag) {
                    cooccurrences.set(otherTag, (cooccurrences.get(otherTag) || 0) + 1);
                }
            });
        }
    });

    return Array.from(cooccurrences.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5) // Top 5 related concepts
        .map(([term, count]) => ({
            term,
            strength: count
        }));
}

function processCategories(rawCategories) {
    const alphaCategories = new Map(); // category -> count
    const numericCategories = new Map();
    const isOnlyDigits = str => /^\d+$/.test(str);
    const isArticle = str => /^(a|an|the)$/i.test(str);
    const cleanSpecialChars = str => str.replace(/[\[\]'"{}()]/g, '').trim();

    rawCategories.forEach(category => {
        let cleaned = cleanSpecialChars(category);
        const parts = cleaned.split(/\s+/)
            .filter(part => part.length > 0 && !isArticle(part))
            .map(part => part.toLowerCase());

        parts.forEach(part => {
            if (isOnlyDigits(part)) {
                numericCategories.set(part, (numericCategories.get(part) || 0) + 1);
            } else {
                alphaCategories.set(part, (alphaCategories.get(part) || 0) + 1);
            }
        });
    });

    // For now, return only sorted alpha categories
    return Array.from(alphaCategories.keys()).sort();
}

export {
    analyzeSentence,
    extractDynamicCategories,
    generateTags,
    findRelatedConcepts,
    getImageDescription,
    processCategories
};