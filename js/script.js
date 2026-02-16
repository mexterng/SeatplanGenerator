// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

// Delimiters for parsing names
const personDelimiter = ";";
const nameDelimiter = ",";
const lockedSeatTag = "#";

// Grid configuration
const GRID_SIZE = 5;
const ROTATION_ANGLE = 15;
const SEAT_GAP = 10;

// Zoom configuration
const MAX_CANVAS = 5000;
const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;

// State for pinch zoom
let initialPinchDistance = 0;
let initialZoomForPinch = 1;
let pinchCenterX = 0;
let pinchCenterY = 0;

// ============================================
// GLOBAL STATE
// ============================================

// Seats management
let seats = [];
let lastSeatID = 0;
let seatConnectionSet = new Set();

// Drag and drop state
let currentDrag = null;
let startX = 0;
let startY = 0;
let offsetX = 0;
let offsetY = 0;
let dragBlockedSeat = null;

// Zoom state
let currentZoom = 1.0;
let panOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };

// Connection lines state
let currentConnection = null;
let fixedConnections = [];

// Animation frame throttling
let rafId = null;

// ============================================
// DOM ELEMENTS
// ============================================

const sidebarDOM = document.getElementById('sidebar');
const sidebarToggleDOM = document.getElementById('sidebar-toggle');
const namesInputDOM = document.getElementById('namesInput');
const advancedToggleDOM = document.getElementById('advanced-toggle');
const advancedControlsDOM = document.getElementById('advanced-controls');
const seatCountDOM = document.getElementById('seatCount');
const canvasDOM = document.getElementById('canvas');
canvasDOM.style.height = `${MAX_CANVAS}px`;
canvasDOM.style.width = `${MAX_CANVAS}px`;
const svgConnectionLayerDOM = document.getElementById('connection-layer');
svgConnectionLayerDOM.style.height = `${MAX_CANVAS}px`;
svgConnectionLayerDOM.style.width = `${MAX_CANVAS}px`;
const transformContainerDOM = document.getElementById('transform-container');

// Zoom buttons
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const fitViewBtn = document.getElementById('fitViewBtn');

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize application on DOM content loaded
 */
window.addEventListener('DOMContentLoaded', async () => {
    initializeDelimiters();
    await initializeAdvancedMode();
    await loadData();
    initializeCheckboxes();
    initializeZoomControls();
});

/**
 * Set delimiters in localStorage
 */
function initializeDelimiters() {
    const delimiters = {
        person: personDelimiter,
        name: nameDelimiter,
        lockedSeat: lockedSeatTag
    };
    localStorage.setItem('delimiter', JSON.stringify(delimiters));
}

/**
 * Initialize advanced mode state from localStorage
 */
async function initializeAdvancedMode() {
    const saved = localStorage.getItem('advancedMode') === 'true';
    advancedToggleDOM.checked = saved;
    advancedControlsDOM.style.display = saved ? 'block' : 'none';
    updateAdvancedLabel(saved);
}

/**
 * Initialize checkbox states from localStorage
 */
function initializeCheckboxes() {
    // Countdown checkbox
    const countdown = localStorage.getItem('countdown') === 'true';
    document.getElementById('countdown-checkbox').checked = countdown;

    // Seat numbers checkbox
    const seatNumbers = localStorage.getItem('showSeatNumbers') === 'true';
    document.getElementById('seatNumber-checkbox').checked = seatNumbers;
    if (seatNumbers) {
        Array.from(document.querySelectorAll('.seat-nr')).forEach(seatNr => {
            seatNr.style.visibility = 'visible';
        });
    }

    // Seat connectors checkbox
    const seatConnectors = localStorage.getItem('showSeatConnectors') === 'true';
    document.getElementById('seatConnector-checkbox').checked = seatConnectors;
    if (seatConnectors) {
        canvasDOM.classList.add('show-seat-connectors');
        svgConnectionLayerDOM.style.visibility = 'visible';
    }
}

// ============================================
// WINDOW EVENT HANDLERS
// ============================================

/**
 * Initialize zoom controls and panning
 */
function initializeZoomControls() {
    // Delete button
    clearCanvasBtn.addEventListener('click', () => clearCanvas());
    // Zoom buttons
    zoomOutBtn.addEventListener('click', () => zoomOut());
    zoomInBtn.addEventListener('click', () => zoomIn());
    fitViewBtn.addEventListener('click', () => fitView());

    // Mouse wheel zoom
    transformContainerDOM.addEventListener('wheel', handleWheelZoom, { passive: false });

    // Pan with left mouse button
    transformContainerDOM.addEventListener('mousedown', handleCanvasMouseDown);
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);

    // Touch events for mobile devices
    transformContainerDOM.addEventListener('touchstart', handleTouchStart, { passive: false });
    transformContainerDOM.addEventListener('touchmove', handleTouchMove, { passive: false });
    transformContainerDOM.addEventListener('touchend', handleTouchEnd);
    transformContainerDOM.addEventListener('touchcancel', handleTouchCancel);
}

// ============================================
// ZOOM AND PAN FUNCTIONS
// ============================================

/**
 * Apply zoom transform to container
 */
function applyZoom() {
    transformContainerDOM.style.transform = `translate(${panOffset.x}px, ${panOffset.y}px) scale(${currentZoom})`;
    updateAllConnections();
}

/**
 * Zoom around a specified point
 * @param {number} factor - Zoom factor (positive = in, negative = out)
 * @param {number} centerX - X coordinate of zoom center (in viewport coordinates)
 * @param {number} centerY - Y coordinate of zoom center (in viewport coordinates)
 */
function zoomAt(factor, centerX, centerY) {
    const newZoom = Math.min(Math.max(currentZoom + factor, MIN_ZOOM), MAX_ZOOM);
    if (newZoom === currentZoom) return;
    
    const zoomFactor = newZoom / currentZoom;
    
    // Adjust pan offset to keep the point fixed
    panOffset.x = centerX - (centerX - panOffset.x) * zoomFactor;
    panOffset.y = centerY - (centerY - panOffset.y) * zoomFactor;
    currentZoom = newZoom;
    
    applyZoom();
}

/**
 * Zoom in (centered)
 */
function zoomIn() {
    const viewport = transformContainerDOM.parentElement;
    zoomAt(ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
}

/**
 * Zoom out (centered)
 */
function zoomOut() {
    const viewport = transformContainerDOM.parentElement;
    zoomAt(-ZOOM_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
}

/**
 * Fit view to show all seats
 */
function fitView() {
    const bounds = calculateBoundingBox();
    let { minX, maxX, minY, maxY } = bounds;

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const viewportWidth = transformContainerDOM.parentElement.clientWidth;
    const viewportHeight = transformContainerDOM.parentElement.clientHeight;
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    // Calculate zoom to fit
    const zoomX = viewportWidth / contentWidth;
    const zoomY = viewportHeight / contentHeight;
    currentZoom = Math.min(zoomX, zoomY, MAX_ZOOM);
    currentZoom = Math.max(currentZoom, MIN_ZOOM);
    
    // Calulate center of group
    const groupCenterX = (minX + maxX) / 2;
    const groupCenterY = (minY + maxY) / 2;
    
    // Set Pan-Offset
    panOffset.x = viewportWidth / 2 - groupCenterX * currentZoom;
    panOffset.y = viewportHeight / 2 - groupCenterY * currentZoom;
    
    applyZoom();
}


/**
 * Calculate bounding box of seats and/or fixed elements
 * @param {Array} [seatElements] - Array of seat objects (optional, uses global seats if not provided)
 * @param {Array} [fixedElements] - Array of fixed element DOM nodes (optional)
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} Bounding box coordinates
 */
function calculateBoundingBox(seatElements, fixedElements) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasElements = false;

    // Helper function to process a single element
    const processElement = (item, defaultWidth = 110, defaultHeight = 60) => {
        const element = item.element || item;
        const x = element?.offsetLeft ?? item.x ?? 0;
        const y = element?.offsetTop ?? item.y ?? 0;
        const width = element?.offsetWidth ?? defaultWidth;
        const height = element?.offsetHeight ?? defaultHeight;
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
        hasElements = true;
    };

    // Process seats if provided, otherwise use global seats
    const seatsToProcess = seatElements !== undefined ? seatElements : seats;
    if (seatsToProcess?.length) {
        seatsToProcess.forEach(seat => processElement(seat, 110, 60));
    }

    // Process fixed elements if provided
    const fixedToProcess = fixedElements !== undefined ? fixedElements : document.querySelectorAll('.fixed-element');
    if (fixedToProcess?.length) {
        Array.from(fixedToProcess).forEach(elem => processElement(elem, 140, 50));
    }

    // Return default bounds if no elements found
    if (!hasElements) {
        return {
            minX: MAX_CANVAS/2,
            minY: MAX_CANVAS/2,
            maxX: MAX_CANVAS/2,
            maxY: MAX_CANVAS/2
        };
    }

    return { minX, minY, maxX, maxY };
}

/**
 * Handle wheel zoom
 * @param {WheelEvent} e - Wheel event
 */
function handleWheelZoom(e) {
    e.preventDefault();
    
    const viewport = transformContainerDOM.parentElement;
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const factor = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomAt(factor, mouseX, mouseY);
}

/**
 * Handle mouse down on canvas for panning
 * @param {MouseEvent} e - Mouse event
 */
function handleCanvasMouseDown(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    // Check if we're clicking on a draggable element or its controls
    const target = e.target;
    const isDragElement = target.closest('.drag-element') !== null;
    const isControl = target.closest('.non-drag-element') !== null;
    const isConnector = target.closest('.connector') !== null;
    
    // Only start panning if not clicking on any interactive element
    if (!isDragElement && !isControl && !isConnector) {
        e.preventDefault();
        isPanning = true;
        panStart.x = e.clientX - panOffset.x;
        panStart.y = e.clientY - panOffset.y;
        transformContainerDOM.style.cursor = 'grabbing';
    }
}

/**
 * Handle mouse move for panning
 * @param {MouseEvent} e - Mouse event
 */
function handleCanvasMouseMove(e) {
    if (!isPanning) return;
    
    e.preventDefault();
    panOffset.x = e.clientX - panStart.x;
    panOffset.y = e.clientY - panStart.y;
    applyZoom();
}

/**
 * Handle mouse up for panning
 */
function handleCanvasMouseUp() {
    if (isPanning) {
        isPanning = false;
        transformContainerDOM.style.cursor = 'grab';
    }
}

/**
 * Recalculate all connections on window resize
 */
window.addEventListener('resize', () => {
    updateAllConnections();
});

/**
 * Save advanced mode state when toggle changes
 */
advancedToggleDOM.addEventListener('change', () => {
    advancedControlsDOM.style.display = advancedToggleDOM.checked ? 'block' : 'none';
    updateAdvancedLabel(advancedToggleDOM.checked);
    localStorage.setItem('advancedMode', advancedToggleDOM.checked);
});

/**
 * Update advanced mode label icon
 * @param {boolean} state - Current advanced mode state
 */
function updateAdvancedLabel(state) {
    const icon = state ? 'fa-minus' : 'fa-plus';
    document.getElementById('advanced-toggle-label').innerHTML = `<i class="fa-solid ${icon}"></i>`;
}

// ============================================
// TOUGHANDLING
// ============================================

/**
 * Calculate distance between two touches
 * @param {Touch} touch1 - First touch
 * @param {Touch} touch2 - Second touch
 * @returns {number} Distance in pixels
 */
function getTouchDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.hypot(dx, dy);
}

/**
 * Handle touch start for panning
 * @param {TouchEvent} e - Touch event
 */
function handleTouchStart(e) {
    const target = e.target;
    const isSeat = target.closest('.drag-element') !== null;
    const isControl = target.closest('.non-drag-element') !== null;
    const isConnector = target.closest('.connector') !== null;

    // Single touch for panning
    if (e.touches.length === 1 && !isSeat && !isControl && !isConnector) {
        e.preventDefault();
        const touch = e.touches[0];
        isPanning = true;
        panStart.x = touch.clientX - panOffset.x;
        panStart.y = touch.clientY - panOffset.y;
        transformContainerDOM.style.cursor = 'grabbing';
    }
    // Double touch for pinch zoom
    else if (e.touches.length === 2) {
        e.preventDefault();
        initialPinchDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialZoomForPinch = currentZoom;
        
        // Calculate center point between touches for zoom center
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        pinchCenterX = (touch1.clientX + touch2.clientX) / 2;
        pinchCenterY = (touch1.clientY + touch2.clientY) / 2;
    }
}

/**
 * Handle touch move for panning
 * @param {TouchEvent} e - Touch event
 */
function handleTouchMove(e) {
    // Single touch panning
    if (isPanning && e.touches.length === 1) {
        e.preventDefault();
        const touch = e.touches[0];
        panOffset.x = touch.clientX - panStart.x;
        panOffset.y = touch.clientY - panStart.y;
        applyZoom();
    }
    // Double touch pinch zoom
    else if (e.touches.length === 2 && initialPinchDistance > 0) {
        e.preventDefault();
        
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialPinchDistance;
        
        // Calculate new zoom
        const newZoom = Math.min(Math.max(initialZoomForPinch * scale, MIN_ZOOM), MAX_ZOOM);
        
        if (newZoom !== currentZoom) {
            const zoomFactor = newZoom / currentZoom;
            
            // Adjust pan offset to keep pinch center fixed
            panOffset.x = pinchCenterX - (pinchCenterX - panOffset.x) * zoomFactor;
            panOffset.y = pinchCenterY - (pinchCenterY - panOffset.y) * zoomFactor;
            currentZoom = newZoom;
            
            applyZoom();
        }
    }
}

/**
 * Handle touch end
 */
function handleTouchEnd() {
    if (isPanning) {
        isPanning = false;
        transformContainerDOM.style.cursor = 'grab';
    }
}

/**
 * Handle touch cancel
 */
function handleTouchCancel() {
    isPanning = false;
    transformContainerDOM.style.cursor = 'grab';
}


// ============================================
// TEMPLATE LOADING
// ============================================

/**
 * Load seat template files (CSS and HTML)
 */
async function loadSeatTemplateFiles() {
    // Load CSS once
    if (!document.getElementById("seatCSS")) {
        const cssHref = "templates/seat.css";
        const link = document.createElement("link");
        link.id = "seatCSS";
        link.rel = "stylesheet";
        link.href = cssHref;
        document.head.appendChild(link);
    }
    
    // Load template once
    if (!window.seatTemplate) {
        const html = await fetch("templates/seat.html").then(r => r.text());
        const templateDiv = document.createElement("div");
        templateDiv.innerHTML = html.trim();
        window.seatTemplate = templateDiv.firstElementChild;
    }
}

/**
 * Load fixed element template files (CSS and HTML)
 */
async function loadFixedTemplateFiles() {
    // Load CSS once
    if (!document.getElementById("fixedCSS")) {
        const cssHref = "templates/fixed.css";
        const link = document.createElement("link");
        link.id = "fixedCSS";
        link.rel = "stylesheet";
        link.href = cssHref;
        document.head.appendChild(link);
    }
    
    // Load template once
    if (!window.fixedTemplate) {
        const html = await fetch("templates/fixed.html").then(r => r.text());
        const templateDiv = document.createElement("div");
        templateDiv.innerHTML = html.trim();
        window.fixedTemplate = templateDiv.firstElementChild;
    }
}

// ============================================
// SIZE UTILITIES
// ============================================

/**
 * Get dimensions of a fixed element by type
 * @param {string} type - Type of fixed element
 * @returns {Promise<{width: number, height: number}>}
 */
async function getFixedSize(type) {
    await loadFixedTemplateFiles();
    const tempFixed = document.createElement('div');
    tempFixed.classList.add('fixed-element', type);
    tempFixed.style.position = 'absolute';
    tempFixed.style.visibility = 'hidden';
    document.body.appendChild(tempFixed);

    const width = tempFixed.offsetWidth;
    const height = tempFixed.offsetHeight;

    document.body.removeChild(tempFixed);
    return { width, height };
}

/**
 * Get dimensions of a seat element
 * @returns {Promise<{width: number, height: number}>}
 */
async function getSeatSize() {
    // Use existing seat if available
    if (seats && seats.length > 0) {
        const seat = seats[0].element;
        return { width: seat.offsetWidth, height: seat.offsetHeight };
    }

    // Create temporary seat for measurement
    await loadSeatTemplateFiles();
    const tempSeat = document.createElement('div');
    tempSeat.className = 'seat';
    tempSeat.style.position = 'absolute';
    tempSeat.style.visibility = 'hidden';
    document.body.appendChild(tempSeat);

    const width = tempSeat.offsetWidth;
    const height = tempSeat.offsetHeight;

    document.body.removeChild(tempSeat);
    return { width, height };
}

// ============================================
// CANVAS UTILITIES
// ============================================

/**
 * Ensure element stays within canvas boundaries
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} elementWidth - Element width
 * @param {number} elementHeight - Element height
 * @param {HTMLElement} canvas - Canvas element
 * @returns {{x: number, y: number}} Corrected coordinates
 */
function guaranteeCanvasBoundaries(x, y, elementWidth, elementHeight, canvas) {
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    x = Math.max(0, Math.min(x, canvasWidth - elementWidth));
    y = Math.max(0, Math.min(y, canvasHeight - elementHeight));

    return { x, y };
}

/**
 * Keep element inside canvas considering rotation
 * @param {HTMLElement} element - Element to check
 * @param {number} newX - Proposed X coordinate
 * @param {number} newY - Proposed Y coordinate
 * @param {HTMLElement} canvas - Canvas element
 * @returns {{x: number, y: number}} Corrected coordinates
 */
function keepInsideCanvas(element, newX, newY, canvas) {
    const width = element.offsetWidth;
    const height = element.offsetHeight;

    // Get current rotation angle
    const transform = window.getComputedStyle(element).transform;
    let angle = 0;
    if (transform && transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        angle = Math.atan2(matrix.b, matrix.a);
    }

    // Calculate corner points relative to center
    const cx = width / 2;
    const cy = height / 2;
    const corners = [
        { x: -cx, y: -cy },
        { x:  cx, y: -cy },
        { x: -cx, y:  cy },
        { x:  cx, y:  cy },
    ];

    // Apply rotation to corners
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rotated = corners.map(c => ({
        x: newX + cx + (c.x * cos - c.y * sin),
        y: newY + cy + (c.x * sin + c.y * cos)
    }));

    // Find min/max values
    const minX = Math.min(...rotated.map(p => p.x));
    const maxX = Math.max(...rotated.map(p => p.x));
    const minY = Math.min(...rotated.map(p => p.y));
    const maxY = Math.max(...rotated.map(p => p.y));

    // Apply constraints
    const canvasW = canvas.clientWidth;
    const canvasH = canvas.clientHeight;

    let correctedX = newX;
    let correctedY = newY;

    if (minX < 0) correctedX += -minX;
    if (minY < 0) correctedY += -minY;
    if (maxX > canvasW) correctedX -= (maxX - canvasW);
    if (maxY > canvasH) correctedY -= (maxY - canvasH);
    
    return { x: correctedX, y: correctedY };
}

// ============================================
// ELEMENT CREATION
// ============================================

/**
 * Create a new seat element
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} rotate - Rotation angle
 * @param {HTMLElement} canvas - Canvas element
 * @param {number} [id] - Optional seat ID
 */
async function createSeatElement(x, y, rotate, canvas, id) {
    await loadSeatTemplateFiles();
    const seat = window.seatTemplate.cloneNode(true);

    // Ensure position is within canvas
    const { width: seatWidth, height: seatHeight } = await getSeatSize();
    ({x, y} = guaranteeCanvasBoundaries(x, y, seatWidth, seatHeight, canvas));

    // Set initial position and rotation
    seat.style.left = x + 'px';
    seat.style.top = y + 'px';
    seat.style.transform = `rotate(${rotate}deg)`;

    // Set ID
    seat.id = ++lastSeatID;
    if (id) {
        seat.id = id;
        if (id >= lastSeatID) lastSeatID = id;
    }

    attachSeatEventListeners(seat, canvas);
    
    // Append to canvas and register
    canvas.appendChild(seat);
    updateSeatNumbers();
    attachConnectorListener(seat);
    seats.push({ element: seat, id: seat.id, x: x, y: y, rotate: rotate });
    seatCountDOM.value = seats.length;
}

/**
 * Attach event listeners to a seat element
 * @param {HTMLElement} seat - Seat element
 * @param {HTMLElement} canvas - Canvas element
 */
function attachSeatEventListeners(seat, canvas) {
    // Delete button
    seat.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();
        deleteSeat(seat, canvas);
    });

    // Add button (duplicate)
    seat.querySelector(".add").addEventListener("click", async e => {
        e.stopPropagation();
        duplicateSeat(seat, canvas);
    });

    // Rotate buttons
    seat.querySelector(".rot.left").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(seat, ROTATION_ANGLE);
    });

    seat.querySelector(".rot.right").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(seat, -ROTATION_ANGLE);
    });

    // Drag events - use mousedown
    seat.addEventListener('mousedown', handleElementMouseDown);
    
    // Prevent default drag behavior
    seat.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });
}

/**
 * Delete a seat and its connections
 * @param {HTMLElement} seat - Seat to delete
 * @param {HTMLElement} canvas - Canvas element
 */
function deleteSeat(seat, canvas) {
    // Remove all connections related to this seat
    fixedConnections
        .filter(c => c.startConnector.closest('.seat') === seat || c.endConnector.closest('.seat') === seat)
        .forEach(c => {
            c.path.remove();
            if (c.deleteBtn) c.deleteBtn.remove();
            seatConnectionSet.delete(c.pairId);
        });

    // Remove the seat
    canvas.removeChild(seat);
    seats = seats.filter(t => t.element !== seat);
    seatCountDOM.value = seats.length;
    updateSeatNumbers();
}

/**
 * Get position and rotation data from an element
 * @param {HTMLElement} element - Element to get data from
 * @param {HTMLElement} canvas - Canvas element
 * @returns {{x: number, y: number, angle: number}} Position and rotation
 */
function getElementTransformData(element, canvas) {
        // Get current position from element's style (these are already in canvas coordinates)
    const currentX = parseFloat(element.style.left) || 0;
    const currentY = parseFloat(element.style.top) || 0;
    
    // Get rotation angle
    const currentTransform = element.style.transform || "rotate(0deg)";
    const currentAngle = parseFloat(currentTransform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
    
    // Add small offset for duplication (in canvas coordinates)
    // Offset is independent of zoom because we're in canvas coordinates
    const offset = 19.1;
    
    return {
        x: currentX + offset,
        y: currentY + offset,
        angle: currentAngle
    };
}

/**
 * Duplicate a seat element
 * @param {HTMLElement} seat - Seat element to duplicate
 * @param {HTMLElement} canvas - Canvas element
 */
async function duplicateSeat(seat, canvas) {
    const { x, y, angle } = getElementTransformData(seat, canvas);
    await createSeatElement(x, y, angle, canvas);
}

/**
 * Duplicate a fixed element
 * @param {HTMLElement} element - Fixed element to duplicate
 * @param {string} type - Type of fixed element
 * @param {HTMLElement} canvas - Canvas element
 */
async function duplicateFixedElement(element, type, canvas) {
    const { x, y, angle } = getElementTransformData(element, canvas);
    await createFixedElement(type, x, y, angle, canvas);
}

/**
 * Create multiple seats in a grid pattern
 */
async function createSeats() {
    const canvasWidth = canvasDOM.clientWidth;
    const { width: seatWidth, height: seatHeight } = await getSeatSize();
    
    canvasDOM.innerHTML = '';
    seats = [];
    lastSeatID = 0;
    
    const count = parseInt(seatCountDOM.value);
    let x = MAX_CANVAS / 2;
    let y = MAX_CANVAS / 2;

    for (let i = 0; i < count; i++) {
        if (x + seatWidth > canvasWidth || (i > 1 && i % 10 === 0)) {
            x = MAX_CANVAS / 2;
            y += seatHeight + SEAT_GAP;
        }
        await createSeatElement(x, y, 0, canvasDOM);
        x += seatWidth + SEAT_GAP;
    }
    seatCountDOM.value = count;

    fitView();
}

function clearCanvas() {
    const proceed = confirm(
        `Achtung: Es werden nun alle Elemente auf der Zeichenfläche gelöscht. Fortfahren?`
    );
    if (!proceed) return;
    seatCountDOM.value = 0;
    createSeats();
}

// ============================================
// FIXED ELEMENTS
// ============================================

/**
 * Create a new fixed element
 * @param {string} type - Element type
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} rotate - Rotation angle
 * @param {HTMLElement} canvas - Canvas element
 */
async function createFixedElement(type, x, y, rotate, canvas) {
    await loadFixedTemplateFiles();
    const fixedElem = window.fixedTemplate.cloneNode(true);

    // Ensure position is within canvas
    const { width, height } = await getFixedSize(type);
    ({x, y} = guaranteeCanvasBoundaries(x, y, width, height, canvas));

    // Set element properties
    const types = {
        desk: 'Pult',
        board: 'Tafel',
        door: 'Tür',
        window: 'Fenster'
    };

    const name = types[type] || 'Unbekannt';
    fixedElem.querySelector('#fixed-name').textContent = name;
    fixedElem.classList.add(type);
    fixedElem.style.left = x + 'px';
    fixedElem.style.top = y + 'px';
    fixedElem.style.transform = `rotate(${rotate}deg)`;

    attachFixedElementListeners(fixedElem, type, canvas);
    
    canvas.appendChild(fixedElem);
}

/**
 * Attach event listeners to a fixed element
 * @param {HTMLElement} element - Fixed element
 * @param {string} type - Element type
 * @param {HTMLElement} canvas - Canvas element
 */
function attachFixedElementListeners(element, type, canvas) {
    // Delete button
    element.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();
        canvas.removeChild(element);
    });

    // Add button (duplicate)
    element.querySelector(".add").addEventListener("click", async e => {
        e.stopPropagation();
        duplicateFixedElement(element, type, canvas);
    });

    // Rotate buttons
    element.querySelector(".rot.left").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(element, ROTATION_ANGLE);
    });

    element.querySelector(".rot.right").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(element, -ROTATION_ANGLE);
    });

    // Drag events - use mousedown
    element.addEventListener('mousedown', handleElementMouseDown);
    
    // Prevent default drag behavior
    element.addEventListener('dragstart', (e) => {
        e.preventDefault();
    });
}

/**
 * Duplicate a fixed element
 * @param {HTMLElement} element - Element to duplicate
 * @param {string} type - Element type
 * @param {HTMLElement} canvas - Canvas element
 */
async function duplicateFixedElement(element, type, canvas) {
    const rect = element.getBoundingClientRect();
    const parentRect = canvas.getBoundingClientRect();
    const currentX = rect.left - parentRect.left;
    const currentY = rect.top - parentRect.top;
    const currentTransform = element.style.transform || "rotate(0deg)";
    const currentAngle = parseFloat(currentTransform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
    await createFixedElement(type, currentX + 19.1, currentY + 19.1, currentAngle, canvas);
}

// ============================================
// ROTATION
// ============================================

/**
 * Rotate an element by a given angle
 * @param {HTMLElement} element - Element to rotate
 * @param {number} rotationAngle - Angle to rotate by
 */
function rotateElement(element, rotationAngle) {
    const currentTransform = element.style.transform || "rotate(0deg)";
    const currentAngle = parseFloat(currentTransform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
    const newAngle = currentAngle + rotationAngle;
    element.style.transform = `rotate(${newAngle}deg)`;

    // Ensure element stays inside canvas
    const { x: correctedX, y: correctedY } = keepInsideCanvas(element, parseFloat(element.style.left), parseFloat(element.style.top), canvasDOM);
    element.style.left = correctedX + "px";
    element.style.top = correctedY + "px";

    updateAllConnections();
}

// ============================================
// DRAG AND DROP (for canvas elements)
// ============================================

/**
 * Handle mouse down on drag element (seat or fixed element)
 * @param {MouseEvent} e - Mouse event
 */
function handleElementMouseDown(e) {
    // Only handle left mouse button
    if (e.button !== 0) return;
    
    const dragElement = e.target.closest('.drag-element');
    if (!dragElement) return;

    // Stop propagation to prevent canvas panning
    e.stopPropagation();
    e.preventDefault();
    
    currentDrag = dragElement;

    // Get canvas rect in viewport coordinates
    const canvasRect = canvasDOM.getBoundingClientRect();


    // Get transform container's current transform
    const transform = new DOMMatrix(transformContainerDOM.style.transform);
    const currentScale = transform.a;
    const currentTranslateX = transform.e;
    const currentTranslateY = transform.f;

    // Convert mouse coordinates from viewport to canvas coordinates
    const mouseXCanvas = e.clientX - canvasRect.left;
    const mouseYCanvas = e.clientY - canvasRect.top;
    
    const canvasX = (mouseXCanvas - currentTranslateX) / currentScale;
    const canvasY = (mouseYCanvas - currentTranslateY) / currentScale;

    const style = window.getComputedStyle(dragElement);
    const matrix = new DOMMatrix(style.transform);
    const translateX = matrix.m41;
    const translateY = matrix.m42;

    // Calculate offset in canvas coordinates
    offsetX = canvasX - (dragElement.offsetLeft + translateX);
    offsetY = canvasY - (dragElement.offsetTop + translateY);

    startX = e.clientX;
    startY = e.clientY;

    // Use pointer events for smooth dragging
    document.addEventListener('pointermove', handleElementPointerMove);
    document.addEventListener('pointerup', handleElementPointerUp);
    document.addEventListener('pointercancel', handleElementPointerUp);
}

/**
 * Handle pointer move during element drag
 * @param {PointerEvent} e - Pointer event
 */
function handleElementPointerMove(e) {
    if (!currentDrag) return;

    // Get canvas rect in viewport coordinates
    const canvasRect = canvasDOM.getBoundingClientRect();

    // Get transform container's current transform
    const transform = new DOMMatrix(transformContainerDOM.style.transform);
    const currentScale = transform.a;
    const currentTranslateX = transform.e;
    const currentTranslateY = transform.f;

    // Convert mouse coordinates from viewport to canvas coordinates
    // Get mouse position relative to canvas
    const mouseXCanvas = e.clientX - canvasRect.left;
    const mouseYCanvas = e.clientY - canvasRect.top;
    // Apply inverse transform to get actual canvas coordinates
    const canvasX = (mouseXCanvas - currentTranslateX) / currentScale;
    const canvasY = (mouseYCanvas - currentTranslateY) / currentScale;
    // Calculate new position using canvas coordinates
    let newX = canvasX - offsetX;
    let newY = canvasY - offsetY;

    let { x: correctedX, y: correctedY } = keepInsideCanvas(currentDrag, newX, newY, canvasDOM);

    // Snap to grid
    correctedX = Math.round(correctedX / GRID_SIZE) * GRID_SIZE;
    correctedY = Math.round(correctedY / GRID_SIZE) * GRID_SIZE;

    currentDrag.style.left = correctedX + 'px';
    currentDrag.style.top = correctedY + 'px';

    updateAllConnections();
}

/**
 * Handle pointer up during element drag
 */
function handleElementPointerUp() {
    if (currentDrag) {
        currentDrag = null;
    }

    document.removeEventListener('pointermove', handleElementPointerMove);
    document.removeEventListener('pointerup', handleElementPointerUp);
    document.removeEventListener('pointercancel', handleElementPointerUp);
}

/**
 * Block dragging when clicking on non-drag elements
 */
document.addEventListener('mousedown', e => {
    const seat = e.target.closest('.drag-element');
    if (!seat) return;
    if (e.target.closest('.non-drag-element')) {
        seat.dataset.dragBlocked = "1";
        seat.draggable = false;
        dragBlockedSeat = seat;
    }
});

/**
 * Restore dragging after mouseup
 */
document.addEventListener('mouseup', e => {
    if (!dragBlockedSeat) return;

    dragBlockedSeat.draggable = true;
    delete dragBlockedSeat.dataset.dragBlocked;
    dragBlockedSeat = null;
});

// ============================================
// SIDEBAR
// ============================================

sidebarToggleDOM.addEventListener("click", toggleSidebar);

/**
 * Toggle sidebar open/closed state
 */
function toggleSidebar() {
    let isCollapsed = sidebarDOM.classList.contains('closed');
    if (isCollapsed) {
        sidebarDOM.classList.remove("closed");
        sidebarToggleDOM.classList.replace("fa-chevron-right", "fa-chevron-left");
    } else {
        sidebarDOM.classList.add("closed");
        sidebarToggleDOM.classList.replace("fa-chevron-left", "fa-chevron-right");
    }
}

// ============================================
// NAME EDITOR
// ============================================

document.getElementById('edit-icon').addEventListener('click', () => {
    localStorage.setItem('namesStr', namesInputDOM.value);
    window.open('nameEditor.html', 'nameEditor', 'width=550,height=600,scrollbars=yes,resizable=yes');
});

// ============================================
// SEAT NUMBERING
// ============================================

/**
 * Update numbering of all seats
 */
function updateSeatNumbers() {
    document.querySelectorAll(".seat-nr").forEach((seatNr, idx) => {
        seatNr.textContent = idx + 1;
        if (document.getElementById('seatNumber-checkbox').checked) {
            seatNr.style.visibility = 'visible';
        } 
    });
}

// ============================================
// DATA PERSISTENCE
// ============================================

/**
 * Get all seat data
 * @returns {Array} Seat data array
 */
function getSeatData() {
    return seats.map(t => {
        const transform = t.element.style.transform || 'rotate(0deg)';
        const match = transform.match(/rotate\(([-\d.]+)deg\)/);
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
 * Get all fixed element data
 * @returns {Array} Fixed element data array
 */
function getFixedData() {
    const fixedElems = document.querySelectorAll('.fixed-element');
    return Array.from(fixedElems).map(t => {
        const transform = t.style.transform || 'rotate(0deg)';
        const match = transform.match(/rotate\(([-\d.]+)deg\)/);
        const rotation = match ? parseFloat(match[1]) : 0;
        const type = [...t.classList].pop();
        
        return {
            type: type,
            x: parseInt(t.style.left) || 0,
            y: parseInt(t.style.top) || 0,
            rotate: rotation
        };
    });
}

/**
 * Get all seat connection data
 * @returns {Array} Connection data array
 */
function getSeatConnectionsData() {
    return [...seatConnectionSet];
}

/**
 * Save seats to localStorage
 * @param {boolean} [alertmessage=true] - Show alert message
 */
function saveSeats(alertmessage = true) {
    localStorage.setItem('seats', JSON.stringify(getSeatData()));
    localStorage.setItem('fixed', JSON.stringify(getFixedData()));
    localStorage.setItem('connections', JSON.stringify(getSeatConnectionsData()));
    if (alertmessage) {
        alert('Sitzplätze gespeichert!');
    }
}

/**
 * Save names to localStorage
 * @param {boolean} [alertmessage=true] - Show alert message
 */
function saveNames(alertmessage = true) {
    const nameList = namesInputDOM.value.split(personDelimiter).map(n => n.trim());
    localStorage.setItem('names', JSON.stringify(nameList));
    if (alertmessage) {
        alert('Namen gespeichert!');
    }
}

/**
 * Delete all data from localStorage
 */
function deleteLocalStorage() {
    localStorage.removeItem('seats');
    localStorage.removeItem('fixed');
    localStorage.removeItem('names');
}

/**
 * Load all data from localStorage
 */
async function loadData() {
    const seatData = JSON.parse(localStorage.getItem('seats'));
    const fixedData = JSON.parse(localStorage.getItem('fixed'));
    const connectionsData = JSON.parse(localStorage.getItem('connections'));
    const nameList = JSON.parse(localStorage.getItem('names'));

    namesInputDOM.value = nameList;
    canvasDOM.innerHTML = '';

    // Reset viewport transform
    const viewport = document.getElementById('viewport');
    viewport.style.transform = 'none';
    
    // Reset zoom and pan
    currentZoom = 1.0;
    panOffset = { x: 0, y: 0 };
    
    // Calculate bounding box for both seats and fixed elements
    const bounds = calculateBoundingBox(seatData, fixedData);
    const { minX, maxX, minY, maxY } = bounds;

    // Calculate center of all elements
    const groupCenterX = (minX + maxX) / 2;
    const groupCenterY = (minY + maxY) / 2;
    
    // Calculate canvas center
    const canvasCenterX = canvasDOM.clientWidth / 2;
    const canvasCenterY = canvasDOM.clientHeight / 2;
    
    // Calculate offset to center the group
    const offsetX = canvasCenterX - groupCenterX;
    const offsetY = canvasCenterY - groupCenterY;

    // Create fixed elements with offset
    if (fixedData) {
        for (const t of fixedData) {
            const newX = t.x + offsetX;
            const newY = t.y + offsetY;
            await createFixedElement(t.type, newX, newY, t.rotate, canvasDOM);
        }
    }

    // Create seats with offset
    if (seatData) {
        seats = [];
        for (const t of seatData) {
            const newX = t.x + offsetX;
            const newY = t.y + offsetY;
            await createSeatElement(newX, newY, t.rotate, canvasDOM, t.id);
        }
        seatCountDOM.value = seatData.length;
    }

    // Restore connections
    if (connectionsData) {
        for (const connection of connectionsData) {
            const { a, b } = splitPairString(connection);
            const seatElementA = document.getElementById(a);
            const seatElementB = document.getElementById(b);
            connectSeats(seatElementA, seatElementB);
        }
    }

    // Restore names
    if (nameList) {
        namesInputDOM.value = nameList.join(personDelimiter + ' ');
    }

    // After everything is loaded, fit view to show all elements
    setTimeout(() => {
        fitView();
    }, 100);
}

// ============================================
// NAME ASSIGNMENT
// ============================================

/**
 * Shuffle names without considering pairs
 * @param {Array} array - Array of name objects
 * @returns {Array} Shuffled array
 */
function shuffleNamesWithoutPairs(array) {
    const result = [...array];
    const freeItems = result.filter(item => !item.lockedSeat);
    
    for (let i = freeItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [freeItems[i], freeItems[j]] = [freeItems[j], freeItems[i]];
    }
    
    // Place free items back to free seat positions
    let freeIdx = 0;
    result.forEach((item, i) => {
        if (!item.lockedSeat) result[i] = freeItems[freeIdx++];
    });
    
    return result;
}

/**
 * Assign random names to seats
 * @param {boolean} [shuffle=true] - Whether to shuffle names
 */
async function assignNames(shuffle = true) {  
    const nameListNested = parseNames(
        namesInputDOM.value, 
        personDelimiter, 
        nameDelimiter, 
        lockedSeatTag
    );
    const nameList = nameListNested.flatMap(flattenNames);
    
    if (nameList[0] === "" || seats.length === 0) {
        alert('Keine Namen oder Sitzplätze zum Zuordnen!');
        return;
    }
    
    if (nameList.length < seats.length) {
        const proceed = confirm(
            `Achtung: Es werden nicht alle Sitzplätze besetzt werden. Es gibt ${seats.length} Sitzplätze, aber nur ${nameList.length} Personen. Fortfahren?`
        );
        if (!proceed) return;
    }

    if (nameList.length > seats.length) {
        const extra = nameList.length - seats.length;
        alert(`Achtung: Es fehlen ${extra} Sitzplätze.`);
        return;
    }

    // Fill missing seats with empty names
    const fullNameList = [...nameList];
    while (fullNameList.length < seats.length) {
        fullNameList.push(getNames('', nameDelimiter, lockedSeatTag));
    }

    let shuffledNames = fullNameList;
    if (shuffle) {
        if (!nameListNested.some(item => Array.isArray(item))) {
            // No seat neighbors defined
            shuffledNames = shuffleNamesWithoutPairs(fullNameList);
        } else {
            const edges = getNormalizedSeatConnectionSet();
            const solution = generateSeatAssignmentBacktracking(
                nameListNested,
                edges,
                seats.length,
                nameDelimiter,
                lockedSeatTag
            );
            
            if (solution) {
                shuffledNames = solution;
            } else {
                shuffledNames = Array.from({ length: seats.length }, () => []);
                alert(`Achtung: Es kann keine gültige Besetzung der Sitzplätze gefunden werden. Beachten Sie vorgegeben Sitznachbarn und als benachbart gekennzeichnete Sitzplätze.`);
                return;
            }
        }
    }

    if (document.getElementById('countdown-checkbox').checked) {
        await showCountdown(5);
    }
    
    seats.forEach((s, i) => {
        s.element.querySelector('.seat-firstname').textContent = shuffledNames[i]['firstname'];
        s.element.querySelector('.seat-lastname').textContent = shuffledNames[i]['lastname'];
    });

    document.getElementById('clear-seats').style.display = "inline";
    document.getElementById('draw-seats').style.display = "none";
}

/**
 * Generate seat assignment using backtracking algorithm
 * @param {Array} persons - Nested persons array
 * @param {Array} edges - Connection edges
 * @param {number} seatCount - Number of seats
 * @param {string} nameDelimiter - Name delimiter
 * @param {string} lockedSeatTag - Locked seat tag
 * @returns {Array|null} Seat assignment array or null if impossible
 */
function generateSeatAssignmentBacktracking(persons, edges, seatCount, nameDelimiter, lockedSeatTag) {
    // Convert edges to 0-based pairs
    const edgePairs = edges.map(([a, b]) => [a - 1, b - 1]);

    // Flatten persons and assign stable IDs
    let idCounter = 0;
    const flatPersons = [];
    const clusterIds = [];
    const clusterMap = {};

    persons.forEach((p, idx) => {
        if (Array.isArray(p)) {
            clusterIds.push(idx);
            clusterMap[idx] = [];

            p.forEach(sub => {
                const obj = { ...sub, cluster: idx, _pid: idCounter++ };
                flatPersons.push(obj);
                clusterMap[idx].push(obj);
            });
        } else {
            const obj = { ...p, cluster: null, _pid: idCounter++ };
            flatPersons.push(obj);
        }
    });
    
    const shuffledClusters = shuffle(clusterIds);
    const seats = Array(seatCount).fill(null);

    // Place locked seats by their seat index
    let index = 0;
    flatPersons.forEach(p => {
        if (p.lockedSeat) {
            seats[index++] = p;
        }
    });

    // Shuffling helper
    function shuffle(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    // Backtracking for cluster pairs
    function placeCluster(idx, edgesList) {
        if (Math.random() < 0.2) {
            edgesList = shuffle(edgesList);
        }

        if (idx >= shuffledClusters.length) return true;

        const cid = shuffledClusters[idx];
        const members = shuffle(clusterMap[cid]);
        const edgesShuffled = shuffle(edgesList);

        for (let e = 0; e < edgesShuffled.length; e++) {
            const [s1, s2] = edgesShuffled[e];

            if (seats[s1] === null && seats[s2] === null) {
                seats[s1] = members[0];
                seats[s2] = members[1];

                const rest = edgesShuffled.filter((_, i) => i !== e);

                if (placeCluster(idx + 1, rest)) return true;

                seats[s1] = null;
                seats[s2] = null;
            }
        }

        return false;
    }

    const shuffledEdges = shuffle(edgePairs);

    // Try placing all clusters
    if (!placeCluster(0, shuffledEdges)) {
        return null;
    }

    // Collect remaining persons that are not placed
    const usedIds = new Set(seats.filter(s => s !== null).map(s => s._pid));
    const remaining = flatPersons.filter(p => !usedIds.has(p._pid));

    // Fill free seats with remaining persons
    const freeSeats = seats
        .map((s, i) => s === null ? i : null)
        .filter(i => i !== null);

    const shuffledFreeSeats = shuffle(freeSeats);
    const remainingShuffled = shuffle(remaining);
    
    remainingShuffled.forEach((p, i) => {
        seats[shuffledFreeSeats[i]] = p;
    });

    // Fill leftover seats with dummy if needed
    const dummyList = getNames('', nameDelimiter, lockedSeatTag);
    const dummy = dummyList[0];

    return seats.map(s => s === null ? { ...dummy } : s);
}

/**
 * Get normalized seat connection set with sequential IDs
 * @returns {Array} Normalized connections
 */
function getNormalizedSeatConnectionSet() {
    function getAllSeatIDs() {
        const ids = [];
        seats.forEach(seat => {
            ids.push(seat.id);
        });
        return ids;
    }
    
    function normalizeSeatConnectionSet(seatConnectionSet, seatIDs) {
        // Create mapping from original IDs to normalized IDs
        const sortedIds = [...seatIDs].sort((a, b) => Number(a) - Number(b));
        const idMap = {};
        sortedIds.forEach((id, index) => {
            idMap[id] = (index + 1).toString();
        });

        const edgeArray = Array.from(seatConnectionSet);
        const normalizedEdges = edgeArray.map(edge => {
            const [a, b] = edge.split('-');
            const newA = idMap[a];
            const newB = idMap[b];
            return [newA, newB];
        });

        return normalizedEdges;
    }

    const ids = getAllSeatIDs();
    const normalizedSeatConnectionSet = normalizeSeatConnectionSet(seatConnectionSet, ids);

    return normalizedSeatConnectionSet;
}

/**
 * Show countdown overlay
 * @param {number} time - Countdown time in seconds
 * @returns {Promise} Promise that resolves when countdown finishes
 */
async function showCountdown(time) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        overlay.textContent = time;
        document.body.appendChild(overlay);

        let count = time;
        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                overlay.textContent = count;
            } else {
                clearInterval(interval);
                overlay.remove();
                resolve();
            }
        }, 1000);
    });
}

/**
 * Clear all names from seats
 */
function clearSeats() {
    seats.forEach((s) => {
        s.element.querySelector('.seat-firstname').textContent = "";
        s.element.querySelector('.seat-lastname').textContent = "";
    });
    document.getElementById('clear-seats').style.display = "none";
    document.getElementById('draw-seats').style.display = "inline";
}

// ============================================
// CONNECTION LINES
// ============================================

/**
 * Create a unique pair ID from two seat IDs
 * @param {string|number} a - First seat ID
 * @param {string|number} b - Second seat ID
 * @returns {string} Pair ID
 */
function makePairId(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Split a pair string into two IDs
 * @param {string} pairString - Pair string (e.g., "1-2")
 * @returns {{a: string, b: string}} Object with IDs
 */
function splitPairString(pairString) {
    const [a, b] = pairString.split('-');
    return { a, b };
}

/**
 * Create an SVG path element for connections
 * @returns {SVGPathElement} Path element
 */
function createConnectionPath() {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute('stroke', 'rgba(0,0,0,0.6)');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-dasharray', '6 4');
    p.setAttribute('fill', 'none');
    p.style.pointerEvents = "none";
    return p;
}

/**
 * Add a delete button to a connection
 * @param {HTMLElement} startSeat - Start seat
 * @param {HTMLElement} endSeat - End seat
 * @param {SVGPathElement} path - Path element
 * @returns {SVGGElement} Delete button group
 */
function addDeleteButtonOnConnection(startSeat, endSeat, path) {
    // Create group for delete X
    const btnGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    btnGroup.style.cursor = "pointer";

    // Create two lines for delete X
    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    
    [line1, line2].forEach(line => {
        line.setAttribute("stroke", "red");
        line.setAttribute("stroke-width", 2);
        line.setAttribute("pointer-events", "all");
        btnGroup.appendChild(line);
    });

    svgConnectionLayerDOM.appendChild(btnGroup);

    // Click removes connection
    btnGroup.addEventListener("click", () => {
        path.remove();
        btnGroup.remove();

        const pairId = makePairId(startSeat.id, endSeat.id);
        seatConnectionSet.delete(pairId);
        fixedConnections = fixedConnections.filter(c => c.pairId !== pairId);
    });

    // Store delete button reference
    const connObj = fixedConnections.find(c => c.path === path);
    if (connObj) {
        connObj.deleteBtn = btnGroup;
    } else {
        fixedConnections.push({ 
            startConnector: startSeat.querySelector('.connector'), 
            endConnector: endSeat.querySelector('.connector'), 
            path: path, 
            pairId: makePairId(startSeat.id, endSeat.id), 
            deleteBtn: btnGroup 
        });
    }

    updateDeleteButtonPosition(path, btnGroup);
    return btnGroup;
}

/**
 * Update delete button position to follow path
 * @param {SVGPathElement} pathEl - Path element
 * @param {SVGGElement} btnGroup - Delete button group
 */
function updateDeleteButtonPosition(pathEl, btnGroup) {
    const pathLength = pathEl.getTotalLength();
    const midPoint = pathEl.getPointAtLength(pathLength / 2);

    const size = 4;
    const lines = btnGroup.querySelectorAll("line");

    // line1: \
    lines[0].setAttribute("x1", midPoint.x - size);
    lines[0].setAttribute("y1", midPoint.y - size);
    lines[0].setAttribute("x2", midPoint.x + size);
    lines[0].setAttribute("y2", midPoint.y + size);

    // line2: /
    lines[1].setAttribute("x1", midPoint.x - size);
    lines[1].setAttribute("y1", midPoint.y + size);
    lines[1].setAttribute("x2", midPoint.x + size);
    lines[1].setAttribute("y2", midPoint.y - size);
}

/**
 * Update all connections (paths and delete buttons)
 */
function updateAllConnections() {
    fixedConnections.forEach(conn => {
        updateConnectionFixed(conn.startConnector, conn.endConnector, conn.path);
        if (conn.deleteBtn) {
            updateDeleteButtonPosition(conn.path, conn.deleteBtn);
        }
    });
}

/**
 * Throttle function with requestAnimationFrame
 * @param {Function} fn - Function to throttle
 */
function throttled(fn) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        fn();
        rafId = null;
    });
}

/**
 * Get mouse position in SVG coordinates
 * @param {SVGSVGElement} svg - SVG element
 * @param {Object} evt - Mouse event
 * @returns {SVGPoint} Point in SVG coordinates
 */
function getMousePosInSVG(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/**
 * Handle pointer down on connector
 * @param {PointerEvent} e - Pointer event
 */
function connectorPointerDown(e) {
    e.stopPropagation();
    
    const path = createConnectionPath();
    svgConnectionLayerDOM.appendChild(path);

    const startConnector = e.target;
    const startSeat = startConnector.closest('.seat');

    currentConnection = { path, startConnector };

    updateConnectionDynamic(startConnector, e.clientX, e.clientY, path);

    function moveHandler(ev) {
        throttled(() => {
            updateConnectionDynamic(startConnector, ev.clientX, ev.clientY, path);
        });
    }

    function upHandler(ev) {
        document.removeEventListener('pointermove', moveHandler);
        document.removeEventListener('pointerup', upHandler);

        const endConnector = ev.target.closest?.('.connector') || null;
        const endSeat = endConnector ? endConnector.closest('.seat') : null;

        // Validate connection
        const valid = endConnector &&
            endConnector !== startConnector &&
            endSeat &&
            endSeat !== startSeat;

        if (valid) {
            const pair = makePairId(startSeat.id, endSeat.id);

            if (seatConnectionSet.has(pair)) {
                path.remove();
            } else {
                seatConnectionSet.add(pair);
                updateConnectionFixed(startConnector, endConnector, path);
                addDeleteButtonOnConnection(startSeat, endSeat, path);

                fixedConnections.push({
                    startConnector,
                    endConnector,
                    path,
                    pairId: pair
                });
            }
        } else {
            path.remove();
        }

        currentConnection = null;
    }

    document.addEventListener('pointermove', moveHandler);
    document.addEventListener('pointerup', upHandler);
}

/**
 * Build a cubic bezier path between two points
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 * @returns {string} SVG path data
 */
function buildBezierPath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    const nearStraight = Math.abs(dx) < 20 || Math.abs(dy) < 20;

    if (nearStraight) {
        const dist = Math.hypot(dx, dy);
        const arcHeight = dist * 0.1;

        // Determine arc direction
        const vertical = Math.abs(dx) < Math.abs(dy);
        const nx = vertical ? 1 : 0;
        const ny = vertical ? 0 : -1;

        const cx1 = x1 + (dx * 0.25) + nx * arcHeight;
        const cy1 = y1 + (dy * 0.25) + ny * arcHeight;
        const cx2 = x1 + (dx * 0.75) + nx * arcHeight;
        const cy2 = y1 + (dy * 0.75) + ny * arcHeight;

        return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
    }

    // Default curve
    const cx1 = x1 + (x2 - x1) * 0.25;
    const cy1 = y1;
    const cx2 = x1 + (x2 - x1) * 0.75;
    const cy2 = y2;
    return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

/**
 * Update connection path during dragging
 * @param {HTMLElement} startEl - Start element
 * @param {number} mouseX - Mouse X coordinate
 * @param {number} mouseY - Mouse Y coordinate
 * @param {SVGPathElement} pathEl - Path element
 */
function updateConnectionDynamic(startEl, mouseX, mouseY, pathEl) {
    const mousePos = getMousePosInSVG(svgConnectionLayerDOM, { clientX: mouseX, clientY: mouseY });
    
    const a = startEl.getBoundingClientRect();
    const startX = a.left + a.width / 2;
    const startY = a.top + a.height / 2;

    const startPt = svgConnectionLayerDOM.createSVGPoint();
    startPt.x = startX;
    startPt.y = startY;
    const start = startPt.matrixTransform(svgConnectionLayerDOM.getScreenCTM().inverse());

    pathEl.setAttribute("d", buildBezierPath(start.x, start.y, mousePos.x, mousePos.y));
}

/**
 * Update connection path for fixed endpoints
 * @param {HTMLElement} startEl - Start element
 * @param {HTMLElement} endEl - End element
 * @param {SVGPathElement} pathEl - Path element
 */
function updateConnectionFixed(startEl, endEl, pathEl) {
    const rectA = startEl.getBoundingClientRect();
    const rectB = endEl.getBoundingClientRect();

    const ptA = svgConnectionLayerDOM.createSVGPoint(); 
    ptA.x = rectA.left + rectA.width/2; 
    ptA.y = rectA.top + rectA.height/2;
    
    const ptB = svgConnectionLayerDOM.createSVGPoint(); 
    ptB.x = rectB.left + rectB.width/2; 
    ptB.y = rectB.top + rectB.height/2;

    const start = ptA.matrixTransform(svgConnectionLayerDOM.getScreenCTM().inverse());
    const end   = ptB.matrixTransform(svgConnectionLayerDOM.getScreenCTM().inverse());

    pathEl.setAttribute("d", buildBezierPath(start.x, start.y, end.x, end.y));
}

/**
 * Attach connector listener to a seat
 * @param {HTMLElement} element - Seat element
 */
function attachConnectorListener(element) {
    element.querySelector('.connector').addEventListener('pointerdown', connectorPointerDown);
}

/**
 * Connect two seats programmatically
 * @param {HTMLElement} seatA - First seat
 * @param {HTMLElement} seatB - Second seat
 */
function connectSeats(seatA, seatB) {
    const path = createConnectionPath();
    svgConnectionLayerDOM.appendChild(path);

    const pair = makePairId(seatA.id, seatB.id);

    if (!seatConnectionSet.has(pair)) {
        seatConnectionSet.add(pair);
        updateConnectionFixed(seatA, seatB, path);
        addDeleteButtonOnConnection(seatA, seatB, path);

        fixedConnections.push({
            startConnector: seatA.querySelector('.connector'),
            endConnector: seatB.querySelector('.connector'),
            path,
            pairId: pair
        });
    }
}