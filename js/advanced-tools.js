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
            const seatData = JSON.parse(text);

            if (!Array.isArray(seatData)) {
                alert('Ungültiges Dateiformat!');
                return;
            }

            const canvas = document.getElementById('canvas');
            canvas.innerHTML = '';
            seats = [];

            for (const t of seatData) {
                await createSeatElement(t.x, t.y, t.rotate, canvas);
            }

            alert('Sitzplätze erfolgreich importiert!');
        } catch (err) {
            alert('Fehler beim Import: ' + err.message);
        }
    };
}

function importNames() {
    // TODO:
    console.log("Namen importieren...");
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
        const seatsData = getSeatData();
        exportJSON(seatsData, "seats");
    } catch (err) {
        alert('Export fehlgeschlagen: ' + err.message);
    }
}

// Export names as JSON
function exportNames() {
    try{
        const namesData = collectNamesData();
        exportJSON(namesData, "names");
    } catch (err) {
        alert('Export fehlgeschlagen: ' + err.message);
    }
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