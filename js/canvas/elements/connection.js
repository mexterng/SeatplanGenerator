// ============================================
// File: canvas/elements/connection.js
// ============================================

/**
 * Handles SVG-based seat connection logic.
 *
 * Responsibilities:
 * - Create and manage SVG bezier connection paths
 * - Handle pointer-based interactive connection drawing
 * - Render and position delete buttons on connections
 * - Provide programmatic seat connection API
 */

import { state, CONNECTION_DELETE_BTN_SIZE } from '../../state.js';
import { DOM } from '../../dom.js';
import { throttled } from '../../raf-throttle.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

const SVG_NS = 'http://www.w3.org/2000/svg';

// ============================================
// ID HELPERS
// ============================================

/**
 * Creates a stable pair ID for two seat IDs.
 * Ensures consistent ordering independent of input order.
 *
 * @param {string} a - First seat ID.
 * @param {string} b - Second seat ID.
 * @returns {string} Deterministic pair ID.
 */
export function makePairId(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Splits a pair string back into seat IDs.
 *
 * @param {string} pairString - Pair ID string.
 * @returns {{a: string, b: string}} Extracted IDs.
 */
export function splitPairString(pairString) {
    const [a, b] = pairString.split('-');
    return { a, b };
}

// ============================================
// SVG PATH CREATION
// ============================================

/**
 * Creates a styled SVG path element for connections.
 *
 * @returns {SVGPathElement} Configured SVG path.
 */
function createConnectionPath() {
    const path = document.createElementNS(SVG_NS, 'path');

    path.setAttribute('stroke', 'rgba(0,0,0,0.6)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '6 4');
    path.setAttribute('fill', 'none');

    // Prevent path from blocking pointer interaction
    path.style.pointerEvents = 'none';

    return path;
}

// ============================================
// DELETE BUTTON HANDLING
// ============================================

/**
 * Adds a clickable delete button at the center of a connection path.
 * Removes connection from state and DOM on click.
 *
 * @param {HTMLElement} startSeat - Starting seat element.
 * @param {HTMLElement} endSeat - Ending seat element.
 * @param {SVGPathElement} path - Connection path.
 * @returns {SVGGElement} Delete button group.
 */
export function createDeleteButton(path, pairId) {
    const btnGroup = document.createElementNS(SVG_NS, 'g');
    btnGroup.style.cursor = 'pointer';

    const line1 = document.createElementNS(SVG_NS, 'line');
    const line2 = document.createElementNS(SVG_NS, 'line');

    [line1, line2].forEach(line => {
        line.setAttribute('stroke', 'red');
        line.setAttribute('stroke-width', '2');
        line.setAttribute('pointer-events', 'all');
        btnGroup.appendChild(line);
    });

    DOM.svgConnectionLayer.appendChild(btnGroup);

    btnGroup.addEventListener('click', () => {
        removeConnection(pairId);
    });

    _updateDeleteButtonPosition(path, btnGroup);

    return btnGroup;
}

/**
 * Positions the delete button at the midpoint of a path.
 *
 * @param {SVGPathElement} pathEl - Connection path.
 * @param {SVGGElement} btnGroup - Delete button group.
 */
function _updateDeleteButtonPosition(pathEl, btnGroup) {
    const pathLength = pathEl.getTotalLength();
    const mid = pathEl.getPointAtLength(pathLength / 2);

    const size = CONNECTION_DELETE_BTN_SIZE;
    const lines = btnGroup.querySelectorAll('line');

    // "\" line
    lines[0].setAttribute('x1', mid.x - size);
    lines[0].setAttribute('y1', mid.y - size);
    lines[0].setAttribute('x2', mid.x + size);
    lines[0].setAttribute('y2', mid.y + size);

    // "/" line
    lines[1].setAttribute('x1', mid.x - size);
    lines[1].setAttribute('y1', mid.y + size);
    lines[1].setAttribute('x2', mid.x + size);
    lines[1].setAttribute('y2', mid.y - size);
}

function removeConnection(pairId) {
    const index = state.fixedConnections.findIndex(c => c.pairId === pairId);
    if (index === -1) return;

    const connection = state.fixedConnections[index];

    connection.path.remove();
    connection.deleteBtn?.remove();

    state.fixedConnections.splice(index, 1);
    state.seatConnectionSet.delete(pairId);
}

// ============================================
// CONNECTION UPDATES
// ============================================

/**
 * Updates all fixed connections including delete button positions.
 */
export function updateAllConnections() {
    state.fixedConnections.forEach(conn => {
        updateConnectionFixed(conn.startConnector, conn.endConnector, conn.path);

        if (conn.deleteBtn) {
            _updateDeleteButtonPosition(conn.path, conn.deleteBtn);
        }
    });
}

// ============================================
// SVG COORDINATE HELPERS
// ============================================

/**
 * Converts client coordinates to SVG coordinates.
 *
 * @param {SVGSVGElement} svg - Target SVG.
 * @param {number} clientX - Mouse X.
 * @param {number} clientY - Mouse Y.
 * @returns {DOMPoint} Transformed SVG point.
 */
function _clientToSVG(svg, clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;

    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/**
 * Calculates the center of a connector element in SVG space.
 *
 * @param {HTMLElement} connectorEl - Connector element.
 * @returns {DOMPoint} Center point in SVG coordinates.
 */
function _connectorCenter(connectorEl) {
    const rect = connectorEl.getBoundingClientRect();

    return _clientToSVG(
        DOM.svgConnectionLayer,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
    );
}

// ============================================
// BEZIER PATH BUILDING
// ============================================

/**
 * Builds a smooth bezier path between two points.
 * Adds curvature compensation for very short distances.
 *
 * @param {number} x1 - Start X.
 * @param {number} y1 - Start Y.
 * @param {number} x2 - End X.
 * @param {number} y2 - End Y.
 * @returns {string} SVG path definition.
 */
function buildBezierPath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    // Handle short distances with slight arc
    if (Math.abs(dx) < 20 || Math.abs(dy) < 20) {
        const dist = Math.hypot(dx, dy);
        const arcHeight = dist * 0.1;

        const vertical = Math.abs(dx) < Math.abs(dy);
        const nx = vertical ? 1 : 0;
        const ny = vertical ? 0 : -1;

        const cx1 = x1 + dx * 0.25 + nx * arcHeight;
        const cy1 = y1 + dy * 0.25 + ny * arcHeight;
        const cx2 = x1 + dx * 0.75 + nx * arcHeight;
        const cy2 = y1 + dy * 0.75 + ny * arcHeight;

        return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
    }

    const cx1 = x1 + dx * 0.25;
    const cy1 = y1;
    const cx2 = x1 + dx * 0.75;
    const cy2 = y2;

    return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

// ============================================
// PATH UPDATE LOGIC
// ============================================

/**
 * Updates a connection dynamically during pointer movement.
 *
 * @param {HTMLElement} startEl - Start connector.
 * @param {number} mouseX - Pointer X.
 * @param {number} mouseY - Pointer Y.
 * @param {SVGPathElement} pathEl - Path element.
 */
function updateConnectionDynamic(startEl, mouseX, mouseY, pathEl) {
    const start = _connectorCenter(startEl);
    const end = _clientToSVG(DOM.svgConnectionLayer, mouseX, mouseY);

    pathEl.setAttribute('d', buildBezierPath(start.x, start.y, end.x, end.y));
}

/**
 * Updates a fixed connection between two connectors.
 *
 * @param {HTMLElement} startEl - Start connector.
 * @param {HTMLElement} endEl - End connector.
 * @param {SVGPathElement} pathEl - Path element.
 */
function updateConnectionFixed(startEl, endEl, pathEl) {
    const start = _connectorCenter(startEl);
    const end = _connectorCenter(endEl);

    pathEl.setAttribute('d', buildBezierPath(start.x, start.y, end.x, end.y));
}

function createFixedConnection(startSeat, endSeat) {
    const pairId = makePairId(startSeat.id, endSeat.id);
    if (state.seatConnectionSet.has(pairId)) return null;

    const connectorA = startSeat.querySelector('.connector');
    const connectorB = endSeat.querySelector('.connector');
    if (!connectorA || !connectorB) return null;

    const path = createConnectionPath();
    DOM.svgConnectionLayer.appendChild(path);

    updateConnectionFixed(connectorA, connectorB, path);

    const deleteBtn = createDeleteButton(path, pairId);

    const connection = {
        startConnector: connectorA,
        endConnector: connectorB,
        path,
        pairId,
        deleteBtn
    };

    state.seatConnectionSet.add(pairId);
    state.fixedConnections.push(connection);

    return connection;
}

// ============================================
// PUBLIC HANDLER
// ============================================

/**
 * Attaches pointer listener to a seat connector element.
 *
 * @param {HTMLElement} element - Seat element containing connector.
 */
export function attachConnectorListener(element) {
    const connector = element.querySelector('.connector');
    connector.addEventListener('pointerdown', _connectorPointerDown);
}

/**
 * Handles pointer down on connector and initiates drag connection.
 *
 * @param {PointerEvent} e - Pointer event.
 */
function _connectorPointerDown(e) {
    e.stopPropagation();

    const path = createConnectionPath();
    DOM.svgConnectionLayer.appendChild(path);

    const startConnector = e.currentTarget;
    const startSeat = startConnector.closest('.seat');

    state.currentConnection = { path, startConnector };

    updateConnectionDynamic(startConnector, e.clientX, e.clientY, path);

    function moveHandler(ev) {
        // Throttle updates to reduce layout recalculation
        throttled(() =>
            updateConnectionDynamic(startConnector, ev.clientX, ev.clientY, path)
        );
    }

    function upHandler(ev) {
        document.removeEventListener('pointermove', moveHandler);
        document.removeEventListener('pointerup', upHandler);

        const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
        const endConnector = elements.find(el => el.classList?.contains('connector')) ?? null;
        const endSeat = endConnector?.closest('.seat') ?? null;

        if (endConnector && endConnector !== startConnector && endSeat && endSeat !== startSeat) {
            // valid connection
            createFixedConnection(startSeat, endSeat);
        }
        path.remove(); // remove temp path

        state.currentConnection = null;
    }

    document.addEventListener('pointermove', moveHandler);
    document.addEventListener('pointerup', upHandler);
}

// ============================================
// PROGRAMMATIC API
// ============================================

/**
 * Connects two seats programmatically.
 *
 * @param {HTMLElement} seatA - First seat.
 * @param {HTMLElement} seatB - Second seat.
 */
export function connectSeats(seatA, seatB) {
    if (!seatA || !seatB || seatA === seatB) return;
    createFixedConnection(seatA, seatB);
}