// ============================================
// File: ui/modal-templates.js
// ============================================

/**
 * Predefined modal dialog variants for common use cases:
 * - Information
 * - Error
 * - Confirmation
 *
 * Uses the central `openModal` system.
 */

// ============================================
// IMPORTS
// ============================================

import { openModal } from '../ui/modal-manager.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

// ============================================
// PUBLIC HANDLER — INFORMATION DIALOG
// ============================================

/**
 * Shows an informational modal with a single OK button.
 *
 * @param {string} message - The message to display in the modal
 * @param {string} [title="Information"] - Optional title for the modal
 * @returns {Promise<boolean>} - Resolves to true when OK is clicked
 */
export function showInfo(message, title = "Information") {
    return openModal({
        title,
        content: `<p>${message}</p>`,
        buttons: [
            { label: "OK", value: true, className: "btn-primary" }
        ]
    });
}

// ============================================
// PUBLIC HANDLER — ERROR DIALOG
// ============================================

/**
 * Shows an error modal with a single OK button.
 * The message is styled in red.
 *
 * @param {string} message - The error message to display
 * @param {string} [title="Error"] - Optional title for the modal
 * @returns {Promise<boolean>} - Resolves to true when OK is clicked
 */
export function showError(message, title = "Fehler") {
    return openModal({
        title,
        content: `<p class="important-text">${message}</p>`,
        buttons: [
            { label: "OK", value: true, className: "btn-primary" }
        ]
    });
}

// ============================================
// PUBLIC HANDLER — CONFIRMATION DIALOG
// ============================================

/**
 * Shows a confirmation modal with Cancel and Proceed buttons.
 *
 * @param {string} message - The confirmation message to display
 * @param {string} [title="Confirmation"] - Optional title for the modal
 * @returns {Promise<boolean>} - Resolves to true if "Proceed" is clicked, false if "Cancel" is clicked
 */
export function showConfirm(message, title = "Bestätigung") {
    return openModal({
        title,
        content: `<p>${message}</p>`,
        buttons: [
            { label: "Abbrechen", value: false, className: "btn-secondary" },
            { label: "Fortfahren", value: true, className: "btn-primary" }
        ]
    });
}