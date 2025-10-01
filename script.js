let seats = [];

function getSeatSize() {
    // Temporäres Sitzplatz-Element erstellen, um CSS-Größe auszulesen
    const tempSeat = document.createElement('div');
    tempSeat.className = 'seat';
    tempSeat.style.position = 'absolute';
    tempSeat.style.visibility = 'hidden';
    document.body.appendChild(tempSeat);

    const width = tempSeat.offsetWidth;
    const height = tempSeat.offsetHeight;

    document.body.removeChild(tempSeat); // wieder entfernen

    return { width, height };
}

// Einzelnen Sitzplatz erstellen
function createSeatElement(x, y, canvas, seatCountElement) {
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.style.left = x + 'px';
    seat.style.top = y + 'px';
    seat.draggable = true;

    // X zum Löschen
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
    const nameDiv = document.createElement('div');
    nameDiv.className = 'seat-name';
    nameDiv.style.pointerEvents = 'none'; // verhindert Drag-Konflikte
    seat.appendChild(nameDiv);

    // Drag & Drop Events
    seat.addEventListener('dragstart', dragStart);
    seat.addEventListener('dragend', dragEnd);

    canvas.appendChild(seat);
    seats.push({ element: seat, x: x, y: y });
}

// Sitzplätze erstellen
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

// Drag & Drop
let currentDrag = null;
function dragStart(e){ currentDrag = e.target; }
function dragEnd(e) {
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();

    const seatWidth = currentDrag.offsetWidth;
    const seatHeight = currentDrag.offsetHeight;

    // Neue Position relativ zum Canvas
    let newX = e.clientX - rect.left - seatWidth / 2;
    let newY = e.clientY - rect.top - seatHeight / 2;

    // Grenzen prüfen
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + seatWidth > canvas.clientWidth) newX = canvas.clientWidth - seatWidth;
    if (newY + seatHeight > canvas.clientHeight) newY = canvas.clientHeight - seatHeight;

    // Snap-to-Grid: auf 10px runden
    const gridSize = 10;
    newX = Math.round(newX / gridSize) * gridSize;
    newY = Math.round(newY / gridSize) * gridSize;

    // Position setzen
    currentDrag.style.left = newX + 'px';
    currentDrag.style.top = newY + 'px';

    currentDrag = null;
}

// Sitzplätze speichern
function saveSeats(alertmessage = true) {
    const seatData = seats.map(t => ({x: parseInt(t.element.style.left), y: parseInt(t.element.style.top)}));
    localStorage.setItem('seats', JSON.stringify(seatData));
    if (alertmessage){
        alert('Sitzplätze gespeichert!');
    }
}

// Namen speichern
function saveNames(alertmessage = true) {
    const nameList = document.getElementById('namesInput').value.split(',').map(n => n.trim());
    localStorage.setItem('names', JSON.stringify(nameList));
    if (alertmessage){
        alert('Namen gespeichert!');
    }
}

// Daten laden
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

// Namen zu Sitzplätzen zuweisen
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