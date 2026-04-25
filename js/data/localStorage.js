// ============================================
// File: data/localStorage.js
// ============================================

/**
 * Provides functions to save and load seating plan data and names in localStorage.
 *
 * Responsibilities:
 * - Retrieve seat, fixed element, and connection data
 * - Save seats and names to localStorage
 * - Delete stored data
 * - Load and render all stored data on canvas
 */

// ============================================
// IMPORTS
// ============================================

import { DOM } from '../dom.js';
import { state, SYMBOLS } from '../state.js';
import { createSeatElement } from '../canvas/elements/seat.js';
import { createFixedElement } from '../canvas/elements/fixed.js';
import { connectSeats, splitPairString } from '../canvas/elements/connection.js';
import { calculateBoundingBox } from '../canvas/utils.js';
import { fitView } from '../canvas/zoom.js';
import { showInfo } from '../ui/modal-template.js';

// ============================================
// FILE-LOCAL CONSTANTS
// ============================================

// No additional constants required for this module

// ============================================
// DATA RETRIEVAL
// ============================================

/**
 * Retrieves seat position and rotation data from current state.
 *
 * @returns {Array<Object>} Array of seat objects with id, x, y, and rotate.
 */
export function getSeatData() {
    return state.seats.map(t => {
        const match = (t.element.style.transform || '').match(/rotate\(([-\d.]+)deg\)/);
        const rotation = match ? parseFloat(match[1]) : 0;
        return {
            id: t.id,
            x: parseInt(t.element.style.left) || 0,
            y: parseInt(t.element.style.top) || 0,
            rotate: rotation
        };
    });
}

/**
 * Retrieves all fixed element positions, types, and rotations from DOM.
 *
 * @returns {Array<Object>} Array of fixed element objects with type, x, y, and rotate.
 */
export function getFixedData() {
    return Array.from(document.querySelectorAll('.fixed-element')).map(el => {
        const match = (el.style.transform || '').match(/rotate\(([-\d.]+)deg\)/);
        const rotation = match ? parseFloat(match[1]) : 0;
        const type = [...el.classList].pop();
        return {
            type,
            x: parseInt(el.style.left) || 0,
            y: parseInt(el.style.top) || 0,
            rotate: rotation
        };
    });
}

/**
 * Retrieves current seat connections from state.
 *
 * @returns {Array<string>} Array of connection identifiers.
 */
export function getSeatConnectionsData() {
    return [...state.seatConnectionSet];
}

/**
 * Retrieves UI settings from localStorage.
 *
 * @param {string} [key] - Optional key to retrieve a specific setting.
 * @returns {Object|any} The full settings object or the value for the given key.
 */
export function getUISettings(key) {
    const raw = localStorage.getItem('uiSettings');
    const json = JSON.parse(raw);
    if (key) {
        return json[key];
    } else {
        return json;
    }
}

// ============================================
// PUBLIC HANDLER — SAVE
// ============================================

/**
 * Saves seats, fixed elements, and connections to localStorage.
 *
 * @param {boolean} [alertMessage=true] - Whether to show alert after saving.
 * @returns {void}
 */
export async function saveSeats(alertMessage = true) {
    localStorage.setItem('seats', JSON.stringify(getSeatData()));
    localStorage.setItem('fixed', JSON.stringify(getFixedData()));
    localStorage.setItem('connections', JSON.stringify(getSeatConnectionsData()));
    if (alertMessage) await showInfo('Sitzplätze gespeichert!');
}

/**
 * Saves names from input field to localStorage.
 *
 * @param {boolean} [alertMessage=true] - Whether to show alert after saving.
 * @returns {void}
 */
export function saveNames(alertMessage = true) {
    const namesStr = DOM.namesInput.value;
    localStorage.setItem('savedNamesStr', namesStr);
    if (alertMessage) showInfo('Namen gespeichert!');
}

/**
 * Deletes all seating plan and name data from localStorage.
 *
 * @param {boolean} [alertMessage=true] - Whether to show alert after deletion.
 * @returns {void}
 */
export function deleteLocalStorage(alertMessage = true) {
    localStorage.removeItem('seats');
    localStorage.removeItem('fixed');
    localStorage.removeItem('savedNamesStr');
    if (alertMessage) showInfo('Browser-Speicher gelöscht!');
}


/**
 * Updates a specific UI setting and persists it to localStorage.
 *
 * @param {string} keyStr - The key of the setting to update.
 * @param {any} value - The value to assign to the setting.
 * @returns {void}
 */
export function setUISettings(keyStr, value) {
    const uiSettings = getUISettings();
    uiSettings[keyStr] = value;
    localStorage.setItem('uiSettings', JSON.stringify(uiSettings));
}

// ============================================
// PUBLIC HANDLER — LOAD
// ============================================

/**
 * Loads all seating plan and name data from localStorage and renders on canvas.
 *
 * @returns {Promise<void>} Loads seats, fixed elements, connections, names and centers them on canvas.
 */
export async function loadData() {
    const seatData = JSON.parse(localStorage.getItem('seats'));
    const fixedData = JSON.parse(localStorage.getItem('fixed'));
    const connectionsData = JSON.parse(localStorage.getItem('connections'));
    // TODO: Remove in future version
    // Legacy migration: convert old 'names' array to new 'savedNamesStr' format.
    const nameList = JSON.parse(localStorage.getItem('names'));
    localStorage.removeItem('names');
    const savedNameStr = nameList ? nameList.join(SYMBOLS.PERSON_DELIMITER + ' ') : localStorage.getItem('savedNamesStr');
    localStorage.setItem('savedNamesStr', savedNameStr);

    // Clear canvas and reset state
    DOM.canvas.innerHTML = '';
    state.seats.length = 0;
    state.lastSeatID = 0;
    state.fixedConnections.length = 0;
    state.seatConnectionSet.clear();

    // Reset zoom and pan
    state.currentZoom = 1.0;
    state.panOffset = { x: 0, y: 0 };

    // Calculate offsets to center group on canvas
    const bounds = calculateBoundingBox(seatData, fixedData);
    const groupCenterX = (bounds.minX + bounds.maxX) / 2;
    const groupCenterY = (bounds.minY + bounds.maxY) / 2;
    const canvasCenterX = DOM.canvas.clientWidth / 2;
    const canvasCenterY = DOM.canvas.clientHeight / 2;
    const loadOffsetX = canvasCenterX - groupCenterX;
    const loadOffsetY = canvasCenterY - groupCenterY;

    // Recreate fixed elements
    if (fixedData) {
        for (const t of fixedData) {
            await createFixedElement(t.type, t.x + loadOffsetX, t.y + loadOffsetY, t.rotate);
        }
    }

    // Recreate seats
    if (seatData) {
        for (const t of seatData) {
            await createSeatElement(t.x + loadOffsetX, t.y + loadOffsetY, t.rotate, t.id);
        }
        DOM.seatCount.value = seatData.length;
    }

    // Recreate connections
    if (connectionsData) {
        for (const connection of connectionsData) {
            const { a, b } = splitPairString(connection);
            const seatElemA = document.getElementById(a);
            const seatElemB = document.getElementById(b);
            connectSeats(seatElemA, seatElemB);
        }
    }

    // Restore names
    if (savedNameStr) {
        DOM.namesInput.value = savedNameStr;
    }

    setTimeout(fitView, 100); // Adjust view after load
}