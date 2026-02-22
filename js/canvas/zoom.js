// ============================================
// File: canvas/zoom.js
// ============================================

/**
 * Handles zooming, panning and bounding box calculations for the canvas.
 *
 * Responsibilities:
 * - Apply transform (pan + zoom) to container
 * - Zoom at specific viewport position
 * - Zoom in / out centered in viewport
 * - Fit all elements into view
 */

import { state, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../state.js';

import { updateAllConnections } from './elements/connection.js';
import { calculateBoundingBox } from './utils.js';
import { DOM } from '../dom.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

// ============================================
// APPLY TRANSFORM
// ============================================

/**
 * Applies the current zoom and pan transform to the transform container.
 * Also triggers connection updates after transformation.
 *
 * @returns {void}
 */
export function applyZoom() {
    DOM.transformContainer.style.transform = `translate(${state.panOffset.x}px, ${state.panOffset.y}px) scale(${state.currentZoom})`;

    // Recalculate connection paths after transform change
    updateAllConnections();
}

// ============================================
// ZOOM CORE
// ============================================

/**
 * Zoom relative to a given viewport position.
 *
 * @param {number} factor - Positive = zoom in, negative = zoom out.
 * @param {number} centerX - Zoom center X (viewport coordinates).
 * @param {number} centerY - Zoom center Y (viewport coordinates).
 * @returns {void}
 */
export function zoomAt(factor, centerX, centerY) {
    const newZoom = Math.min(Math.max(state.currentZoom + factor, MIN_ZOOM), MAX_ZOOM);

    if (newZoom === state.currentZoom) return;

    const zoomFactor = newZoom / state.currentZoom;

    // Adjust pan offset so zoom keeps the given center stable
    state.panOffset.x = centerX - (centerX - state.panOffset.x) * zoomFactor;
    state.panOffset.y = centerY - (centerY - state.panOffset.y) * zoomFactor;
    state.currentZoom = newZoom;

    applyZoom();
}

/**
 * Zoom in at the center of the viewport.
 *
 * @returns {void}
 */
export function zoomIn() {
    const vp = DOM.viewport;
    zoomAt(ZOOM_STEP, vp.clientWidth / 2, vp.clientHeight / 2);
}

/**
 * Zoom out at the center of the viewport.
 *
 * @returns {void}
 */
export function zoomOut() {
    const vp = DOM.viewport;
    zoomAt(-ZOOM_STEP, vp.clientWidth / 2, vp.clientHeight / 2);
}

// ============================================
// FIT VIEW
// ============================================

/**
 * Adjust zoom and pan so all elements are visible within the viewport.
 *
 * @returns {void}
 */
export function fitView() {
    const bounds = calculateBoundingBox();

    const padding = 50;

    const minX = bounds.minX - padding;
    const minY = bounds.minY - padding;
    const maxX = bounds.maxX + padding;
    const maxY = bounds.maxY + padding;

    const vw = DOM.viewport.clientWidth;
    const vh = DOM.viewport.clientHeight;

    const zoomX = vw / (maxX - minX);
    const zoomY = vh / (maxY - minY);

    state.currentZoom = Math.min(zoomX, zoomY, MAX_ZOOM);
    state.currentZoom = Math.max(state.currentZoom, MIN_ZOOM);

    const groupCenterX = (minX + maxX) / 2;
    const groupCenterY = (minY + maxY) / 2;

    // Center bounding box in viewport
    state.panOffset.x = vw / 2 - groupCenterX * state.currentZoom;
    state.panOffset.y = vh / 2 - groupCenterY * state.currentZoom;
    
    applyZoom();
}