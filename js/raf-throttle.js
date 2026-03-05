// ============================================
// File: raf-throttle.js
// ============================================

/**
 * Provides requestAnimationFrame (RAF) based throttling for high-frequency calls.
 *
 * Responsibilities:
 * - Prevent multiple consecutive calls within a single animation frame
 * - Ensure a function executes at most once per RAF tick
 */

import { state } from './state.js';

// ============================================
// PUBLIC HANDLER
// ============================================

/**
 * Executes the provided function at most once per animation frame.
 * If a RAF callback is already scheduled, subsequent calls are ignored until the next frame.
 *
 * @param {Function} fn - Function to execute in a throttled manner.
 */
export function throttled(fn) {
    if (state.rafId) return; // skip if a frame is already scheduled
    state.rafId = requestAnimationFrame(() => {
        fn();
        state.rafId = null; // reset RAF ID for next tick
    });
}