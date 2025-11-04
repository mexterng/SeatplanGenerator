// ===============================
// Import / Export Funktionen
// ===============================

async function importSeats() {
    // TODO:
    console.log("Sitzplätze importieren...");
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