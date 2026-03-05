// ============================================
// File: main.js
// ============================================

/**
 * Main application entry point for seating plan editor.
 *
 * Responsibilities:
 * - Initialize canvas and UI components
 * - Set up sidebar, advanced mode, and checkboxes
 * - Bind canvas control buttons (zoom, fit, clear, PDF export)
 * - Load saved seating and names data from localStorage
 * - Initialize pointer events for interactive canvas
 */

// ============================================
// IMPORTS
// ============================================

import { DOM } from './dom.js';
import { MAX_CANVAS, PERSON_DELIMITER, NAME_DELIMITER, LOCKED_SEAT_TAG } from './state.js';
import { zoomIn, zoomOut, fitView } from './canvas/zoom.js';
import { clearCanvas } from './canvas/utils.js';
import { initPointerEvents } from './canvas/pointer-events.js';
import { initializeAdvancedMode, initializeCheckboxes, initializeSidebarButtons } from './ui/sidebar.js';
import { openExportPopup } from './data/export-pdf.js';
import { loadData } from './data/localStorage.js';
import { assignNames, clearSeats } from './data/names.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

const clearCanvasBtn = document.getElementById('clear-canvas-btn');
const zoomOutBtn     = document.getElementById('zoomOutBtn');
const zoomInBtn      = document.getElementById('zoomInBtn');
const fitViewBtn     = document.getElementById('fitViewBtn');
const pdfExportBtn   = document.getElementById('exportBtn');
const assignNamesBtn = document.getElementById('shuffle-canvas-btn');
const clearSeatsBtn  = document.getElementById('clear-seats-canvas-btn');

// ============================================
// CANVAS INITIALIZATION
// ============================================

/**
 * Set initial canvas and SVG layer size to MAX_CANVAS.
 */
function _initializeCanvasSize() {
    const size = `${MAX_CANVAS}px`;

    [DOM.canvas, DOM.svgConnectionLayer].forEach(el => {
        if (!el) return; // Skip if element not found
        el.style.width  = size;
        el.style.height = size;
    });
}

/**
 * Store delimiter configuration in localStorage for name parsing.
 */
function _initializeDelimiters() {
    const delimiterConfig = {
        person: PERSON_DELIMITER,
        name: NAME_DELIMITER,
        lockedSeat: LOCKED_SEAT_TAG
    };

    localStorage.setItem('delimiter', JSON.stringify(delimiterConfig));
}

/**
 * Bind event listeners for canvas control buttons.
 */
function _initializeCanvasButtons() {
    zoomOutBtn.addEventListener('click', zoomOut);
    zoomInBtn.addEventListener('click', zoomIn);
    fitViewBtn.addEventListener('click', fitView);
    clearCanvasBtn.addEventListener('click', clearCanvas);
    assignNamesBtn.addEventListener('click', () => assignNames(true));
    clearSeatsBtn.addEventListener('click', clearSeats)
    pdfExportBtn.addEventListener('click', openExportPopup);
}

// ============================================
// APPLICATION INITIALIZATION
// ============================================

/**
 * Initialize the seating plan editor application.
 * Executes on DOMContentLoaded event.
 * Performs canvas setup, sidebar setup, advanced mode, checkboxes,
 * pointer events, and loads saved data.
 */
window.addEventListener('DOMContentLoaded', async () => {
    _initializeCanvasSize();
    _initializeDelimiters();

    // Initialize sidebar buttons and controls
    initializeSidebarButtons();

    // Initialize advanced mode UI and state
    await initializeAdvancedMode();

    // Initialize checkboxes (countdown, seat numbers, connectors)
    initializeCheckboxes();

    // Bind canvas control buttons
    _initializeCanvasButtons();

    // Initialize pointer events for interactive canvas
    initPointerEvents();

    // Load saved seating and names from localStorage
    await loadData();
});