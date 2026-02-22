// ============================================
// File: canvas/clear-canvas.js
// ============================================

/**
 * Provides functionality for clearing the canvas and
 * utility helpers for bounding box calculation and
 * coordinate transformation.
 *
 * Responsibilities:
 * - Clear all canvas elements and reset related state
 * - Calculate bounding boxes for seats and fixed elements
 * - Convert client coordinates into canvas coordinates
 */

import { DOM } from '../dom.js';
import { state, MAX_CANVAS } from '../state.js';
import { fitView } from './zoom.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

// ============================================
// PUBLIC HANDLER
// ============================================

/**
 * Clears the entire canvas after user confirmation.
 * Resets DOM elements and related application state.
 *
 * @returns {void}
 */
export function clearCanvas() {
    const confirmed = confirm('Achtung: Es werden nun alle Elemente auf der Zeichenfläche gelöscht. Fortfahren?');

    if (!confirmed) return;

    // Reset seat counter input
    DOM.seatCount.value = 0;

    // Remove all elements from canvas
    DOM.canvas.innerHTML = '';

    // Reset seat-related state
    state.seats = [];
    state.lastSeatID = 0;

    // Reset connection-related state
    state.fixedConnections = [];
    state.seatConnectionSet = new Set();

    // Refit viewport after clearing
    fitView();
}

// ============================================
// BOUNDING BOX
// ============================================

/**
 * Calculates bounding box of seat and fixed elements.
 *
 * @param {Array} [seatElements] - Optional seat objects (default: state.seats).
 * @param {Array|NodeList} [fixedElements] - Optional fixed elements.
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}}
 */
export function calculateBoundingBox(seatElements, fixedElements) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    let hasElements = false;

    /**
     * Processes a single element or seat-like object.
     *
     * @param {Object|HTMLElement} item - Element or seat object.
     * @param {number} defaultWidth - Fallback width.
     * @param {number} defaultHeight - Fallback height.
     * @returns {void}
     */
    const processElement = (item, defaultWidth = 110, defaultHeight = 60) => {
        const element = item.element || item;

        const x = element?.offsetLeft ?? item.x ?? 0;
        const y = element?.offsetTop ?? item.y ?? 0;

        const w = element?.offsetWidth ?? defaultWidth;
        const h = element?.offsetHeight ?? defaultHeight;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + w);
        maxY = Math.max(maxY, y + h);

        hasElements = true;
    };

    const seatsToProcess = seatElements !== undefined ? seatElements : state.seats;

    if (seatsToProcess?.length) {
        seatsToProcess.forEach(seat =>
            processElement(seat, 110, 60)
        );
    }

    const fixedToProcess = fixedElements !== undefined ? fixedElements : document.querySelectorAll('.fixed-element');

    if (fixedToProcess?.length) {
        Array.from(fixedToProcess).forEach(element =>
            processElement(element, 140, 50)
        );
    }

    if (!hasElements) {
        const center = MAX_CANVAS / 2;

        // Return center point if no elements exist
        return {
            minX: center,
            minY: center,
            maxX: center,
            maxY: center
        };
    }

    return { minX, minY, maxX, maxY };
}

// ============================================
// COORDINATE TRANSFORMATION
// ============================================

/**
 * Converts client (screen) coordinates to canvas coordinates,
 * considering current pan and zoom transform.
 *
 * @param {number} clientX - Client X position.
 * @param {number} clientY - Client Y position.
 * @returns {{canvasX: number, canvasY: number}}
 */
export function clientToCanvas(clientX, clientY) {
    const canvasRect = DOM.canvas.getBoundingClientRect();

    const matrix = new DOMMatrix(DOM.transformContainer.style.transform);

    const scale = matrix.a;
    const tx = matrix.e;
    const ty = matrix.f;

    // Reverse translation and scaling to get logical canvas coordinates
    return {
        canvasX: ((clientX - canvasRect.left) - tx) / scale,
        canvasY: ((clientY - canvasRect.top) - ty) / scale
    };
}