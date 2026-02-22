// ============================================
// File: canvas/drag-elements.js
// ============================================

/**
 * Handles drag & drop behavior for canvas elements.
 *
 * Responsibilities:
 * - Start drag interaction on pointer down
 * - Update element position while dragging
 * - Snap movement to grid
 * - Keep elements inside canvas boundaries
 * - Update connection paths during drag
 * - Prevent drag when interacting with control elements
 */

import { state, GRID_SIZE } from '../state.js';
import { clientToCanvas } from './utils.js';
import { updateAllConnections } from './elements/connection.js';
import { keepInsideCanvas } from './elements/utils.js';
import { throttled } from '../raf-throttle.js';
import { DOM } from '../dom.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

// ============================================
// PUBLIC HANDLER
// ============================================

/**
 * Pointer down on drag-element -> start drag.
 * Must be registered by seat/fixed element modules.
 *
 * @param {PointerEvent} event - Pointer down event.
 * @returns {void}
 */
export function handleElementPointerDown(event) {
    // Only primary mouse button or touch
    if (event.button !== 0 && event.button !== undefined) return;

    // Only react on actual drag zone
    if (!event.target.classList.contains('drag-element')) return;

    // Ignore control elements (buttons etc.)
    if (event.target.closest('.non-drag-element')) return;

    const dragElement = event.target.closest('.drag-element');

    event.stopPropagation();
    event.preventDefault();

    state.currentDrag = dragElement;

    // Capture pointer for consistent tracking even outside element
    dragElement.setPointerCapture(event.pointerId);

    const { canvasX, canvasY } = clientToCanvas(event.clientX, event.clientY);

    const style = window.getComputedStyle(dragElement);
    const matrix = new DOMMatrix(style.transform);

    // Calculate drag offset considering potential transforms
    state.dragOffsetX = canvasX - (dragElement.offsetLeft + matrix.m41);
    state.dragOffsetY = canvasY - (dragElement.offsetTop + matrix.m42);

    dragElement.addEventListener('pointermove', handleElementPointerMove);
    dragElement.addEventListener('pointerup', handleElementPointerUp);
    dragElement.addEventListener('pointercancel', handleElementPointerUp);
}

// ============================================
// DRAG MOVE HANDLER
// ============================================

/**
 * Pointer move while dragging -> update position.
 *
 * @param {PointerEvent} event - Pointer move event.
 * @returns {void}
 */
function handleElementPointerMove(event) {
    if (!state.currentDrag) return;

    const { canvasX, canvasY } = clientToCanvas(event.clientX, event.clientY);

    let newX = canvasX - state.dragOffsetX;
    let newY = canvasY - state.dragOffsetY;

    // Keep element inside canvas (including rotation)
    const { x: boundedX, y: boundedY } = keepInsideCanvas(state.currentDrag, newX, newY, DOM.canvas);

    // Snap movement to grid
    const snappedX = Math.round(boundedX / GRID_SIZE) * GRID_SIZE;

    const snappedY = Math.round(boundedY / GRID_SIZE) * GRID_SIZE;

    state.currentDrag.style.left = `${snappedX}px`;
    state.currentDrag.style.top = `${snappedY}px`;

    // Throttle connection updates to avoid excessive recalculation
    throttled(updateAllConnections);
}

// ============================================
// DRAG END HANDLER
// ============================================

/**
 * Pointer up or cancel -> end drag.
 *
 * @param {PointerEvent} event - Pointer up/cancel event.
 * @returns {void}
 */
function handleElementPointerUp(event) {
    if (!state.currentDrag) return;

    state.currentDrag.removeEventListener('pointermove', handleElementPointerMove);
    state.currentDrag.removeEventListener('pointerup', handleElementPointerUp);
    state.currentDrag.removeEventListener('pointercancel', handleElementPointerUp);
    state.currentDrag.releasePointerCapture(event.pointerId);

    state.currentDrag = null;
}

// ============================================
// DRAG BLOCK FOR CONTROL ELEMENTS
// ============================================

/**
 * Prevent control elements inside drag-element
 * from triggering drag behavior.
 */
document.addEventListener('pointerdown', event => {
    const seat = event.target.closest('.drag-element');
    if (!seat) return;

    if (event.target.closest('.non-drag-element')) {
        seat.dataset.dragBlocked = '1';
        state.dragBlockedSeat = seat;
    }
});

/**
 * Clears temporary drag block state after pointer release.
 */
document.addEventListener('pointerup', () => {
    if (!state.dragBlockedSeat) return;

    delete state.dragBlockedSeat.dataset.dragBlocked;
    state.dragBlockedSeat = null;
});