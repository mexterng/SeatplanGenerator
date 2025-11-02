let seats = [];
const personDelimiter = ";"
const nameDelimiter = ","

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

function rotateSeat(seat, rotationAngle) {
    const canvas = document.getElementById('canvas');
    const currentTransform = seat.style.transform || "rotate(0deg)";
    const currentAngle = parseFloat(currentTransform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
    const newAngle = currentAngle + rotationAngle;
    seat.style.transform = `rotate(${newAngle}deg)`;

    // Ensure seat stays fully inside canvas
    const rect = seat.getBoundingClientRect();
    const parentRect = canvas.getBoundingClientRect();
    const newX = rect.left - parentRect.left;
    const newY = rect.top - parentRect.top;

    const { x: correctedX, y: correctedY } = keepInsideCanvas(seat, newX, newY, canvas);
    seat.style.left = correctedX + "px";
    seat.style.top = correctedY + "px";
}

// Create single seat element
async function createSeatElement(x, y, rotate, canvas, seatCountElement) {
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
        await createSeatElement(currentX + 19.1, currentY + 19.1, currentAngle, canvas, seatCountElement);
        seatCountElement.value = Number(seatCountElement.value) + 1;
    });

    // Rotate button event
    rotationAngle = 15;
    seat.querySelector(".rot.left").addEventListener("click", e => {
        e.stopPropagation();
        rotateSeat(seat, rotationAngle);
    });

    seat.querySelector(".rot.right").addEventListener("click", e => {
        e.stopPropagation();
        rotateSeat(seat, -rotationAngle);
    });

    // Drag events
    seat.addEventListener('dragstart', dragStart);
    seat.addEventListener('dragend', dragEnd);

    // Append seat to canvas and register it
    canvas.appendChild(seat);
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
        await createSeatElement(x, y, 0, canvas, seatCountElement);
        x += seatWidth + gap;
    }
}

// Drag & drop handling
let currentDrag = null;
let startX = 0;
let startY = 0;
let offsetX = 0;
let offsetY = 0;

function dragStart(e) {
    // Check if seat was clicked
    if (e.target.classList.contains('seat')) {
        currentDrag = e.target;

        // Remember offset inside the seat
        const rect = currentDrag.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        startX = e.clientX;
        startY = e.clientY;

        // Bind pointer events
        document.addEventListener('pointermove', dragMove);
        document.addEventListener('pointerup', dragEnd);

        e.preventDefault();
    }
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

// Save seats to localStorage
function saveSeats(alertmessage = true) {
    const seatData = seats.map(t => {
        const transform = t.element.style.transform || 'rotate(0deg)';
        const match = transform.match(/rotate\(([-\d.]+)deg\)/);
        const rotation = match ? parseFloat(match[1]) : 0;

        return {
            x: parseInt(t.element.style.left) || 0,
            y: parseInt(t.element.style.top) || 0,
            rotate: rotation
        };
    });
    localStorage.setItem('seats', JSON.stringify(seatData));
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

// Load seats and names from localStorage
async function loadData() {
    const seatData = JSON.parse(localStorage.getItem('seats'));
    const nameList = JSON.parse(localStorage.getItem('names'));
    const canvas = document.getElementById('canvas');
    const seatCountElement = document.getElementById('seatCount');
    if (seatData){
        document.getElementById('seatCount').value = seatData.length;
    }
    document.getElementById('namesInput').value = nameList;

    if (seatData) {
        canvas.innerHTML = '';
        seats = [];
        for(const t of seatData) {
            await createSeatElement(t.x, t.y, t.rotate, canvas, seatCountElement);
        };
    }

    if (nameList) {
        document.getElementById('namesInput').value = nameList.join(personDelimiter + ' ');
    }
}

// Split fullname to lastname, firstname
function getNames(fullname) {
    const [lastname, firstname] = fullname.includes(nameDelimiter)
        ? fullname.split(nameDelimiter).map(n => n.trim())
        : ["", fullname];
    
    return { lastname, firstname };
}

// Parse input string of names
function parseNames(namesInput) {
    let nameList = [];
    const inputSplit = namesInput.split(personDelimiter).map(n => n.trim()).filter(Boolean);
    inputSplit.forEach((item) => {
        nameList.push(getNames(item));
    });
    return nameList;
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
function assignNames(shuffle = true) {
    const nameList = parseNames(document.getElementById('namesInput').value);
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
        fullNameList.push(getNames('')); // empty names for free seats
    }

    let shuffledNames = fullNameList;
    if (shuffle) {
        shuffledNames = shuffleArray(fullNameList);
    }
    seats.forEach((s, i) => {
        s.element.querySelector('.seat-firstname').textContent = shuffledNames[i]['firstname'];
        s.element.querySelector('.seat-lastname').textContent = shuffledNames[i]['lastname'];
    });
}