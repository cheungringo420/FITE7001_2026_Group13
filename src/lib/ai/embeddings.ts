/**
 * Embeddings Service - Hybrid Approach
 * 
 * Primary: Local embeddings (Transformers.js) - no API key required
 * Fallback: OpenAI embeddings - if local fails or USE_OPENAI=true
 * 
 * Using text-embedding-3-small for OpenAI (1536 dims)
 * Using all-MiniLM-L6-v2 for local (384 dims)
 */

import { getLocalEmbeddings as getLocalEmbeddingsImpl } from './local-embeddings';

// In-memory embedding cache (survives across requests in same process)
const embeddingCache = new Map<string, number[]>();

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/embeddings';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536; // Default dimensions for text-embedding-3-small

// Force OpenAI usage even if local is available
const FORCE_OPENAI = process.env.USE_OPENAI === 'true';

/**
 * Normalize text before embedding to improve cache hits
 */
function normalizeForEmbedding(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Generate cache key from normalized text
 */
function getCacheKey(text: string): string {
    return normalizeForEmbedding(text);
}

/**
 * Get embedding for a single text string
 */
export async function getEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = getCacheKey(text);

    // Check cache first
    if (embeddingCache.has(cacheKey)) {
        return embeddingCache.get(cacheKey)!;
    }

    // Try local embeddings first (unless forced to use OpenAI)
    if (!FORCE_OPENAI) {
        try {
            const [localEmbedding] = await getLocalEmbeddingsImpl([text]);
            if (localEmbedding) {
                embeddingCache.set(cacheKey, localEmbedding);
                return localEmbedding;
            }
        } catch (error) {
            console.warn('[Embeddings] Local embedding failed, trying OpenAI:', error);
        }
    }

    // Fallback to OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('[Embeddings] No API key and local embeddings failed');
        return null;
    }

    try {
        const response = await fetch(OPENAI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: EMBEDDING_MODEL,
                input: text,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Embeddings] API error:', response.status, errorText);
            return null;
        }

        const data = await response.json();
        const embedding = data.data[0].embedding as number[];

        // Cache the result
        embeddingCache.set(cacheKey, embedding);

        return embedding;
    } catch (error) {
        console.error('[Embeddings] Failed to get embedding:', error);
        return null;
    }
}

/**
 * Get embeddings for multiple texts in a single batch request
 * More efficient than calling getEmbedding multiple times
 */
export async function getEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    // Find which texts need embeddings (not in cache)
    const results: (number[] | null)[] = new Array(texts.length).fill(null);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < texts.length; i++) {
        const cacheKey = getCacheKey(texts[i]);
        if (embeddingCache.has(cacheKey)) {
            results[i] = embeddingCache.get(cacheKey)!;
        } else {
            uncachedIndices.push(i);
            uncachedTexts.push(texts[i]);
        }
    }

    // If all cached, return early
    if (uncachedTexts.length === 0) {
        return results;
    }

    // Try local embeddings first (unless forced to use OpenAI)
    if (!FORCE_OPENAI) {
        try {
            console.log('[Embeddings] Using local embeddings for batch');
            const localEmbeddings = await getLocalEmbeddingsImpl(uncachedTexts);

            // Process local results
            let successCount = 0;
            for (let i = 0; i < localEmbeddings.length; i++) {
                if (localEmbeddings[i]) {
                    const originalIndex = uncachedIndices[i];
                    results[originalIndex] = localEmbeddings[i];

                    // Cache the result
                    const cacheKey = getCacheKey(texts[originalIndex]);
                    embeddingCache.set(cacheKey, localEmbeddings[i]!);
                    successCount++;
                }
            }

            console.log(`[Embeddings] Local embeddings successful: ${successCount}/${uncachedTexts.length}`);

            // If all successful with local, return
            if (successCount === uncachedTexts.length) {
                return results;
            }

            console.log('[Embeddings] Some local embeddings failed, falling back to OpenAI for remaining');
        } catch (error) {
            console.warn('[Embeddings] Local batch embeddings failed, trying OpenAI:', error);
        }
    }

    // Fallback to OpenAI for any remaining nulls
    const apiKey = process.env.OPENAI_API_KEY;

    // Find which ones still need embeddings
    const stillNeeded: string[] = [];
    const stillNeededIndices: number[] = [];
    for (let i = 0; i < results.length; i++) {
        if (results[i] === null) {
            stillNeeded.push(texts[i]);
            stillNeededIndices.push(i);
        }
    }

    if (stillNeeded.length === 0) {
        return results;
    }

    // If no API key, return what we have
    if (!apiKey) {
        console.warn('[Embeddings] OPENAI_API_KEY not set, some embeddings will be null');
        return results;
    }

    try {
        // Batch API call (OpenAI supports up to 2048 inputs per request)
        const batchSize = 100; // Process in smaller batches to avoid timeouts

        for (let batchStart = 0; batchStart < stillNeeded.length; batchStart += batchSize) {
            const batchTexts = stillNeeded.slice(batchStart, batchStart + batchSize);
            const batchIndices = stillNeededIndices.slice(batchStart, batchStart + batchSize);

            const response = await fetch(OPENAI_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: EMBEDDING_MODEL,
                    input: batchTexts,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Embeddings] Batch API error:', response.status, errorText);
                continue;
            }

            const data = await response.json();

            // Map results back to original indices
            for (let j = 0; j < data.data.length; j++) {
                const embedding = data.data[j].embedding as number[];
                const originalIndex = batchIndices[j];
                results[originalIndex] = embedding;

                // Cache the result
                const cacheKey = getCacheKey(texts[originalIndex]);
                embeddingCache.set(cacheKey, embedding);
            }
        }

        return results;
    } catch (error) {
        console.error('[Embeddings] Failed to get batch embeddings:', error);
        return results;
    }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1, where 1 means identical
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);

    if (magnitude === 0) {
        return 0;
    }

    return dotProduct / magnitude;
}

/**
 * Calculate semantic similarity between two texts
 * Falls back to null if embeddings cannot be generated
 */
export async function calculateSemanticSimilarity(
    text1: string,
    text2: string
): Promise<number | null> {
    const [embedding1, embedding2] = await getEmbeddings([text1, text2]);

    if (!embedding1 || !embedding2) {
        return null;
    }

    return cosineSimilarity(embedding1, embedding2);
}

/**
 * Get cache statistics for monitoring
 */
export function getEmbeddingCacheStats(): { size: number; hitRate: string } {
    return {
        size: embeddingCache.size,
        hitRate: 'N/A', // Could track hits/misses if needed
    };
}

/**
 * Clear the embedding cache (useful for testing)
 */
export function clearEmbeddingCache(): void {
    embeddingCache.clear();
}

/**
 * Pre-warm cache with market questions
 * Call this with all market questions to batch-generate embeddings efficiently
 */
export async function prewarmCache(questions: string[]): Promise<void> {
    console.log(`[Embeddings] Pre-warming cache with ${questions.length} questions...`);
    await getEmbeddings(questions);
    console.log(`[Embeddings] Cache size: ${embeddingCache.size}`);
}
