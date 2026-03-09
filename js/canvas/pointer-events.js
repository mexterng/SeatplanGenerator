// ============================================
// File: canvas/pointer-events.js
// ============================================

/**
 * Handles canvas interaction via pointer input.
 *
 * Responsibilities:
 * - Mouse wheel zooming
 * - Pointer-based panning
 * - Pinch-to-zoom gesture handling
 * - Zoom clamping and pan boundary restriction
 * - Updating connection paths after transform changes
 */

import { state, MAX_CANVAS, MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../state.js';

import { zoomAt, applyZoom } from './zoom.js';
import { updateAllConnections } from './elements/connection.js';
import { DOM } from '../dom.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

/**
 * Tracks active pointers for pinch zoom.
 * Map<pointerId, { x: number, y: number }>
 */
const activePointers = new Map();

// ============================================
// PUBLIC INITIALIZATION
// ============================================

/**
 * Initializes pointer and wheel event listeners for canvas interaction.
 *
 * @returns {void}
 */
export function initPointerEvents() {
    DOM.transformContainer.addEventListener('wheel', _handleWheelZoom, { passive: false });
    DOM.transformContainer.addEventListener('pointerdown', _handlePointerDown);

    window.addEventListener('pointermove', _handlePointerMove);
    window.addEventListener('pointerup', _handlePointerUp);
    window.addEventListener('pointercancel', _handlePointerUp);

    // Recalculate connection paths on resize
    window.addEventListener('resize', () => updateAllConnections());
}

// ============================================
// WHEEL ZOOM
// ============================================

/**
 * Handles mouse wheel zoom centered at cursor position.
 *
 * @param {WheelEvent} event - Wheel event.
 * @returns {void}
 */
function _handleWheelZoom(event) {
    event.preventDefault();

    const rect = DOM.viewport.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Positive deltaY -> zoom out, negative -> zoom in
    zoomAt(
        event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP,
        mouseX,
        mouseY
    );
}

// ============================================
// POINTER DOWN
// ============================================

/**
 * Handles pointer down for panning and pinch initialization.
 *
 * @param {PointerEvent} event - Pointer event.
 * @returns {void}
 */
function _handlePointerDown(event) {
    activePointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY
    });

    // Two pointers -> initialize pinch zoom
    if (activePointers.size === 2) {
        state.isPanning = false;
        initPinchZoom();
        return;
    }

    // Single pointer -> start panning if not on interactive element
    if (activePointers.size === 1) {
        const target = event.target;

        const onDragElement =
            target.closest('.drag-element') !== null;

        const onControl =
            target.closest('.non-drag-element') !== null;

        const onConnector =
            target.closest('.connector') !== null;

        if (!onDragElement && !onControl && !onConnector) {
            event.preventDefault();

            state.isPanning = true;

            // Store initial pan start offset
            state.panStart.x = event.clientX - state.panOffset.x;
            state.panStart.y = event.clientY - state.panOffset.y;

            DOM.transformContainer.style.cursor = 'grabbing';
        }
    }
}

// ============================================
// POINTER MOVE
// ============================================

/**
 * Handles pointer move for panning and pinch zoom updates.
 *
 * @param {PointerEvent} event - Pointer event.
 * @returns {void}
 */
function _handlePointerMove(event) {
    if (activePointers.has(event.pointerId)) {
        activePointers.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY
        });
    }

    // Pinch zoom update
    if (
        activePointers.size === 2 &&
        state.initialPinchDistance > 0
    ) {
        event.preventDefault();
        updatePinchZoom();
        return;
    }

    // Panning update
    if (state.isPanning && activePointers.size <= 1) {
        event.preventDefault();
        updatePanning(event.clientX, event.clientY);
    }
}

// ============================================
// POINTER UP / CANCEL
// ============================================

/**
 * Handles pointer release and resets pinch/pan state.
 *
 * @param {PointerEvent} event - Pointer event.
 * @returns {void}
 */
function _handlePointerUp(event) {
    activePointers.delete(event.pointerId);

    // Reset pinch state when fewer than 2 pointers remain
    if (activePointers.size < 2) {
        state.initialPinchDistance = 0;
    }

    // Stop panning when no pointers remain
    if (activePointers.size === 0 && state.isPanning) {
        state.isPanning = false;
        DOM.transformContainer.style.cursor = 'grab';
    }
}

// ============================================
// PANNING
// ============================================

/**
 * Updates pan offset while dragging the canvas.
 *
 * @param {number} clientX - Pointer X position.
 * @param {number} clientY - Pointer Y position.
 * @returns {void}
 */
function updatePanning(clientX, clientY) {
    const rect = DOM.viewport.getBoundingClientRect();

    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    const scaledWidth = MAX_CANVAS * state.currentZoom;
    const scaledHeight = MAX_CANVAS * state.currentZoom;

    const newX = clientX - state.panStart.x;
    const newY = clientY - state.panStart.y;

    // Clamp panning to avoid empty space beyond canvas
    state.panOffset.x = Math.max(viewportWidth - scaledWidth, Math.min(0, newX));
    state.panOffset.y = Math.max(viewportHeight - scaledHeight, Math.min(0, newY));

    applyZoom();
}

// ============================================
// PINCH ZOOM
// ============================================

/**
 * Initializes pinch zoom by storing initial distance and center.
 *
 * @returns {void}
 */
function initPinchZoom() {
    const [p1, p2] = Array.from(activePointers.values());
    state.initialPinchDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    state.initialZoomForPinch = state.currentZoom;

    // Store pinch center in screen coordinates
    state.pinchCenterX = (p1.x + p2.x) / 2;
    state.pinchCenterY = (p1.y + p2.y) / 2;
}

/**
 * Updates zoom level based on pinch gesture.
 *
 * @returns {void}
 */
function updatePinchZoom() {
    const [p1, p2] = Array.from(activePointers.values());

    const currentDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    const scale = currentDistance / state.initialPinchDistance;

    const newZoom = Math.min(Math.max(state.initialZoomForPinch * scale, MIN_ZOOM), MAX_ZOOM);
    if (newZoom === state.currentZoom) return;

    const zoomFactor = newZoom / state.currentZoom;

    // Adjust pan offset so zoom is centered at pinch center
    state.panOffset.x = state.pinchCenterX - (state.pinchCenterX - state.panOffset.x) * zoomFactor;
    state.panOffset.y = state.pinchCenterY - (state.pinchCenterY - state.panOffset.y) * zoomFactor;

    state.currentZoom = newZoom;

    applyZoom();
}