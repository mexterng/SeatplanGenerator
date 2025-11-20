let seats = [];
const personDelimiter = ";"
const nameDelimiter = ","

const advancedToggle = document.getElementById('advanced-toggle');
const advancedControls = document.getElementById('advanced-controls');
// Status beim Laden wiederherstellen
window.addEventListener('DOMContentLoaded', () => {
    const delimiters = {
        person: personDelimiter,
        name: nameDelimiter
    };
    localStorage.setItem('delimiter', JSON.stringify(delimiters));
    loadData();
    const saved = localStorage.getItem('advancedMode') === 'true';
    advancedToggle.checked = saved;
    advancedControls.style.display = saved ? 'block' : 'none';
    const countdown = localStorage.getItem('countdown') === 'true';
    document.getElementById('countdown-checkbox').checked = countdown;
});

// Status speichern, wenn Switch geändert wird
advancedToggle.addEventListener('change', () => {
    advancedControls.style.display = advancedToggle.checked ? 'block' : 'none';
    localStorage.setItem('advancedMode', advancedToggle.checked);
});

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
}

// Create single seat element
async function createSeatElement(x, y, rotate, canvas) {
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

    const seatCountElement = document.getElementById('seatCount');

    // Delete button event
    seat.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();
        canvas.removeChild(seat);
        seats = seats.filter(t => t.element !== seat);
        seatCountElement.value = seatCountElement.value - 1;
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
    seats.push({ element: seat, x: x, y: y, rotate: rotate });
}

// Create multiple seats
async function createSeats() {
    const canvas = document.getElementById('canvas');
    const seatCountElement = document.getElementById('seatCount');
    const canvasWidth = canvas.clientWidth;
    const { width: seatWidth, height: seatHeight } = await getSeatSize();
    canvas.innerHTML = '';
    seats = [];
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

// Drag & drop handling
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
}

function dragEnd() {
    // Reset drag state
    currentDrag = null;

    // Unbind pointer events
    document.removeEventListener('pointermove', dragMove);
    document.removeEventListener('pointerup', dragEnd);
}

function getSeatData(){
    return seats.map(t => {
        const transform = t.element.style.transform || 'rotate(0deg)';
        const match = transform.match(/rotate\(([-\d.]+)deg\)/);
        const rotation = match ? parseFloat(match[1]) : 0;

        return {
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

// Save seats to localStorage
function saveSeats(alertmessage = true) {
    const seatData = getSeatData();
    const fixedData = getFixedData();
    localStorage.setItem('seats', JSON.stringify(seatData));
    localStorage.setItem('fixed', JSON.stringify(fixedData));
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
            await createSeatElement(t.x, t.y, t.rotate, canvas);
        };
        document.getElementById('seatCount').value = seatData.length;
    }

    if (nameList) {
        document.getElementById('namesInput').value = nameList.join(personDelimiter + ' ');
    }
}

function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]]; // swap elements
    }
    return result;
}

// Assign random names to seats
async function assignNames(shuffle = true) {
    document.getElementById('clear-seats').style.display = "inline";
    const nameList = parseNames(document.getElementById('namesInput').value, personDelimiter, nameDelimiter);
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
        fullNameList.push(getNames('', nameDelimiter)); // empty names for free seats
    }

    let shuffledNames = fullNameList;
    if (shuffle) {
        shuffledNames = shuffleArray(fullNameList);
    }

    if (document.getElementById('countdown-checkbox').checked) {
        await showCountdown(5);
    }
    seats.forEach((s, i) => {
        s.element.querySelector('.seat-firstname').textContent = shuffledNames[i]['firstname'];
        s.element.querySelector('.seat-lastname').textContent = shuffledNames[i]['lastname'];
    });
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

// ===============================
// nameEditor
// ===============================
document.getElementById('edit-icon').addEventListener('click', () => {
    localStorage.setItem('namesStr', document.getElementById('namesInput').value);
    window.open('nameEditor.html', 'nameEditor', 'width=355,height=600,scrollbars=yes,resizable=yes');
});