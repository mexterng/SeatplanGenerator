// ============================================
// File: ui/sidebar.js
// ============================================

/**
 * Handles UI for sidebar including:
 * - Sidebar toggle
 * - Advanced mode toggle and controls
 * - Button bindings for seats, names, and fixed elements
 * - Name editor window
 * - Checkbox states for countdown, seat numbers, and seat connectors
 */

// ============================================
// IMPORTS
// ============================================

import { createSeats } from '../canvas/elements/seat.js';
import { assignNames, clearSeats } from '../data/names.js';
import { saveNames, saveSeats, deleteLocalStorage } from '../data/localStorage.js';
import { importSeats, exportSeats, exportNames, importNames } from '../data/import-export.js';
import { DOM } from '../dom.js';
import { addFixedElement } from '../canvas/elements/fixed.js';

// ============================================
// FILE-LOCAL CONSTANTS
// ============================================

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const advancedToggle = document.getElementById('advanced-toggle');
const advancedControls = document.getElementById('advanced-controls');

// ============================================
// PUBLIC HANDLER — SIDEBAR TOGGLE
// ============================================

/**
 * Toggles sidebar open/closed and updates toggle icon.
 */
function toggleSidebar() {
    const collapsed = sidebar.classList.contains('closed');
    sidebar.classList.toggle('closed');

    // Update toggle icon depending on state
    sidebarToggle.classList.replace(
        collapsed ? 'fa-chevron-right' : 'fa-chevron-left',
        collapsed ? 'fa-chevron-left'  : 'fa-chevron-right'
    );
}

sidebarToggle.addEventListener('click', toggleSidebar);

// ============================================
// PUBLIC HANDLER — ADVANCED MODE
// ============================================

/**
 * Initializes advanced mode toggle from localStorage.
 */
export async function initializeAdvancedMode() {
    const saved = localStorage.getItem('advancedMode') === 'true';
    advancedToggle.checked = saved;
    advancedControls.style.display = saved ? 'block' : 'none';
    updateAdvancedLabel(saved);
}

/**
 * Updates advanced mode toggle icon.
 *
 * @param {boolean} state - Current advanced mode state
 */
function updateAdvancedLabel(state) {
    document.getElementById('advanced-toggle-label').innerHTML =
        `<i class="fa-solid ${state ? 'fa-minus' : 'fa-plus'}"></i>`;
}

// Listen for toggle changes
advancedToggle.addEventListener('change', () => {
    const on = advancedToggle.checked;
    advancedControls.style.display = on ? 'block' : 'none';
    updateAdvancedLabel(on);
    localStorage.setItem('advancedMode', on);
});

// ============================================
// PUBLIC HANDLER — SIDEBAR BUTTONS
// ============================================

/**
 * Binds all sidebar buttons to their respective actions.
 */
export function initializeSidebarButtons() {
    document.getElementById('create-seats-btn').addEventListener('click', createSeats);
    document.getElementById('clear-seats-btn').addEventListener('click', clearSeats);
    document.getElementById('assign-names-btn').addEventListener('click', () => assignNames(false));
    document.getElementById('shuffle-names-btn').addEventListener('click', () => assignNames(true));

    document.getElementById('save-seats-btn').addEventListener('click', saveSeats);
    document.getElementById('save-names-btn').addEventListener('click', saveNames);
    document.getElementById('delete-loacalstorage-btn').addEventListener('click', deleteLocalStorage);

    document.getElementById('import-seats-btn').addEventListener('click', importSeats);
    document.getElementById('export-seats-btn').addEventListener('click', exportSeats);
    document.getElementById('import-names-btn').addEventListener('click', importNames);
    document.getElementById('export-names-btn').addEventListener('click', exportNames);

    document.getElementById('add-desk-btn').addEventListener('click', () => addFixedElement('desk'));
    document.getElementById('add-board-btn').addEventListener('click', () => addFixedElement('board'));
    document.getElementById('add-door-btn').addEventListener('click', () => addFixedElement('door'));
    document.getElementById('add-window-btn').addEventListener('click', () => addFixedElement('window'));
}

// ============================================
// PUBLIC HANDLER — NAME EDITOR
// ============================================

/**
 * Opens the name editor window and passes current names input.
 */
document.getElementById('edit-icon').addEventListener('click', () => {
    localStorage.setItem('namesStr', DOM.namesInput.value);
    window.open(
        'nameEditor.html', 
        'nameEditor', 
        'width=550,height=600,scrollbars=yes,resizable=yes'
    );
});

// ============================================
// PUBLIC HANDLER — CHECKBOXES INITIALIZATION
// ============================================

/**
 * Initializes all sidebar checkboxes from localStorage.
 */
export function initializeCheckboxes() {
    _initCountdownCheckbox();
    _initSeatNumberCheckbox();
    _initSeatConnectorCheckbox();
}

// ── Countdown ────────────────────────────────

/**
 * Initializes countdown checkbox state.
 */
function _initCountdownCheckbox() {
    const cb = document.getElementById('countdown-checkbox');
    cb.checked = localStorage.getItem('countdown') === 'true';
    cb.addEventListener('change', () => {
        localStorage.setItem('countdown', cb.checked);
    });
}

// ── Seat Numbers ─────────────────────────────

/**
 * Initializes seat number visibility checkbox.
 */
function _initSeatNumberCheckbox() {
    const cb = document.getElementById('seatNumber-checkbox');
    cb.checked = localStorage.getItem('showSeatNumbers') === 'true';

    if (cb.checked) _setSeatNumbersVisible(true);

    cb.addEventListener('change', () => {
        localStorage.setItem('showSeatNumbers', cb.checked);
        _setSeatNumbersVisible(cb.checked);
    });
}

/**
 * Toggles visibility of seat numbers.
 *
 * @param {boolean} visible - Whether seat numbers should be visible
 */
function _setSeatNumbersVisible(visible) {
    Array.from(document.querySelectorAll('.seat-nr')).forEach(seatNr => {
        seatNr.style.visibility = visible ? 'visible' : 'hidden';
    });
}

// ── Seat Connectors ──────────────────────────

/**
 * Initializes seat connector visibility checkbox.
 */
function _initSeatConnectorCheckbox() {
    const cb = document.getElementById('seatConnector-checkbox');
    cb.checked = localStorage.getItem('showSeatConnectors') === 'true';

    if (cb.checked) _setSeatConnectorsVisible(true);

    cb.addEventListener('change', () => {
        localStorage.setItem('showSeatConnectors', cb.checked);
        _setSeatConnectorsVisible(cb.checked);
    });
}

/**
 * Toggles visibility of seat connector lines.
 *
 * @param {boolean} visible - Whether seat connectors should be visible
 */
function _setSeatConnectorsVisible(visible) {
    DOM.canvas.classList.toggle('show-seat-connectors', visible);
    DOM.svgConnectionLayer.style.visibility = visible ? 'visible' : 'hidden';
}