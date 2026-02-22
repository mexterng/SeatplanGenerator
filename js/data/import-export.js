// ============================================
// File: data/import-export.js
// ============================================

/**
 * Handles JSON import and export for seats, fixed elements, connections, and names.
 *
 * Responsibilities:
 * - Export seat/fixed/connection data to JSON
 * - Export names input and assigned seat names to JSON
 * - Import seat/fixed/connection data from JSON
 * - Import names and assign them to existing seats
 */

// ============================================
// IMPORTS
// ============================================

import { state } from '../state.js';
import { DOM } from '../dom.js';
import { getSeatData, getFixedData, getSeatConnectionsData } from './localStorage.js';
import { createSeatElement } from '../canvas/elements/seat.js';
import { createFixedElement } from '../canvas/elements/fixed.js';
import { connectSeats, splitPairString } from '../canvas/elements/connection.js';

// ============================================
// FILE-LOCAL CONSTANTS
// ============================================

// ============================================
// JSON HELPER FUNCTIONS
// ============================================

/**
 * Exports given data as a JSON file.
 *
 * @param {Object} data - Data object to be exported as JSON.
 * @param {string} filename - Name of the JSON file without extension.
 * @returns {void} Triggers file download.
 */
function exportJSON(data, filename) {
    // Create JSON blob and trigger download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// DATA COLLECTION
// ============================================

/**
 * Collects current seats, fixed elements, and connections for export.
 *
 * @returns {Object} Object containing seats, fixed elements, and connections.
 */
function collectElementsData() {
    return {
        seats: getSeatData(),
        fixed: getFixedData(),
        connections: getSeatConnectionsData()
    };
}

/**
 * Collects names input string and assigned seat names for export.
 *
 * @returns {Object} Object containing names input and seat-assigned names.
 */
function collectNamesData() {
    const namesInputString = DOM.namesInput.value || '';
    const seatNames = Array.from(document.querySelectorAll('#canvas .seat')).map(seat => ({
        firstname: seat.querySelector('.seat-firstname')?.textContent.trim() || '',
        lastname: seat.querySelector('.seat-lastname')?.textContent.trim() || ''
    }));
    return { namesInput: namesInputString, 'seat-names': seatNames };
}

// ============================================
// PUBLIC HANDLER — EXPORT
// ============================================

/**
 * Exports all seat, fixed, and connection data to a JSON file.
 *
 * @returns {void} Triggers download or shows alert on error.
 */
export function exportSeats() {
    try {
        exportJSON(collectElementsData(), 'sitzplan_elements');
    } catch (err) {
        alert('Export fehlgeschlagen: ' + err.message);
    }
}

/**
 * Exports names input and seat-assigned names to a JSON file.
 *
 * @returns {void} Triggers download or shows alert on error.
 */
export function exportNames() {
    try {
        exportJSON(collectNamesData(), 'sitzplan_names');
    } catch (err) {
        alert('Export fehlgeschlagen: ' + err.message);
    }
}

// ============================================
// PUBLIC HANDLER — IMPORT
// ============================================

/**
 * Imports seats, fixed elements, and connections from a JSON file and recreates them on canvas.
 *
 * @returns {Promise<void>} Prompts user to select file and updates canvas accordingly.
 */
export async function importSeats() {
    const input = document.getElementById('importFile');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) { 
            alert('Keine Datei ausgewählt (Import abgebrochen).'); 
            return; 
        }

        try {
            const allData = JSON.parse(await file.text());
            const seatData = allData.seats;
            const fixedData = allData.fixed;
            const connectionsData = allData.connections;

            if (!Array.isArray(seatData) || !Array.isArray(fixedData) || !Array.isArray(connectionsData)) {
                alert('Ungültiges Dateiformat!');
                return;
            }

            // Clear canvas and reset state
            DOM.canvas.innerHTML = '';
            state.seats.length = 0;
            fixedConnections.length = 0;
            seatConnectionSet.clear();

            // Recreate fixed elements
            for (const t of fixedData) {
                await createFixedElement(t.type, t.x, t.y, t.rotate, DOM.canvas);
            }

            // Recreate seat elements
            for (const t of seatData) {
                await createSeatElement(t.x, t.y, t.rotate, DOM.canvas, t.id);
            }

            // Recreate seat connections
            for (const connection of connectionsData) {
                const { a, b } = splitPairString(connection);
                connectSeats(document.getElementById(a), document.getElementById(b));
            }

            alert('Sitzplätze erfolgreich importiert!');
        } catch (err) {
            alert('Fehler beim Import: ' + err.message);
        }
    };
}

/**
 * Imports names from a JSON file and assigns them to existing seats on canvas.
 *
 * @returns {Promise<void>} Prompts user to select file and updates seat names.
 */
export async function importNames() {
    const input = document.getElementById('importFile');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) { 
            alert('Keine Datei ausgewählt (Import abgebrochen).'); 
            return; 
        }

        try {
            const namesData = JSON.parse(await file.text());
            const namesInput = namesData.namesInput;
            const seatNames = namesData['seat-names'];

            if (!Array.isArray(seatNames)) {
                alert('Ungültiges Dateiformat!');
                return;
            }

            DOM.namesInput.value = namesInput;
            const seatEls = document.querySelectorAll('#canvas .seat');

            if (seatEls.length === 0) { 
                alert('Keine Sitzplätze zum Zuordnen!'); 
                return; 
            }

            if (seatNames.length < seatEls.length) {
                if (!confirm(`Achtung: Es werden nicht alle Sitzplätze besetzt werden. Es gibt ${seatEls.length} Sitzplätze, aber nur ${seatNames.length} Personen. Fortfahren?`)) return;
            }

            if (seatNames.length > seatEls.length) {
                alert(`Achtung: Es fehlen ${seatNames.length - seatEls.length} Sitzplätze.`);
                return;
            }

            // Assign names to seats
            seatEls.forEach((seat, i) => {
                const nameObj = seatNames[i];
                seat.querySelector('.seat-firstname').textContent = nameObj?.firstname || '';
                seat.querySelector('.seat-lastname').textContent = nameObj?.lastname || '';
            });

            alert('Namen erfolgreich importiert!');
        } catch (err) {
            alert('Fehler beim Import: ' + err.message);
        }
    };
}