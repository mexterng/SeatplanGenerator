// ============================================
// dom.js
// ============================================

/**
 * Exports frequently accessed DOM elements as a single object.
 * This allows consistent access to key elements across modules
 * without repeatedly querying the DOM.
 */
export const DOM = {
    namesInput: document.getElementById('namesInput'),
    seatCount: document.getElementById('seatCount'),
    canvas: document.getElementById('canvas'),
    svgConnectionLayer: document.getElementById('connection-layer'),
    transformContainer: document.getElementById('transform-container'),
    viewport: document.getElementById('viewport'),
};