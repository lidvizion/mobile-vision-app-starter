import { ObjectId } from 'mongodb'
import type { ExerciseConfig } from '@/lib/pose/exercises/templates'

/**
 * MongoDB document structure for exercise configs
 * As specified in mongodb-exercise-persistence-context.md
 */
export interface ExerciseConfigDocument {
    _id?: ObjectId
    slug: string              // Normalized name: "baseball_swing", "waltz", "jumping_jacks"
    displayName: string       // Original name: "Baseball Swing"
    config: ExerciseConfig    // The full config object
    source: 'gemini' | 'manual' | 'imported'
    createdAt: Date
    updatedAt: Date
    usageCount: number        // Track popularity
    tags?: string[]           // ["sports", "arms", "full-body"]
    category?: string         // "fitness", "dance", "sports", "animal"
}

/**
 * Normalize exercise name to slug format
 * "Baseball Swing" -> "baseball_swing"
 */
export function normalizeSlug(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, '_')
}
