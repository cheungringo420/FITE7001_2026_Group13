/**
 * Local Embeddings using Transformers.js
 * 
 * This module provides semantic text embeddings using a local model
 * that runs entirely in Node.js without requiring any API keys.
 * 
 * Model: Xenova/all-MiniLM-L6-v2 (~23MB)
 * - 384-dimensional embeddings
 * - Optimized for semantic similarity
 * - Same architecture as sentence-transformers
 */

import { pipeline, env } from '@xenova/transformers';
import type { FeatureExtractionPipeline, Tensor } from '@xenova/transformers';

// Disable local model storage (use cache)
env.allowLocalModels = false;
env.allowRemoteModels = true;

// Cache for the pipeline instance
let embeddingPipeline: FeatureExtractionPipeline | null = null;
let isInitializing = false;
let initializationPromise: Promise<FeatureExtractionPipeline> | null = null;

// In-memory cache for embeddings
const embeddingCache = new Map<string, number[]>();

/**
 * Initialize the embedding pipeline
 * This downloads the model on first use (~23MB)
 */
async function initializePipeline(): Promise<FeatureExtractionPipeline> {
    if (embeddingPipeline) return embeddingPipeline;

    if (isInitializing && initializationPromise) {
        return initializationPromise;
    }

    isInitializing = true;
    console.log('[LocalEmbeddings] Initializing model (this may take a moment on first run)...');

    initializationPromise = pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        {
            // Use quantized model for smaller size and faster inference
            quantized: true,
        }
    ).then((embeddingPipe) => {
        embeddingPipeline = embeddingPipe;
        isInitializing = false;
        console.log('[LocalEmbeddings] Model loaded successfully');
        return embeddingPipe;
    }).catch((error) => {
        isInitializing = false;
        initializationPromise = null;
        console.error('[LocalEmbeddings] Failed to load model:', error);
        throw error;
    });

    return initializationPromise;
}

/**
 * Generate embeddings for a list of texts
 * @param texts Array of text strings to embed
 * @returns Array of embedding vectors (or null if failed)
 */
export async function getLocalEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (texts.length === 0) return [];

    try {
        // Initialize pipeline if needed
        const pipe = await initializePipeline();

        const results: (number[] | null)[] = [];
        const textsToEmbed: string[] = [];
        const indices: number[] = [];

        // Check cache first
        for (let i = 0; i < texts.length; i++) {
            const text = texts[i];
            if (embeddingCache.has(text)) {
                results[i] = embeddingCache.get(text)!;
            } else {
                textsToEmbed.push(text);
                indices.push(i);
                results[i] = null; // placeholder
            }
        }

        // If all were cached, return early
        if (textsToEmbed.length === 0) {
            console.log(`[LocalEmbeddings] Retrieved ${texts.length} embeddings from cache`);
            return results;
        }

        console.log(`[LocalEmbeddings] Generating ${textsToEmbed.length} embeddings (${embeddingCache.size} cached)`);

        // Generate embeddings for non-cached texts
        const output = await pipe(textsToEmbed, {
            pooling: 'mean',
            normalize: true,
        }) as Tensor[];

        // Process results
        for (let i = 0; i < textsToEmbed.length; i++) {
            const text = textsToEmbed[i];
            const idx = indices[i];

            // Extract embedding array from tensor
            const embedding = Array.from(output[i].data as Float32Array) as number[];

            // Cache it
            embeddingCache.set(text, embedding);
            results[idx] = embedding;
        }

        // Limit cache size to prevent memory issues
        if (embeddingCache.size > 10000) {
            console.log('[LocalEmbeddings] Cache size exceeded, clearing oldest entries');
            const entries = Array.from(embeddingCache.entries());
            // Keep most recent 5000
            embeddingCache.clear();
            entries.slice(-5000).forEach(([key, value]) => {
                embeddingCache.set(key, value);
            });
        }

        return results;

    } catch (error) {
        console.error('[LocalEmbeddings] Error generating embeddings:', error);
        // Return nulls on error
        return texts.map(() => null);
    }
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
    embeddingCache.clear();
    console.log('[LocalEmbeddings] Cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
    return {
        size: embeddingCache.size,
        memoryEstimate: embeddingCache.size * 384 * 8, // 384 dimensions * 8 bytes per float64
    };
}

/**
 * Preload the model (optional, for faster first use)
 */
export async function preloadModel(): Promise<void> {
    await initializePipeline();
}
