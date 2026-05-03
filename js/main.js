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
import { MAX_CANVAS } from './state.js';
import { zoomIn, zoomOut, fitView } from './canvas/zoom.js';
import { clearCanvas } from './canvas/utils.js';
import { initPointerEvents } from './canvas/pointer-events.js';
import { initializeAdvancedMode, initializeCheckboxes, initializeSidebarButtons } from './ui/sidebar.js';
import { openExportPopup } from './data/export-pdf.js';
import { loadData } from './data/localStorage.js';
import { assignNames } from './data/names-assignment.js';
import { showVersionPopup } from "./ui/version-popup.js";
import { clearSeats } from './canvas/elements/seat.js';

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

/**
 * Legacy migration: convert old keys of localStorage to new 'uiSettings' key.
 * 
 * TODO: Remove in future version
 */
function _migrateUISettings() {
    const legacyKeys = [
        'advancedMode',
        'countdown',
        'showSeatConnectors',
        'showSeatNumbers'
    ];

    const hasLegacy = legacyKeys.some(k => localStorage.getItem(k) !== null);
    if (!hasLegacy) return;

    const uiSettings = {
        advancedMode: localStorage.getItem('advancedMode') === 'true',
        countdown: localStorage.getItem('countdown') === 'true',
        seatConnectors: localStorage.getItem('showSeatConnectors') === 'true',
        seatNumbers: localStorage.getItem('showSeatNumbers') === 'true'
    };

    localStorage.setItem('uiSettings', JSON.stringify(uiSettings));

    // cleanup
    for (const key of legacyKeys) {
        localStorage.removeItem(key);
    }
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
    _legacyCleanUp();

    _initializeCanvasSize();

    // Initialize sidebar buttons and controls
    initializeSidebarButtons();

    // Initialize UI settings in localStorage
    _migrateUISettings();

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

    // Show version popup
    showVersionPopup();
});

function _legacyCleanUp() {
    // LEGACY CLEANUP: remove in a future release
    // deletes obsolete "delimiter" entry from localStorage (no longer used)
    localStorage.removeItem('delimiter');
}