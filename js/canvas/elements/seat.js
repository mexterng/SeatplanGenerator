// ============================================
// File: canvas/elements/seat.js
// ============================================

/**
 * Handles seat element lifecycle and behavior.
 *
 * Responsibilities:
 * - Load and cache seat templates (HTML + CSS)
 * - Create, duplicate and delete seat elements
 * - Manage seat numbering and seat state synchronization
 * - Attach UI interaction handlers (delete, duplicate, rotate, drag)
 * - Integrate seat connections
 * - Provide bulk seat generation logic
 */

import { state, MAX_CANVAS, ROTATION_ANGLE, SEAT_GAP, DUPLICATE_OFFSET } from '../../state.js';
import { attachConnectorListener } from './connection.js';
import { guaranteeCanvasBoundaries, getElementTransformData, rotateElement } from './utils.js';
import { handleElementPointerDown } from '../drag-elements.js';
import { DOM } from '../../dom.js';
import { fitView } from '../zoom.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

// ============================================
// TEMPLATE LOADING & CACHING
// ============================================

/**
 * Loads and caches seat HTML template and CSS.
 * Ensures resources are only loaded once.
 *
 * @returns {Promise<void>}
 */
async function loadSeatTemplateFiles() {
    // Inject CSS once
    if (!document.getElementById('seatCSS')) {
        const link = document.createElement('link');
        link.id = 'seatCSS';
        link.rel = 'stylesheet';
        link.href = 'templates/seat.css';
        document.head.appendChild(link);
    }

    // Cache HTML template globally
    if (!window.seatTemplate) {
        const html = await fetch('templates/seat.html')
            .then(r => {
                if (!r.ok) {
                    throw new Error(`Seat template not found (${r.status})`);
                }
                return r.text();
            });

        const div = document.createElement('div');
        div.innerHTML = html.trim();
        window.seatTemplate = div.firstElementChild;
    }
}

// ============================================
// SIZE HELPERS
// ============================================

/**
 * Returns seat width and height.
 * Uses existing seat if available, otherwise measures temporary element.
 *
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getSeatSize() {
    if (state.seats?.length > 0) {
        const el = state.seats[0].element;
        return { width: el.offsetWidth, height: el.offsetHeight };
    }

    await loadSeatTemplateFiles();

    const tmp = document.createElement('div');
    tmp.className = 'seat';
    tmp.style.cssText = 'position:absolute;visibility:hidden';

    document.body.appendChild(tmp);
    const size = { width: tmp.offsetWidth, height: tmp.offsetHeight };
    document.body.removeChild(tmp);

    return size;
}

// ============================================
// CREATION
// ============================================

/**
 * Creates a single seat element at specific coordinates.
 *
 * @param {number} x - X position in canvas space.
 * @param {number} y - Y position in canvas space.
 * @param {number} rotate - Initial rotation angle.
 * @param {HTMLElement} canvas - Target canvas.
 * @param {number} [id] - Optional predefined seat ID.
 * @returns {Promise<void>}
 */
export async function createSeatElement(x, y, rotate, canvas, id) {
    await loadSeatTemplateFiles();

    const seat = window.seatTemplate.cloneNode(true);

    const { width: sw, height: sh } = await getSeatSize();

    // Ensure seat remains within canvas boundaries
    ({ x, y } = guaranteeCanvasBoundaries(x, y, sw, sh, canvas));

    seat.style.left = x + 'px';
    seat.style.top = y + 'px';
    seat.style.transform = `rotate(${rotate}deg)`;

    // Assign incremental or predefined ID
    seat.id = ++state.lastSeatID;

    if (id) {
        seat.id = id;

        // Keep lastSeatID in sync
        if (id >= state.lastSeatID) {
            state.lastSeatID = id;
        }
    }

    attachSeatEventListeners(seat, canvas);

    canvas.appendChild(seat);

    attachConnectorListener(seat);

    state.seats.push({
        element: seat,
        id: seat.id,
        x,
        y,
        rotate
    });

    DOM.seatCount.value = state.seats.length;

    updateSeatNumbers();
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Attaches UI interaction listeners to a seat element.
 *
 * @param {HTMLElement} seat - Seat element.
 * @param {HTMLElement} canvas - Canvas element.
 */
function attachSeatEventListeners(seat, canvas) {
    // Delete button
    seat.querySelector('.del').addEventListener('click', e => {
        e.stopPropagation();
        deleteSeat(seat, canvas);
    });

    // Duplicate button
    seat.querySelector('.add').addEventListener('click', e => {
        e.stopPropagation();
        duplicateSeat(seat, canvas);
    });

    // Rotate left
    seat.querySelector('.rot.left').addEventListener('click', e => {
        e.stopPropagation();
        rotateElement(seat, ROTATION_ANGLE);
    });

    // Rotate right
    seat.querySelector('.rot.right').addEventListener('click', e => {
        e.stopPropagation();
        rotateElement(seat, -ROTATION_ANGLE);
    });

    // Drag interaction
    seat.addEventListener('pointerdown', handleElementPointerDown);

    // Prevent native drag behavior
    seat.addEventListener('dragstart', e => e.preventDefault());
}

// ============================================
// DELETION
// ============================================

/**
 * Deletes a seat and all associated connections.
 *
 * @param {HTMLElement} seat - Seat element to remove.
 * @param {HTMLElement} canvas - Canvas element.
 */
export function deleteSeat(seat, canvas) {
    // Remove related connection visuals and state
    state.fixedConnections
        .filter(c => c.startConnector.closest('.seat') === seat || c.endConnector.closest('.seat') === seat)
        .forEach(c => {
            c.path.remove();

            if (c.deleteBtn) {
                c.deleteBtn.remove();
            }

            state.seatConnectionSet.delete(c.pairId);
        });

    // Clean up connection registry
    state.fixedConnections = state.fixedConnections.filter(c =>
        c.startConnector.closest('.seat') !== seat && c.endConnector.closest('.seat') !== seat
    );

    canvas.removeChild(seat);

    state.seats = state.seats.filter(t => t.element !== seat);

    DOM.seatCount.value = state.seats.length;

    updateSeatNumbers();
}

// ============================================
// DUPLICATION
// ============================================

/**
 * Duplicates a seat with position offset.
 *
 * @param {HTMLElement} seat - Source seat.
 * @param {HTMLElement} canvas - Target canvas.
 * @returns {Promise<void>}
 */
export async function duplicateSeat(seat, canvas) {
    const { x, y, angle } = getElementTransformData(seat);

    await createSeatElement(
        x + DUPLICATE_OFFSET,
        y + DUPLICATE_OFFSET,
        angle,
        canvas
    );
}

// ============================================
// BULK CREATION
// ============================================

/**
 * Creates multiple seats in grid-like rows.
 * Resets previous seats before generation.
 *
 * @returns {Promise<void>}
 */
export async function createSeats() {
    const { width: sw, height: sh } = await getSeatSize();

    // Remove existing seat elements from canvas
    DOM.canvas.querySelectorAll('.seat').forEach(el => el.remove());

    state.seats = [];
    state.lastSeatID = 0;

    const count = parseInt(DOM.seatCount.value);

    let x = MAX_CANVAS / 2;
    let y = MAX_CANVAS / 2;

    for (let i = 0; i < count; i++) {
        // Move to next row after 10 seats
        if (i > 0 && i % 10 === 0) {
            x = MAX_CANVAS / 2;
            y += sh + SEAT_GAP;
        }

        await createSeatElement(x, y, 0, DOM.canvas);

        x += sw + SEAT_GAP;
    }

    DOM.seatCount.value = count;

    fitView();
}

// ============================================
// PUBLIC HANDLER
// ============================================

/**
 * Updates seat numbering visibility and order.
 * Reflects current DOM order.
 *
 * @returns {void}
 */
export function updateSeatNumbers() {
    const showNumbers =
        document.getElementById('seatNumber-checkbox').checked;

    document.querySelectorAll('.seat-nr').forEach((el, idx) => {
        el.textContent = idx + 1;

        if (showNumbers) {
            el.style.visibility = 'visible';
        }
    });
}