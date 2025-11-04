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

// Export seats as JSON
function exportSeats() {
    try {
        const seatData = getSeatData();
        const json = JSON.stringify(seatData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'seats.json';
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert('Export fehlgeschlagen: ' + err.message);
    }
}


function exportNames() {
  // TODO:
  console.log("Namen exportieren...");
}