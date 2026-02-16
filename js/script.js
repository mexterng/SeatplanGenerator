let seats = [];
let lastSeatID = 0;
let seatConnectionSet = new Set();
const personDelimiter = ";";
const nameDelimiter = ",";
const lockedSeatTag = "#";

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const advancedToggle = document.getElementById('advanced-toggle');
const advancedControls = document.getElementById('advanced-controls');
// Status beim Laden wiederherstellen
window.addEventListener('DOMContentLoaded', async () => {
    const delimiters = {
        person: personDelimiter,
        name: nameDelimiter,
        lockedSeat: lockedSeatTag
    };
    localStorage.setItem('delimiter', JSON.stringify(delimiters));
    const saved = localStorage.getItem('advancedMode') === 'true';
    advancedToggle.checked = saved;
    advancedControls.style.display = saved ? 'block' : 'none';
    updateAdvancedLabel(saved);
    await loadData(); // ensure all elements are created
    const countdown = localStorage.getItem('countdown') === 'true';
    document.getElementById('countdown-checkbox').checked = countdown;
    const seatNumbers = localStorage.getItem('showSeatNumbers') === 'true';
    document.getElementById('seatNumber-checkbox').checked = seatNumbers;
    if (seatNumbers) {
        Array.from(document.querySelectorAll('.seat-nr')).forEach(seatNr => {
            seatNr.style.visibility = 'visible';
        });
    }

    const seatConnectors = localStorage.getItem('showSeatConnectors') === 'true';
    document.getElementById('seatConnector-checkbox').checked = seatConnectors;
    const canvas = document.getElementById('canvas');
    if (seatConnectors) {
        canvas.classList.add('show-seat-connectors');
        document.getElementById('connection-layer').style.visibility = 'visible';
    }
});

// Recalculate all connections on window resize
window.addEventListener('resize', () => {
    updateAllConnections();
});

// Status speichern, wenn Switch geändert wird
advancedToggle.addEventListener('change', () => {
    advancedControls.style.display = advancedToggle.checked ? 'block' : 'none';
    updateAdvancedLabel(advancedToggle.checked);
    localStorage.setItem('advancedMode', advancedToggle.checked);
});

function updateAdvancedLabel(state) {
    const icon = state ? 'fa-minus' : 'fa-plus';
    document.getElementById('advanced-toggle-label').innerHTML = `<i class="fa-solid ${icon}"></i>`;
}

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

// Get seat size from CSS
async function getFixedSize(type) {
    // Create a temporary fixed element to measure
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

// Get seat size from CSS
async function getSeatSize() {
    // Seat already exist
    if (seats && seats.length > 0) {
        const seat = seats[0].element;
        return { width: seat.offsetWidth, height: seat.offsetHeight };
    }

    // Create a temporary seat to measure
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

function guaranteeCanvasBoundaries(x, y, elementWidth, elementHeight, canvas) {
  // Get canvas boundaries
  const canvasWidth = canvas.clientWidth;
  const canvasHeight = canvas.clientHeight;

  // Clamp the coordinates so they stay within the canvas area
  x = Math.max(0, Math.min(x, canvasWidth - elementWidth));
  y = Math.max(0, Math.min(y, canvasHeight - elementHeight));

  return { x, y };
}

function rotateElement(element, rotationAngle) {
    const canvas = document.getElementById('canvas');
    const currentTransform = element.style.transform || "rotate(0deg)";
    const currentAngle = parseFloat(currentTransform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
    const newAngle = currentAngle + rotationAngle;
    element.style.transform = `rotate(${newAngle}deg)`;

    // Ensure seat stays fully inside canvas
    const { x: correctedX, y: correctedY } = keepInsideCanvas(element, parseFloat(element.style.left), parseFloat(element.style.top), canvas);
    element.style.left = correctedX + "px";
    element.style.top = correctedY + "px";

    // Update connections
    updateAllConnections();
}

// Create single seat element
async function createSeatElement(x, y, rotate, canvas, id) {
    await loadSeatTemplateFiles();
    // Clone the template for a new seat
    const seat = window.seatTemplate.cloneNode(true);

    // Clamp coordinates to stay inside the canvas
    const { width: seatWidth, height: seatHeight } = await getSeatSize();
    ({x, y} = guaranteeCanvasBoundaries(x, y, seatWidth, seatHeight, canvas));

    // Set initial position
    seat.style.left = x + 'px';
    seat.style.top = y + 'px';
    seat.style.transform = `rotate(${rotate}deg)`;

    // Set id
    seat.id = ++ lastSeatID;
    if (id) {
        seat.id = id;
        if (id >= lastSeatID) lastSeatID = id;
    }

    const seatCountElement = document.getElementById('seatCount');

    // Delete button event
    seat.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();

        // Remove all connections related to this seat
        fixedConnections
            .filter(c => c.startConnector.closest('.seat') === seat || c.endConnector.closest('.seat') === seat)
            .forEach(c => {
                c.path.remove();       // remove SVG path
                if (c.deleteBtn) c.deleteBtn.remove(); // remove delete button
                seatConnectionSet.delete(c.pairId);   // remove from set
            });

        // Remove the seat
        canvas.removeChild(seat);
        seats = seats.filter(t => t.element !== seat);
        seatCountElement.value = seatCountElement.value - 1;
        updateSeatNumbers();
    });

    // Add button event
    seat.querySelector(".add").addEventListener("click", async e => {
        e.stopPropagation();
        const rect = seat.getBoundingClientRect();
        const parentRect = canvas.getBoundingClientRect();
        const currentX = rect.left - parentRect.left;
        const currentY = rect.top - parentRect.top;
        const currentTransform = seat.style.transform || "rotate(0deg)";
        const currentAngle = parseFloat(currentTransform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
        await createSeatElement(currentX + 19.1, currentY + 19.1, currentAngle, canvas);
    });

    // Rotate button event
    rotationAngle = 15;
    seat.querySelector(".rot.left").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(seat, rotationAngle);
    });

    seat.querySelector(".rot.right").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(seat, -rotationAngle);
    });

    // Drag events
    seat.addEventListener('dragstart', dragStart);
    seat.addEventListener('dragend', dragEnd);

    // Append seat to canvas and register it
    canvas.appendChild(seat);
    seatCountElement.value = Number(seatCountElement.value) + 1;
    updateSeatNumbers();
    attachConnectorListener(seat);
    seats.push({ element: seat, id: seat.id, x: x, y: y, rotate: rotate });
}

// Create multiple seats
async function createSeats() {
    const canvas = document.getElementById('canvas');
    const seatCountElement = document.getElementById('seatCount');
    const canvasWidth = canvas.clientWidth;
    const { width: seatWidth, height: seatHeight } = await getSeatSize();
    canvas.innerHTML = '';
    seats = [];
    lastSeatID = 0;
    const count = parseInt(seatCountElement.value);
    const gap = 10;

    let x = gap;
    let y = gap;

    for (let i = 0; i < count; i++) {
        if (x + seatWidth > canvasWidth || (i > 1 && i % 10 === 0)) {
            x = gap;
            y += seatHeight + gap;
        }
        await createSeatElement(x, y, 0, canvas);
        x += seatWidth + gap;
    }
    seatCountElement.value = count;
}

// ===============================
// Drag and Drop handling 
// ===============================
let currentDrag = null;
let startX = 0;
let startY = 0;
let offsetX = 0;
let offsetY = 0;

function dragStart(e) {
    const dragElement = e.target.closest('.drag-element');
    if (!dragElement) return;

    currentDrag = dragElement;
    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    const style = window.getComputedStyle(dragElement);
    const matrix = new DOMMatrix(style.transform);

    const translateX = matrix.m41;
    const translateY = matrix.m42;

    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    offsetX = mouseX - (dragElement.offsetLeft + translateX);
    offsetY = mouseY - (dragElement.offsetTop + translateY);

    startX = e.clientX;
    startY = e.clientY;

    // Bind pointer events
    document.addEventListener('pointermove', dragMove);
    document.addEventListener('pointerup', dragEnd);

    e.preventDefault();
}

function keepInsideCanvas(currentDrag, newX, newY, canvas) {
    const seatWidth = currentDrag.offsetWidth;
    const seatHeight = currentDrag.offsetHeight;

    // Current rotation angle (in radians)
    const transform = window.getComputedStyle(currentDrag).transform;
    let angle = 0;
    if (transform && transform !== 'none') {
        const matrix = new DOMMatrix(transform);
        angle = Math.atan2(matrix.b, matrix.a); // in Radiant
    }

    // Corner points relative to the center
    const cx = seatWidth / 2;
    const cy = seatHeight / 2;
    const corners = [
        { x: -cx, y: -cy },
        { x:  cx, y: -cy },
        { x: -cx, y:  cy },
        { x:  cx, y:  cy },
    ];

    // Apply rotation
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

    // Constraint: all corners must remain inside the canvas
    const canvasW = canvas.clientWidth;
    const canvasH = canvas.clientHeight;

    // Correction if beyond boundary
    let correctedX = newX;
    let correctedY = newY;

    if (minX < 0) correctedX += -minX;
    if (minY < 0) correctedY += -minY;
    if (maxX > canvasW) correctedX -= (maxX - canvasW);
    if (maxY > canvasH) correctedY -= (maxY - canvasH);
    
    return { x: correctedX, y: correctedY };
}

function dragMove(e) {
    // Exit if nothing is dragged
    if (!currentDrag) return;

    const canvas = document.getElementById('canvas');
    const canvasRect = canvas.getBoundingClientRect();

    // Calculate new position relative to canvas
    let newX = e.clientX - canvasRect.left - offsetX;
    let newY = e.clientY - canvasRect.top - offsetY;

    let { x: correctedX, y: correctedY } = keepInsideCanvas(currentDrag, newX, newY, canvas);


    // Snap to grid (5px)
    const gridSize = 5;
    correctedX = Math.round(correctedX / gridSize) * gridSize;
    correctedY = Math.round(correctedY / gridSize) * gridSize;

    // Apply new position
    currentDrag.style.left = correctedX + 'px';
    currentDrag.style.top = correctedY + 'px';

    // Update connections
    updateAllConnections();
}

function dragEnd() {
    // Reset drag state
    currentDrag = null;

    // Unbind pointer events
    document.removeEventListener('pointermove', dragMove);
    document.removeEventListener('pointerup', dragEnd);
}

let dragBlockedSeat = null;
// cancel dragging if click on non-drag-element
document.addEventListener('mousedown', e => {
    const seat = e.target.closest('.drag-element');
    if (!seat) return;
    if (e.target.closest('.non-drag-element')) {
        seat.dataset.dragBlocked = "1";
        seat.draggable = false;
        dragBlockedSeat = seat; // store reference
    }
});

document.addEventListener('mouseup', e => {
    if (!dragBlockedSeat) return;

    dragBlockedSeat.draggable = true;
    delete dragBlockedSeat.dataset.dragBlocked;
    dragBlockedSeat = null; // reset reference
});

function getMousePosInSVG(svg, evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function getSeatData(){
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

function getFixedData(){
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

function getSeatConnectionsData(){
    return [...seatConnectionSet];
}

// Save seats to localStorage
function saveSeats(alertmessage = true) {
    localStorage.setItem('seats', JSON.stringify(getSeatData()));
    localStorage.setItem('fixed', JSON.stringify(getFixedData()));
    localStorage.setItem('connections', JSON.stringify(getSeatConnectionsData()));
    if (alertmessage){
        alert('Sitzplätze gespeichert!');
    }
}

// Save names to localStorage
function saveNames(alertmessage = true) {
    const nameList = document.getElementById('namesInput').value.split(personDelimiter).map(n => n.trim());
    localStorage.setItem('names', JSON.stringify(nameList));
    if (alertmessage){
        alert('Namen gespeichert!');
    }
}

// Delete local storage
function deleteLocalStorage(){
    localStorage.removeItem('seats');
    localStorage.removeItem('fixed');
    localStorage.removeItem('names');
}

// Load seats and names from localStorage
async function loadData() {
    const seatData = JSON.parse(localStorage.getItem('seats'));
    const fixedData = JSON.parse(localStorage.getItem('fixed'));
    const connectionsData = JSON.parse(localStorage.getItem('connections'));
    const nameList = JSON.parse(localStorage.getItem('names'));
    const canvas = document.getElementById('canvas');

    document.getElementById('namesInput').value = nameList;
    
    canvas.innerHTML = '';

    if (fixedData) {
        for(const t of fixedData) {
            await createFixedElement(t.type, t.x, t.y, t.rotate, canvas);
        };
    }

    if (seatData) {
        seats = [];
        for(const t of seatData) {
            await createSeatElement(t.x, t.y, t.rotate, canvas, t.id);
        };
        document.getElementById('seatCount').value = seatData.length;
    }

    if (connectionsData) {
        for(const connection of connectionsData) {
            const {a,b} = splitPairString(connection);
            const seatElementA = document.getElementById(a);
            const seatElementB = document.getElementById(b);
            connectSeats(seatElementA, seatElementB);
        }
    }

    if (nameList) {
        document.getElementById('namesInput').value = nameList.join(personDelimiter + ' ');
    }
}

sidebarToggle.addEventListener("click", toggleSidebar);

function toggleSidebar() {
    let isCollapsed = sidebar.classList.contains('closed');
    if (isCollapsed) {
        sidebar.classList.remove("closed");
        sidebarToggle.classList.replace("fa-chevron-right", "fa-chevron-left");
    } else {
        sidebar.classList.add("closed");
        sidebarToggle.classList.replace("fa-chevron-left", "fa-chevron-right");
    }
}

function shuffleNameswithoutPairs(array) {
    const result = [...array];
    const freeItems = result.filter(item => !item.lockedSeat);
    for (let i = freeItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [freeItems[i], freeItems[j]] = [freeItems[j], freeItems[i]]; // swap elements
    }
    
    // Place free items back to next free seat positions
    let freeIdx = 0;
    result.forEach((item, i) => {
        if (!item.lockedSeat) result[i] = freeItems[freeIdx++];
    });
    return result;
}

// Assign random names to seats
async function assignNames(shuffle = true) {
    document.getElementById('clear-seats').style.display = "inline";
    const nameListNested = parseNames(document.getElementById('namesInput').value, personDelimiter, nameDelimiter, lockedSeatTag);
    const nameList = nameListNested.flatMap(flattenNames);
    if(nameList[0] === "" || seats.length === 0){
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

    const fullNameList = [...nameList];
    while (fullNameList.length < seats.length) {
        fullNameList.push(getNames('', nameDelimiter, lockedSeatTag)); // empty names for free seats
    }

    let shuffledNames = fullNameList;
    if (shuffle) {
        if (!nameListNested.some(item => Array.isArray(item))) {
            // no seat neighbors are set in name string
            shuffledNames = shuffleNameswithoutPairs(fullNameList);
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
}

function getNormalizedSeatConnectionSet(){
    function getAllSeatIDs(){
        const ids = [];
        seats.forEach(seat => {
            ids.push(seat.id);
        });
        return ids;
    }
    function normalizeSeatConnectionSet(seatConnectionSet, seatIDs){
        // 1. Sort ids and create mapping
        const sortedIds = [...seatIDs].sort((a, b) => Number(a) - Number(b));
        const idMap = {};
        sortedIds.forEach((id, index) => {
            idMap[id] = (index + 1).toString(); // assign new normalized id
        });

        // convert set to array before mapping
        const edgeArray = Array.from(seatConnectionSet);

        const normalizedEdges = edgeArray.map(edge => {
            const [a, b] = edge.split('-'); // old ids
            const newA = idMap[a];
            const newB = idMap[b];
            return [newA, newB]; // numeric pair
        });

        return normalizedEdges;
    }

    const ids = getAllSeatIDs();
    const normalizedSeatConnectionSet = normalizeSeatConnectionSet(seatConnectionSet, ids);

    return normalizedSeatConnectionSet;

}

async function showCountdown(time){
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

function clearSeats(){
    seats.forEach((s) => {
        s.element.querySelector('.seat-firstname').textContent = "";
        s.element.querySelector('.seat-lastname').textContent = "";
    });
    document.getElementById('clear-seats').style.display = "none";
}

// Fixed Elements
// Create single fixed element
async function createFixedElement(type, x, y, rotate, canvas) {
    await loadFixedTemplateFiles();
    // Clone the template for a new fixed
    const fixedElem = window.fixedTemplate.cloneNode(true);

    // Clamp coordinates to stay inside the canvas
    const { width, height } = await getFixedSize(type);
    ({x, y} = guaranteeCanvasBoundaries(x, y, width, height, canvas));

    // Set initial position
    const types = {
        desk: 'Pult',
        board: 'Tafel',
        door: 'Tür',
        window: 'Fenster'
    };

    const name = types[type] || 'Unbekannt';
    fixedElem.querySelector('#fixed-name').textContent = name;
    fixedElem.classList.add(type)
    fixedElem.style.left = x + 'px';
    fixedElem.style.top = y + 'px';
    fixedElem.style.transform = `rotate(${rotate}deg)`;

    // Delete button event
    fixedElem.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();
        canvas.removeChild(fixedElem);
    });

    // Add button event
    fixedElem.querySelector(".add").addEventListener("click", async e => {
        e.stopPropagation();
        const rect = fixedElem.getBoundingClientRect();
        const parentRect = canvas.getBoundingClientRect();
        const currentX = rect.left - parentRect.left;
        const currentY = rect.top - parentRect.top;
        const currentTransform = fixedElem.style.transform || "rotate(0deg)";
        const currentAngle = parseFloat(currentTransform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
        await createFixedElement(type, currentX + 19.1, currentY + 19.1, currentAngle, canvas);
    });

    // Rotate button event
    rotationAngle = 15;
    fixedElem.querySelector(".rot.left").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(fixedElem, rotationAngle);
    });

    fixedElem.querySelector(".rot.right").addEventListener("click", e => {
        e.stopPropagation();
        rotateElement(fixedElem, -rotationAngle);
    });

    // Drag events
    fixedElem.addEventListener('dragstart', dragStart);
    fixedElem.addEventListener('dragend', dragEnd);

    // Append seat to canvas and register it
    canvas.appendChild(fixedElem);
}

// Update numbering of seats
function updateSeatNumbers() {
    document.querySelectorAll(".seat-nr").forEach((seatNr, idx) => {
        seatNr.textContent = idx + 1;
        if (document.getElementById('seatNumber-checkbox').checked) {
            seatNr.style.visibility = 'visible';
        } 
    });
}

// ===============================
// nameEditor
// ===============================
document.getElementById('edit-icon').addEventListener('click', () => {
    localStorage.setItem('namesStr', document.getElementById('namesInput').value);
    window.open('nameEditor.html', 'nameEditor', 'width=550,height=600,scrollbars=yes,resizable=yes');
});

// ===============================
// connecterLines
// ===============================
let currentConnection = null;
let fixedConnections = [];

// build unique pair id
function makePairId(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function splitPairString(pairString) {
    const [a, b] = pairString.split('-');
    return {a, b};
}

// create svg path element
function createConnectionPath() {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    // styling is directly applied; could be moved to CSS class
    p.setAttribute('stroke', 'rgba(0,0,0,0.6)');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-dasharray', '6 4');
    p.setAttribute('fill', 'none');
    p.style.pointerEvents = "none";
    return p;
}

function addDeleteButtonOnConnection(startSeat, endSeat, path) {
    const svg = document.getElementById('connection-layer');

    // create group for delete X
    const btnGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    btnGroup.style.cursor = "pointer";

    // create two lines for delete X
    const line1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
    
    [line1, line2].forEach(line => {
        line.setAttribute("stroke", "red");
        line.setAttribute("stroke-width", 2);
        line.setAttribute("pointer-events", "all"); // make clickable
        btnGroup.appendChild(line);
    });

    svg.appendChild(btnGroup);

    // click removes connection
    btnGroup.addEventListener("click", () => {
        path.remove();
        btnGroup.remove();

        const pairId = makePairId(startSeat.id, endSeat.id);
        seatConnectionSet.delete(pairId);
        fixedConnections = fixedConnections.filter(c => c.pairId !== pairId);
    });

    // store delete button reference in fixedConnections
    const connObj = fixedConnections.find(c => c.path === path);
    if(connObj){
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

    // initial position
    updateDeleteButtonPosition(path, btnGroup);
    return btnGroup;
}

function updateDeleteButtonPosition(pathEl, btnGroup) {
    const pathLength = pathEl.getTotalLength();
    const midPoint = pathEl.getPointAtLength(pathLength / 2);

    const size = 4; // half size of X arms
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

// update all connections (including delete buttons)
function updateAllConnections() {
    fixedConnections.forEach(conn => {
        updateConnectionFixed(conn.startConnector, conn.endConnector, conn.path);
        if(conn.deleteBtn) {
            updateDeleteButtonPosition(conn.path, conn.deleteBtn);
        }
    });
}

// throttling with internal RAF
let rafId = null;
function throttled(fn) {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        fn();
        rafId = null;
    });
}

function connectorPointerDown(e) {
    e.stopPropagation(); // prevent seat drag
    
    const svg = document.getElementById('connection-layer');
    const path = createConnectionPath();
    svg.appendChild(path);

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

        // check valid connection
        const valid =
            endConnector &&
            endConnector !== startConnector &&
            endSeat &&
            endSeat !== startSeat;

        if (valid) {
            const pair = makePairId(startSeat.id, endSeat.id);

            if (seatConnectionSet.has(pair)) {
                // already exists → remove temp path
                path.remove();
            } else {
                // new connection
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


// calculate cubic bezier path between two points
function buildBezierPath(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    const nearStraight = Math.abs(dx) < 20 || Math.abs(dy) < 20;

    if (nearStraight) {
        // distance for proportional arc size
        const dist = Math.hypot(dx, dy);
        const arcHeight = dist * 0.1; // arc factor

        // decide arc direction (fixed)
        const vertical = Math.abs(dx) < Math.abs(dy);

        const nx = vertical ? 1 : 0;   // always right
        const ny = vertical ? 0 : -1;  // always up

        // apply arc offset to control points
        const cx1 = x1 + (dx * 0.25) + nx * arcHeight;
        const cy1 = y1 + (dy * 0.25) + ny * arcHeight;

        const cx2 = x1 + (dx * 0.75) + nx * arcHeight;
        const cy2 = y1 + (dy * 0.75) + ny * arcHeight;

        return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
    }

    // default curve
    const cx1 = x1 + (x2 - x1) * 0.25;
    const cy1 = y1;
    const cx2 = x1 + (x2 - x1) * 0.75;
    const cy2 = y2;
    return `M ${x1},${y1} C ${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
}

function updateConnectionDynamic(startEl, mouseX, mouseY, pathEl) {
    const svg = document.getElementById('connection-layer');
    const mousePos = getMousePosInSVG(svg, { clientX: mouseX, clientY: mouseY });
    
    const a = startEl.getBoundingClientRect();
    const startX = a.left + a.width / 2;
    const startY = a.top + a.height / 2;

    const startPt = svg.createSVGPoint();
    startPt.x = startX;
    startPt.y = startY;
    const start = startPt.matrixTransform(svg.getScreenCTM().inverse());

    pathEl.setAttribute("d", buildBezierPath(start.x, start.y, mousePos.x, mousePos.y));
}

function updateConnectionFixed(startEl, endEl, pathEl) {
    const svg = document.getElementById('connection-layer');

    const rectA = startEl.getBoundingClientRect();
    const rectB = endEl.getBoundingClientRect();

    const ptA = svg.createSVGPoint(); ptA.x = rectA.left + rectA.width/2; ptA.y = rectA.top + rectA.height/2;
    const ptB = svg.createSVGPoint(); ptB.x = rectB.left + rectB.width/2; ptB.y = rectB.top + rectB.height/2;

    const start = ptA.matrixTransform(svg.getScreenCTM().inverse());
    const end   = ptB.matrixTransform(svg.getScreenCTM().inverse());

    pathEl.setAttribute("d", buildBezierPath(start.x, start.y, end.x, end.y));
}

function attachConnectorListener(element) {
    element.querySelector('.connector').addEventListener('pointerdown', connectorPointerDown);
}

function connectSeats(seatA, seatB) {
    const svg = document.getElementById('connection-layer');
    const path = createConnectionPath();
    svg.appendChild(path);

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

function generateSeatAssignmentBacktracking(persons, edges, seatCount, nameDelimiter, lockedSeatTag) {

    // convert edges to 0-based pairs
    const edgePairs = edges.map(([a, b]) => [a - 1, b - 1]);

    // --- Flatten persons and assign stable IDs ---
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

    // --- Place locked seats by their seat index ---
    let index = 0
    flatPersons.forEach(p => {
        if (p.lockedSeat) {
            seats[index++] = p;
        }
    });

    // --- Shuffling helper ---
    function shuffle(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    // --- Backtracking for cluster pairs ---
    function placeCluster(idx, edgesList) {
        if (Math.random() < 0.2) {
            edgesList = shuffle(edgesList);
        }

        if (idx >= shuffledClusters.length) return true;

        const cid = shuffledClusters[idx];
        const members = shuffle(clusterMap[cid]);   // 2 persons expected
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

    // --- Try placing all clusters ---
    if (!placeCluster(0, shuffledEdges)) {
        return null; // impossible arrangement
    }

    // --- Collect remaining persons that are not placed ---
    const usedIds = new Set(seats.filter(s => s !== null).map(s => s._pid));

    const remaining = flatPersons.filter(p => !usedIds.has(p._pid));

    // --- Fill free seats with remaining persons ---
    const freeSeats = seats
        .map((s, i) => s === null ? i : null)
        .filter(i => i !== null);

    const shuffledFreeSeats = shuffle(freeSeats);

    const remainingShuffled = shuffle(remaining);
    remainingShuffled.forEach((p, i) => {
        seats[shuffledFreeSeats[i]] = p;
    });

    // --- Fill leftover seats with dummy if needed ---
    const dummyList = getNames('', nameDelimiter, lockedSeatTag);
    const dummy = dummyList[0];

    return seats.map(s => s === null ? { ...dummy } : s);
}
