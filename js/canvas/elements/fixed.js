// ============================================
// File: canvas/elements/fixed.js
// ============================================

/**
 * Handles creation and management of fixed canvas elements (e.g. desk, board, door, window).
 *
 * Responsibilities:
 * - Load and cache fixed element templates (HTML + CSS)
 * - Create fixed elements at specific coordinates or centered in viewport
 * - Ensure elements stay within canvas boundaries
 * - Attach UI interaction handlers (delete, duplicate, rotate, drag)
 * - Provide convenience API for UI-triggered creation
 */

import { ROTATION_ANGLE, DUPLICATE_OFFSET } from '../../state.js';
import { handleElementPointerDown } from '../drag-elements.js';
import { loadTemplateOnce, guaranteeCanvasBoundaries, getElementTransformData, rotateElement, measureElementSize } from './utils.js';
import { DOM } from '../../dom.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

/**
 * Maps fixed element types to their German UI labels.
 * Used for visible element titles.
 */
export const FIXED_ELEMENT_LABELS = {
    desk: 'Pult',
    board: 'Tafel',
    door: 'Tür',
    window: 'Fenster'
};

// ============================================
// TEMPLATE LOADING & CACHING
// ============================================

/**
 * Loads and caches fixed element HTML template and CSS.
 * Ensures resources are only loaded once.
 *
 * @returns {Promise<HTMLElement>} The cloned fixed template element.
 */
async function loadFixedTemplateFiles() {
    return loadTemplateOnce('fixedCSS', 'templates/fixed.css', 'templates/fixed.html', 'fixedTemplate');
}

// ============================================
// SIZE HELPERS
// ============================================

/**
 * Returns rendered width and height of a fixed element type.
 * Uses temporary hidden DOM insertion to measure size.
 *
 * @param {string} type - Fixed element type.
 * @returns {Promise<{width: number, height: number}>}
 */
export async function getFixedSize(type) {
    await loadFixedTemplateFiles();

    return measureElementSize(`fixed-element ${type}`);
}

// ============================================
// CREATION API
// ============================================

/**
 * Creates a fixed element centered in the current viewport.
 *
 * @param {string} type - Fixed element type.
 * @param {number} rotate - Initial rotation angle.
 * @returns {Promise<void>}
 */
export async function createFixedElementInView(type, rotate = 0) {
    const rect = DOM.viewport.getBoundingClientRect();

    // Extract current canvas transform
    const matrix = new DOMMatrix(window.getComputedStyle(DOM.transformContainer).transform);

    const tx = matrix.m41;
    const ty = matrix.m42;
    const scale = matrix.a || 1;

    // Convert viewport center into world coordinates
    const worldX = (rect.width / 2 - tx) / scale;
    const worldY = (rect.height / 2 - ty) / scale;

    await createFixedElement(type, worldX, worldY, rotate, DOM.canvas);
}

/**
 * Creates a fixed element at a specific canvas position.
 *
 * @param {string} type - Fixed element type.
 * @param {number} x - X position in canvas coordinates.
 * @param {number} y - Y position in canvas coordinates.
 * @param {number} rotate - Initial rotation angle.
 * @param {HTMLElement} canvas - Target canvas.
 * @returns {Promise<void>}
 */
export async function createFixedElement(type, x, y, rotate = 0, canvas = DOM.canvas) {
    await loadFixedTemplateFiles();

    const element = window.fixedTemplate.cloneNode(true);

    const { width, height } = await getFixedSize(type);

    // Ensure element remains inside canvas boundaries
    ({ x, y } = guaranteeCanvasBoundaries(x, y, width, height, canvas));

    // Set visible German label
    element.querySelector('#fixed-name').textContent = FIXED_ELEMENT_LABELS[type] || 'Unbekannt';

    element.classList.add(type);
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.style.transform = `rotate(${rotate}deg)`;

    attachFixedElementListeners(element, type, canvas);

    canvas.appendChild(element);
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Attaches UI interaction listeners to a fixed element.
 *
 * @param {HTMLElement} element - Fixed element.
 * @param {string} type - Fixed element type.
 * @param {HTMLElement} canvas - Canvas element.
 */
function attachFixedElementListeners(element, type, canvas) {
    // Delete button
    element.querySelector('.del').addEventListener('click', e => {
        e.stopPropagation();
        canvas.removeChild(element);
    });

    // Duplicate button
    element.querySelector('.add').addEventListener('click', e => {
        e.stopPropagation();
        duplicateFixedElement(element, type, canvas);
    });

    // Rotate left
    element.querySelector('.rot.left').addEventListener('click', e => {
        e.stopPropagation();
        rotateElement(element, ROTATION_ANGLE);
    });

    // Rotate right
    element.querySelector('.rot.right').addEventListener('click', e => {
        e.stopPropagation();
        rotateElement(element, -ROTATION_ANGLE);
    });

    // Drag interaction
    element.addEventListener('pointerdown', handleElementPointerDown);

    // Prevent default browser drag behavior
    element.addEventListener('dragstart', e => e.preventDefault());
}

/**
 * Duplicates an existing fixed element with offset.
 *
 * @param {HTMLElement} element - Source element.
 * @param {string} type - Fixed element type.
 * @param {HTMLElement} canvas - Target canvas.
 * @returns {Promise<void>}
 */
export async function duplicateFixedElement(element, type, canvas = DOM.canvas) {
    const { x, y, angle } = getElementTransformData(element);

    await createFixedElement(
        type,
        x + DUPLICATE_OFFSET,
        y + DUPLICATE_OFFSET,
        angle,
        canvas
    );
}

// ============================================
// PUBLIC HANDLER
// ============================================

/**
 * Convenience API for UI-triggered creation of fixed elements.
 * Creates element centered in viewport.
 *
 * @param {string} type - Fixed element type.
 * @returns {Promise<void>}
 */
export async function addFixedElement(type) {
    await createFixedElementInView(type, 0);
}