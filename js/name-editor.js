var personDelimiter = ";";
var nameDelimiter = ",";
var csvFiletext = "";
var fields = [];

window.addEventListener('DOMContentLoaded', () => {
    const { person, name } = JSON.parse(localStorage.getItem('delimiter'));
    const nameStr = localStorage.getItem('namesStr');
    personDelimiter = person;
    nameDelimiter = name;
    initRows(nameStr);
});

function initRows(names){
    const nameList = parseNames(names, personDelimiter, nameDelimiter);
    nameList.forEach((person) => {
        addRow(person.firstname, person.lastname);
    });
}

function addRow(firstname = '', lastname = ''){
    const tbody = document.querySelector('#nameTable tbody');
    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td class="draggable">&#x21F5;</td>
        <td><input type="text" class="firstName" placeholder="Vorname" value="${firstname}"></td>
        <td><input type="text" class="lastName" placeholder="Nachname" value="${lastname}"></td>
    `;
    tbody.appendChild(tr);
}

function confirm(){
    const rows = document.querySelectorAll('#nameTable tbody tr');
    const values = [];

    rows.forEach(row => {
        const first = row.querySelector('.firstName').value.trim();
        const last = row.querySelector('.lastName').value.trim();
        if (first && last == '') {
            values.push(`${first}`.trim());
        }
        else if (first || last) {
            values.push(`${last}${nameDelimiter} ${first}`.trim());
        }
    });

    const result = values.join(personDelimiter + ' ');

    if (window.opener && !window.opener.closed) {
        const mainInput = window.opener.document.getElementById('namesInput');
        if (mainInput) mainInput.value = result;
    } else {
        alert("Hauptseite nicht gefunden oder geschlossen.\n" +
            "Ergebnis:\n" +
            "\n---------------------------------\n" + 
            result + 
            "\n---------------------------------\n" +
            "\nKopiere den Text zwischen den Zeilen und füge diesen manuell ein.");
    }

    closeWindow();
}

function cancel(){
    closeWindow();
}

function closeWindow(){
    localStorage.removeItem('namesStr');
    window.close();
}

function startCsvImport() {
    openCsvFilepicker();
}

// Close popup
function closeImportPopup() {
  document.getElementById("importOverlay").style.display = "none";
}

async function openCsvFilepicker() {
    const input = document.getElementById('csvImportFile');
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) {
            alert('Keine Datei ausgewählt (Import abgebrochen).');
            return;
        }

        try {
            csvFiletext = await file.text();
            const headLine = csvFiletext.split('\n')[0].replace('\r', '');
            fields = headLine.split(',');
            openImportPopup(fields);
        } catch (err) {
            alert('Fehler beim Import: ' + err.message);
        }
    }
}

// Open popup to collect import data
function openImportPopup(fields) {
    let allFields = ["---", ...fields];

    document.getElementById("importOverlay").style.display = "flex";
    const firstnameSelect = document.getElementById("firstnameSelect");
    const lastnameSelect = document.getElementById("lastnameSelect");

    // Optionen füllen
    [firstnameSelect, lastnameSelect].forEach(select => {
        select.innerHTML = ""; // vorherige Optionen entfernen
        allFields.forEach(f => {
            const option = document.createElement("option");
            option.text = f;
            option.value = f;
            select.add(option);
        });
    });

}

// Cancel button
document.getElementById("cancelImportBtn").addEventListener("click", closeImportPopup);

// ESC-key
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.getElementById("importOverlay").style.display !== "none") {
        closeImportPopup();
    }
});

// Import button
document.getElementById("importCsvBtn").addEventListener("click", () => {
    // clear all rows in window
    document.querySelector('#nameTable tbody').querySelectorAll('tr').forEach(tr => tr.remove());

    const firstnameCol = firstnameSelect.value;
    const lastnameCol = lastnameSelect.value;

    const csvData = csvFiletext.split('\n').map(r => r.replace('\r', '').split(','));

    // find the index of the selected columns in the header array  
    const firstnameIndex = fields.indexOf(firstnameCol);
    const lastnameIndex = fields.indexOf(lastnameCol);

    // map CSV data to objects, ignore if "---" is selected
    // skip header and only add rows with at least one non-empty field
    csvData.slice(1).forEach(row => {
        const firstname = firstnameIndex >= 0 ? row[firstnameIndex] : '';
        const lastname  = lastnameIndex  >= 0 ? row[lastnameIndex]  : '';

        if (firstname || lastname) {
            addRow(firstname, lastname);
        }
    });
    closeImportPopup();
});