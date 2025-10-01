let seats = [];

// Get seat size from CSS
function getSeatSize() {
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
function createSeatElement(x, y, canvas, seatCountElement) {
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.style.left = x + 'px';
    seat.style.top = y + 'px';
    seat.draggable = true;

    // Delete button
    const delSpan = document.createElement('span');
    delSpan.className = 'del';
    delSpan.textContent = '×';
    delSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        canvas.removeChild(seat);
        seats = seats.filter(t => t.element !== seat);
        seatCountElement.value = seatCountElement.value - 1;
    });
    seat.appendChild(delSpan);

    // Name container
    const nameDiv = document.createElement('div');
    nameDiv.className = 'seat-name';
    nameDiv.style.pointerEvents = 'none';
    seat.appendChild(nameDiv);

    // Drag events
    seat.addEventListener('dragstart', dragStart);
    seat.addEventListener('dragend', dragEnd);

    canvas.appendChild(seat);
    seats.push({ element: seat, x: x, y: y });
}

// Create multiple seats
function createSeats() {
    const canvas = document.getElementById('canvas');
    const seatCountElement = document.getElementById('seatCount');
    const canvasWidth = canvas.clientWidth;
    canvas.innerHTML = '';
    seats = [];
    const count = parseInt(seatCountElement.value);
    const gap = 20;

    const { width: seatWidth, height: seatHeight } = getSeatSize();

    let x = gap;
    let y = gap;

    for (let i = 0; i < count; i++) {
        if (x + seatWidth > canvasWidth) {
            x = gap;
            y += seatHeight + gap;
        }
        createSeatElement(x, y, canvas, seatCountElement);
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
    const nameList = document.getElementById('namesInput').value.split(',').map(n => n.trim());
    localStorage.setItem('names', JSON.stringify(nameList));
    if (alertmessage){
        alert('Namen gespeichert!');
    }
}

// Load seats and names from localStorage
function loadData() {
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
        seatData.forEach(t => {
            createSeatElement(t.x, t.y, canvas, seatCountElement);
        });
    }

    if (nameList) {
        document.getElementById('namesInput').value = nameList.join(', ');
    }
}

// Assign random names to seats
function assignNames() {
    const nameList = document.getElementById('namesInput').value.split(',').map(n => n.trim());
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
        const extra = nameList.length - seats.length; // Anzahl der Personen, die keinen Sitzplatz bekommen
        alert(`Achtung: Es fehlen ${extra} Sitzplätze.`);
        return;
    }

    const fullNameList = [...nameList];
    while (fullNameList.length < seats.length) {
        fullNameList.push(''); // leere Namen für freie Sitzplätze
    }

    const shuffledNames = [...fullNameList].sort(() => Math.random() - 0.5);
    seats.forEach((s, i) => {
        const nameDiv = s.element.querySelector('.seat-name');
        nameDiv.textContent = shuffledNames[i];
    });
}