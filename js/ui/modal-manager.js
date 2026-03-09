// ============================================
// File: ui/modal-manager.js
// ============================================

/**
 * Central modal system.
 * Provides a Promise-based API to open modals with:
 * - Custom title and content
 * - Configurable buttons
 * - Optional form submission callback
 * - ESC key and outside-click closing
 */

// ============================================
// IMPORTS
// ============================================

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

/**
 * Loads an HTML template file and returns its first element.
 *
 * @param {string} path - Path to HTML template
 * @returns {Promise<HTMLElement>} - The root element of the template
 */
async function loadTemplate(path) {
    const response = await fetch(path);
    const html = await response.text();

    const wrapper = document.createElement('div');
    wrapper.innerHTML = html.trim();

    return wrapper.firstElementChild;
}

/**
 * Creates a button element based on configuration.
 *
 * @param {Object} config - Button configuration
 * @param {string} config.label - Button label text
 * @param {string} [config.className] - Optional CSS class for styling
 * @returns {HTMLButtonElement}
 */
function createButton(config) {
    const button = document.createElement('button');
    button.textContent = config.label;
    button.className = config.className ?? "btn-secondary";
    return button;
}

// ============================================
// PUBLIC HANDLER — MODAL
// ============================================

/**
 * Opens a modal dialog with configurable content and buttons.
 * Returns a Promise that resolves when the modal is closed.
 *
 * @param {Object} options - Modal configuration options
 * @param {string} [options.title] - Modal title text
 * @param {string} [options.content] - HTML content to display
 * @param {Array<Object>} [options.buttons] - Array of button configs
 * @param {boolean} [options.closeOnEsc=true] - Allow closing via ESC key
 * @param {boolean} [options.closeOnOutside=true] - Allow closing by clicking outside
 * @param {function} [options.onSubmit] - Optional callback for form submission, receives modal element
 * @returns {Promise<any>} - Resolves with the button value or onSubmit return value
 */
export async function openModal(options) {
    const modal = await loadTemplate('./templates/modal-base.html');

    const titleEl   = modal.querySelector('.modal-title');
    const contentEl = modal.querySelector('.modal-content');
    const actionsEl = modal.querySelector('.modal-actions');
    const boxEl     = modal.querySelector('.modal-box');

    // Set modal title and content
    titleEl.textContent = options.title ?? "";
    contentEl.innerHTML = options.content ?? "";

    // Append modal to body
    document.body.appendChild(modal);

    // Animate modal in
    requestAnimationFrame(() => {
        boxEl.classList.remove("opacity-0");

        // ----- Auto-focus first input in modal -----
        const firstInput = modal.querySelector("input, select, textarea, [tabindex]:not([tabindex='-1'])");
        if (firstInput) firstInput.focus();
    });

    // Call onOpen callback after modal is rendered -----
    if (typeof options.onOpen === "function") {
        requestAnimationFrame(() => {
            options.onOpen(modal);
        });
    }

    return new Promise(resolve => {

        /**
         * Closes the modal and resolves the promise.
         *
         * @param {any} value - Value to resolve the promise with
         */
        function close(value = null) {
            modal.remove();
            resolve(value);
        }

        // Create buttons
        (options.buttons ?? []).forEach(btnConfig => {
            const button = createButton(btnConfig);
            
            if (options.buttons.length === 1) button.classList.add("ml-auto");

            button.addEventListener('click', () => {
                let value = btnConfig.value;

                // Call onSubmit if provided (e.g., collect form data)
                if (value && options.onSubmit) {
                    value = options.onSubmit(modal);
                }

                // Close modal unless explicitly disabled
                if (btnConfig.close !== false) {
                    close(value);
                }
            });

            actionsEl.appendChild(button);
        });

        // ESC key closes modal
        if (options.closeOnEsc !== false) {
            const escHandler = (e) => {
                if (e.key === "Escape") {
                    document.removeEventListener('keydown', escHandler);
                    close(null);
                }
            };
            document.addEventListener('keydown', escHandler);
        }

        // Click outside closes modal
        if (options.closeOnOutside !== false) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) close(null);
            });
        }
    });
}