// ============================================
// File: state.js
// ============================================

/**
 * Global constants and mutable application state for seating plan editor.
 *
 * Responsibilities:
 * - Provide configuration constants for canvas, zoom, and seat layout
 * - Maintain central mutable state object for seats, connections, drag & drop, zoom/pan
 * - Store global parameters like delimiters and duplication offsets
 */

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

// Delimiters used for parsing names
export const PERSON_DELIMITER = ";";
export const NAME_DELIMITER   = ",";
export const LOCKED_SEAT_TAG  = "#";

// Canvas / Layout
export const GRID_SIZE      = 5;     // grid snapping for seats
export const ROTATION_ANGLE = 15;    // default rotation step for seats
export const SEAT_GAP       = 10;    // spacing between seats
export const MAX_CANVAS     = 5000;  // maximum canvas size

// Duplication offset for copied seats
export const DUPLICATE_OFFSET = 20;

// Zoom configuration
export const ZOOM_STEP = 0.1;
export const MIN_ZOOM  = 0.5;
export const MAX_ZOOM  = 2.0;

// Connection rendering
export const CONNECTION_DELETE_BTN_SIZE = 4;

// ============================================
// CENTRAL MUTABLE STATE OBJECT
// ============================================

/**
 * Central mutable state object for the application.
 * Stores seats, connections, drag state, zoom/pan and RAF throttling.
 */
export const state = {
    // Seats
    seats: [],               // array of { element, id, x, y, rotate }
    lastSeatID: 0,           // last used seat ID
    seatConnectionSet: new Set(), // set of all seat connection IDs

    // Drag & Drop state
    currentDrag: null,       // currently dragged seat element
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragBlockedSeat: null,   // seat that blocks dragging

    // Zoom / Pan
    currentZoom: 1.0,
    panOffset: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 },

    // Pinch zoom
    initialPinchDistance: 0,
    initialZoomForPinch: 1,
    pinchCenterX: 0,
    pinchCenterY: 0,

    // SVG connections
    currentConnection: null,
    fixedConnections: [],    // array of { startConnector, endConnector, path, pairId, deleteBtn }

    // RAF (requestAnimationFrame) throttle
    rafId: null
};