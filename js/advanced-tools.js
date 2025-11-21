// ===============================
// Import / Export Funktionen
// ===============================

async function importSeats() {
    const input = document.getElementById('importFile');
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) {
            alert('Keine Datei ausgewählt (Import abgebrochen).');
            return;
        }

        try {
            const text = await file.text();
            const allData = JSON.parse(text);
            const seatData = allData['seats'];
            const fixedData = allData['fixed'];

            if (!Array.isArray(seatData) || !Array.isArray(fixedData)) {
                alert('Ungültiges Dateiformat!');
                return;
            }

            const canvas = document.getElementById('canvas');
            canvas.innerHTML = '';
            seats = [];

            for(const t of fixedData) {
                await createFixedElement(t.type, t.x, t.y, t.rotate, canvas);
            };

            document.getElementById('seatCount').value = 0;
            for (const t of seatData) {
                await createSeatElement(t.x, t.y, t.rotate, canvas, t.id);
            }

            alert('Sitzplätze erfolgreich importiert!');
        } catch (err) {
            alert('Fehler beim Import: ' + err.message);
        }
    };
}

function importNames() {
    const input = document.getElementById('importFile');
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) {
            alert('Keine Datei ausgewählt (Import abgebrochen).');
            return;
        }

        try {
            const text = await file.text();
            const namesData = JSON.parse(text);
            const namesInput = namesData['namesInput'];
            const seatNames = namesData['seat-names'];

            if (!namesData || !Array.isArray(namesData['seat-names'])) {
                alert('Ungültiges Dateiformat!');
                return;
            }
            
            document.getElementById('namesInput').value = namesInput;

            const seats = document.querySelectorAll('#canvas .seat');

            if(seats.length === 0){
                alert('Keine Sitzplätze zum Zuordnen!');
                return;
            }
            if (seatNames.length < seats.length) {
                const proceed = confirm(
                    `Achtung: Es werden nicht alle Sitzplätze besetzt werden. Es gibt ${seats.length} Sitzplätze, aber nur ${seatNames.length} Personen. Fortfahren?`
                );
                if (!proceed) return;
            }

            if (seatNames.length > seats.length) {
                const extra = seatNames.length - seats.length;
                alert(`Achtung: Es fehlen ${extra} Sitzplätze.`);
                return;
            }

            seats.forEach((seat, i) => {
                const nameObj = seatNames[i];
                if (nameObj) {
                    seat.querySelector('.seat-firstname').textContent = nameObj.firstname || '';
                    seat.querySelector('.seat-lastname').textContent = nameObj.lastname || '';
                } else {
                    seat.querySelector('.seat-firstname').textContent = '';
                    seat.querySelector('.seat-lastname').textContent = '';
                }
            });
            

            alert('Namen erfolgreich importiert!');
        } catch (err) {
            alert('Fehler beim Import: ' + err.message);
        }
    };
}

function exportJSON(data, filename){
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.json';
    a.click();
    URL.revokeObjectURL(url);
}

// Export seats as JSON
function exportSeats() {
    try {
        seatsData = collectElementsData();
        exportJSON(seatsData, "sitzplan_elements");
    } catch (err) {
        alert('Export fehlgeschlagen: ' + err.message);
    }
}

// Export names as JSON
function exportNames() {
    try{
        const namesData = collectNamesData();
        exportJSON(namesData, "sitzplan_names");
    } catch (err) {
        alert('Export fehlgeschlagen: ' + err.message);
    }
}

function collectElementsData(){
    const seatsData = getSeatData();
    const fixedData = getFixedData();
    return elementsData = {
        'seats': seatsData,
        'fixed': fixedData
    };
}

function collectNamesData() {
    const namesInputString = document.getElementById('namesInput').value || '';

    const seats = document.querySelectorAll('#canvas .seat');
    const seatNames = Array.from(seats).map(seat => {
        const first = seat.querySelector('.seat-firstname')?.textContent.trim() || '';
        const last = seat.querySelector('.seat-lastname')?.textContent.trim() || '';
        return { firstname: first, lastname: last };
    });

    return namesData = {
        'namesInput': namesInputString,
        'seat-names': seatNames
    };
}

// ===============================
// Fixed elements
// ===============================

async function addFixedElement(type) {
    const canvas = document.getElementById('canvas');
    await createFixedElement(type, 20, 20, 0, canvas);
}

// ===============================
// Countdown
// ===============================

const countdownCheckbox = document.getElementById('countdown-checkbox');
countdownCheckbox.addEventListener('change', () => {
    localStorage.setItem('countdown', countdownCheckbox.checked);
});

// ===============================
// Show seat numbers
// ===============================

const seatNumberCheckbox = document.getElementById('seatNumber-checkbox');
seatNumberCheckbox.addEventListener('change', () => {
    localStorage.setItem('showSeatNumbers', seatNumberCheckbox.checked);
    Array.from(document.getElementsByClassName('seat-nr')).forEach(seatNr => {
        seatNr.style.visibility = seatNumberCheckbox.checked ? 'visible' : 'hidden';
    });
});

// ===============================
// Show seat connectors
// ===============================

const seatConnectorCheckbox = document.getElementById('seatConnector-checkbox');
seatConnectorCheckbox.addEventListener('change', () => {
    localStorage.setItem('showSeatConnectors', seatConnectorCheckbox.checked);
    const canvas = document.getElementById('canvas');
    canvas.classList.toggle('show-seat-connectors', seatConnectorCheckbox.checked);
    document.getElementById('connection-layer').style.visibility = seatConnectorCheckbox.checked ? 'visible' : 'hidden';
});