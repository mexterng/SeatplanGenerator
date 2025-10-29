let seats = [];
const personDelimiter = ";"
const nameDelimiter = ","

// Get seat size from CSS
function getSeatSize() {
    // Seat already exist
    if (seats && seats.length > 0) {
        const seat = seats[0].element;
        return { width: seat.offsetWidth, height: seat.offsetHeight };
    }

    // Create a temporary seat to measure
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

// Create single seat element
async function createSeatElement(x, y, canvas, seatCountElement) {
    // Load CSS once
    if (!document.getElementById("seatCSS")) {
        const cssHref = "./../templates/seat.css";
        const link = document.createElement("link");
        link.id = "seatCSS";
        link.rel = "stylesheet";
        link.href = cssHref;
        document.head.appendChild(link);
    }
    // Load template once (only on first call)
    if (!window.seatTemplate) {
        const html = await fetch("./../templates/seat.html").then(r => r.text());
        const templateDiv = document.createElement("div");
        templateDiv.innerHTML = html.trim();
        window.seatTemplate = templateDiv.firstElementChild;
    }

    // Clone the template for a new seat
    const seat = window.seatTemplate.cloneNode(true);

    // Set initial position
    seat.style.left = x + 'px';
    seat.style.top = y + 'px';

    // Delete button event
    seat.querySelector(".del").addEventListener("click", e => {
        e.stopPropagation();
        canvas.removeChild(seat);
        seats = seats.filter(t => t.element !== seat);
        seatCountElement.value = seatCountElement.value - 1;
    });

    // Drag events
    seat.addEventListener('dragstart', dragStart);
    seat.addEventListener('dragend', dragEnd);

    // Append seat to canvas and register it
    canvas.appendChild(seat);
    seats.push({ element: seat, x: x, y: y });
}

// Create multiple seats
async function createSeats() {
    const canvas = document.getElementById('canvas');
    const seatCountElement = document.getElementById('seatCount');
    const canvasWidth = canvas.clientWidth;
    canvas.innerHTML = '';
    seats = [];
    const count = parseInt(seatCountElement.value);
    const gap = 10;

    const { width: seatWidth, height: seatHeight } = getSeatSize();

    let x = gap;
    let y = gap;

    for (let i = 0; i < count; i++) {
        if (x + seatWidth > canvasWidth || (i > 1 && i % 10 === 0)) {
            x = gap;
            y += seatHeight + gap;
        }
        await createSeatElement(x, y, canvas, seatCountElement);
        x += seatWidth + gap;
    }
}

// Drag & drop handling
let currentDrag = null;
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

        // Bind pointer events
        document.addEventListener('pointermove', dragMove);
        document.addEventListener('pointerup', dragEnd);

        e.preventDefault();
    }
}

function dragMove(e) {
    // Exit if nothing is dragged
    if (!currentDrag) return;

    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    const seatWidth = currentDrag.offsetWidth;
    const seatHeight = currentDrag.offsetHeight;

    // Calculate new position relative to canvas
    let newX = e.clientX - rect.left - offsetX;
    let newY = e.clientY - rect.top - offsetY;

    // Keep inside canvas
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + seatWidth > canvas.clientWidth) newX = canvas.clientWidth - seatWidth;
    if (newY + seatHeight > canvas.clientHeight) newY = canvas.clientHeight - seatHeight;

    // Snap to grid (10px)
    const gridSize = 10;
    newX = Math.round(newX / gridSize) * gridSize;
    newY = Math.round(newY / gridSize) * gridSize;

    // Apply new position
    currentDrag.style.left = newX + 'px';
    currentDrag.style.top = newY + 'px';
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
    const seatData = seats.map(t => ({x: parseInt(t.element.style.left), y: parseInt(t.element.style.top)}));
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
            await createSeatElement(t.x, t.y, canvas, seatCountElement);
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