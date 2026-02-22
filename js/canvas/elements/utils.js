// ============================================
// File: canvas/elements/utils.js
// ============================================

/**
 * Provides utility helpers for canvas elements.
 *
 * Responsibilities:
 * - Handle element rotation and keep elements inside canvas bounds
 * - Guarantee boundary constraints
 * - Extract transform-related data from elements
 */

import { updateAllConnections } from './connection.js';
import { DOM } from '../../dom.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================


// ============================================
// TEMPLATE LOADING
// ============================================
export async function loadTemplateOnce(id, cssHref, htmlPath, globalCacheName) {
    if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = cssHref;
        document.head.appendChild(link);
    }

    if (!window[globalCacheName]) {
        const html = await fetch(htmlPath).then(r => {
            if (!r.ok) throw new Error(`${htmlPath} not found (${r.status})`);
            return r.text();
        });

        const div = document.createElement('div');
        div.innerHTML = html.trim();
        window[globalCacheName] = div.firstElementChild;
    }
    return window[globalCacheName];
}

// ============================================
// ROTATION
// ============================================

/**
 * Rotates an element by a given angle and ensures it remains inside canvas.
 * Also updates all connection paths after rotation.
 *
 * @param {HTMLElement} element - Target element.
 * @param {number} rotationAngle - Angle delta in degrees.
 * @returns {void}
 */
export function rotateElement(element, rotationAngle) {
    const currentAngle = _getRotationAngle(element);

    element.style.transform = `rotate(${currentAngle + rotationAngle}deg)`;

    // Ensure rotated element stays fully inside canvas
    const { x: cx, y: cy } = keepInsideCanvas(
        element,
        parseFloat(element.style.left),
        parseFloat(element.style.top),
        DOM.canvas
    );

    element.style.left = cx + 'px';
    element.style.top = cy + 'px';

    // Update connection paths after geometry change
    updateAllConnections();
}

// ============================================
// CANVAS BOUNDARY HELPERS
// ============================================

/**
 * Clamps element position to remain inside canvas boundaries.
 * Assumes element is not rotated.
 *
 * @param {number} x - Proposed X coordinate.
 * @param {number} y - Proposed Y coordinate.
 * @param {number} elementWidth - Element width.
 * @param {number} elementHeight - Element height.
 * @param {HTMLElement} canvas - Canvas element.
 * @returns {{x: number, y: number}} Corrected position.
 */
export function guaranteeCanvasBoundaries(x, y, elementWidth, elementHeight, canvas) {
    x = Math.max(0, Math.min(x, canvas.clientWidth - elementWidth));
    y = Math.max(0, Math.min(y, canvas.clientHeight - elementHeight));

    return { x, y };
}

/**
 * Ensures a rotated element remains fully inside canvas.
 * Calculates rotated corner positions and corrects overflow.
 *
 * @param {HTMLElement} element - Target element.
 * @param {number} newX - Proposed X coordinate.
 * @param {number} newY - Proposed Y coordinate.
 * @param {HTMLElement} canvas - Canvas element.
 * @returns {{x: number, y: number}} Corrected position.
 */
export function keepInsideCanvas(element, newX, newY, canvas) {
    const w = element.offsetWidth;
    const h = element.offsetHeight;

    const cx = w / 2;
    const cy = h / 2;

    const rad = _getRotationRad(element);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Compute rotated corner positions
    const corners = [
        { x: -cx, y: -cy },
        { x: cx, y: -cy },
        { x: -cx, y: cy },
        { x: cx, y: cy }
    ].map(c => ({
        x: newX + cx + (c.x * cos - c.y * sin),
        y: newY + cy + (c.x * sin + c.y * cos)
    }));

    const minX = Math.min(...corners.map(p => p.x));
    const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y));
    const maxY = Math.max(...corners.map(p => p.y));

    let corrX = newX;
    let corrY = newY;

    // Correct overflow on each boundary side
    if (minX < 0) corrX += -minX;
    if (minY < 0) corrY += -minY;

    if (maxX > canvas.clientWidth) {
        corrX -= (maxX - canvas.clientWidth);
    }

    if (maxY > canvas.clientHeight) {
        corrY -= (maxY - canvas.clientHeight);
    }

    return { x: corrX, y: corrY };
}

// ============================================
// TRANSFORM DATA
// ============================================

/**
 * Extracts transform-related data from an element.
 *
 * @param {HTMLElement} element - Target element.
 * @returns {{x: number, y: number, angle: number}} Position and rotation.
 */
export function getElementTransformData(element) {
    return {
        x: parseFloat(element.style.left) || 0,
        y: parseFloat(element.style.top) || 0,
        angle: _getRotationAngle(element)
    };
}

// ============================================
// ELEMENT SIZE HELPERS
// ============================================

/**
 * Measures rendered width and height of a given element type.
 * Inserts a hidden temporary element into the DOM for accurate size calculation.
 *
 * @param {string} className - CSS class of the element (e.g. 'seat', 'fixed-element desk').
 * @returns {{width: number, height: number}} Measured size in pixels.
 */
export function measureElementSize(className) {
    const tmp = document.createElement('div');
    tmp.className = className;
    tmp.style.cssText = 'position:absolute;visibility:hidden';

    document.body.appendChild(tmp);
    const size = { width: tmp.offsetWidth, height: tmp.offsetHeight };
    document.body.removeChild(tmp);

    return size;
}

// ============================================
// PRIVATE HELPERS
// ============================================

/**
 * Returns rotation angle (degrees) from inline transform style.
 *
 * @param {HTMLElement} element - Target element.
 * @returns {number} Rotation angle in degrees.
 */
function _getRotationAngle(element) {
    const t = element.style.transform || 'rotate(0deg)';

    return parseFloat(
        t.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0
    );
}

/**
 * Returns rotation angle in radians using computed transform matrix.
 *
 * @param {HTMLElement} element - Target element.
 * @returns {number} Rotation angle in radians.
 */
function _getRotationRad(element) {
    const transform = window.getComputedStyle(element).transform;

    if (!transform || transform === 'none') {
        return 0;
    }

    const m = new DOMMatrix(transform);

    return Math.atan2(m.b, m.a);
}