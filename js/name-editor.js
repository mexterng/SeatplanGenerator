var personDelimiter = ";";
var nameDelimiter = ",";
var lockedSeatTag = "#";
var csvFiletext = "";
var fields = [];

window.addEventListener('DOMContentLoaded', () => {
    const { person, name, lockedSeat} = JSON.parse(localStorage.getItem('delimiter'));
    const nameStr = localStorage.getItem('namesStr');
    personDelimiter = person;
    nameDelimiter = name;
    lockedSeatTag = lockedSeat;
    if (nameStr === "") {
        addRow();
    }else {
        initRows(nameStr);
    }
    // Breite der ersten 6 Spalten ermitteln und Body anpassen
    const table = document.getElementById('nameTable');
    const firstRow = table.rows[0];
    let width = 0;

    for (let i = 0; i < 6; i++) {
        width += firstRow.cells[i].offsetWidth;
    }

    document.body.style.width = width + "px";
});

function initRows(names){
    const nameList = parseNames(names, personDelimiter, nameDelimiter, lockedSeatTag);
    nameList.forEach((p) => {
        if (Array.isArray(p)) {
            addRow(p[0].firstname, p[0].lastname, false, p[1].firstname, p[1].lastname);
        } else{
            addRow(p.firstname, p.lastname, p.lockedSeat);
        }
    });
}

function addRow(firstname = '', lastname = '', lockedSeat = false, neighborFirstname = '', neighborLastname = ''){
    const tbody = document.querySelector('#nameTable tbody');
    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    const lockIcon = lockedSeat ? 'fa-lock': 'fa-lock-open';

    tr.innerHTML = `
        <td class="delete-row"><i class="fa-solid fa-trash"></i></td>
        <td class="draggable"><i class="fa-solid fa-arrows-up-down"></i></td>
        <td class="rowCount">${rowCount}</td>
        <td class="lock"><i class="fa-solid ${lockIcon}"></i></td>
        <td><input type="text" class="firstName" placeholder="Vorname" value="${firstname}"></td>
        <td><input type="text" class="lastName" placeholder="Nachname" value="${lastname}"></td>
    `;
    if (neighborFirstname === '' && neighborLastname === '') {
        addNeighborButtonTdToTr(tr);
    } else {
        window.resizeTo(760, window.outerHeight);
        addNeighborInputTdsToTr(tr, neighborFirstname, neighborLastname);
        const lock = tr.querySelector(".lock");
        lock.classList.add('deactivate');
    }
    tbody.appendChild(tr);
    enableLockControls(tr);
    enableRowControls(tbody, tr);
    updateRowNumbers();
}


function deleteRow(row){
    row.remove();
    updateRowNumbers();
}

function confirm(){
    const rows = document.querySelectorAll('#nameTable tbody tr');
    const values = [];
    
    rows.forEach(row => {
        const first = row.querySelector('.firstName').value.trim();
        const last = row.querySelector('.lastName').value.trim();
        const locked = row.querySelector('.lock i').classList.contains('fa-lock');
        const lockedStr = locked ? '#' : '';
        if (first && last == '') {
            values.push(`${first} ${lockedStr}`.trim());
        }
        else if (first || last) {
            values.push(`${last}${nameDelimiter} ${first} ${lockedStr}`.trim());
        }
        else{
            values.push('');
        }
        
    });
    // remove trailing empty values
    while (values.length > 0 && (values[values.length - 1] === "" || values[values.length - 1] == null)) {
        values.pop(); // remove last element
    }

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

// Make table rows draggable
function enableRowControls(tbody, row) {
    const tds = row.querySelectorAll("td");

    tds.forEach(td => {
        // Delete row event
        if (td.classList.contains("delete-row")) {
            td.addEventListener("click", () => deleteRow(row));
        };
        
        // Skip TDs mit Input
        if (!td.classList.contains("draggable")) return;

        td.setAttribute("draggable", "true");
        td.style.cursor = "grab";

        td.addEventListener("dragstart", e => {
            draggedRow = row;
            row.classList.add("dragging");
            e.dataTransfer.setDragImage(row, 0, 0);
            e.dataTransfer.effectAllowed = "move";
        });

        td.addEventListener("dragend", e => {
            row.classList.remove("dragging");
            draggedRow = null;
            updateRowNumbers();
        });

        td.addEventListener("dragover", e => {
            e.preventDefault();
            if (!draggedRow || draggedRow === row) return;

            const rect = row.getBoundingClientRect();
            const offset = e.clientY - rect.top;
            const middle = rect.height / 2;

            if (offset < middle) {
                tbody.insertBefore(draggedRow, row);
            } else {
                tbody.insertBefore(draggedRow, row.nextSibling);
            }
        });
    });

    // Inputs dürfen Drag nicht starten
    row.querySelectorAll("input").forEach(input => {
        input.setAttribute("draggable", "false");
        input.addEventListener("dragstart", e => e.preventDefault());
    });
}

function enableLockControls(tr) {
    const lock = tr.querySelector(".lock");
    const lockIcon = tr.querySelector(".lock i");
    lockIcon.addEventListener('click', () => {
        if(lock.classList.contains('deactivate')) return;
        if (lockIcon.classList.contains('fa-lock-open')) {
            lockIcon.classList.remove('fa-lock-open');
            lockIcon.classList.add('fa-lock');
        } else {
            lockIcon.classList.remove('fa-lock');
            lockIcon.classList.add('fa-lock-open');
        }
    });
}

// seat neighbor

function addNeighborButtonTdToTr(tr){
    tr.appendChild(createNeighborButtonTd());
    const neighborBtn = tr.querySelector(".seat-neighbor button");
    addEventListenerNeighborButton(tr, neighborBtn);
}
function createNeighborButtonTd(){
    const neighborTd = document.createElement('td');
    neighborTd.classList.add("seat-neighbor");
    neighborTd.colSpan ="3";
    neighborTd.innerHTML = '<button class="secondary"><i class="fa-solid fa-plus"></i> Sitznachbar</button>';
    return neighborTd;
}

function addNeighborInputTdsToTr(tr, firstname = '', lastname = ''){
    const tds = createNeighborInputTds(tr, firstname, lastname);
    tds.forEach(td => {
        tr.appendChild(td);
    });
    updateRowNumbers();
}
function createNeighborInputTds(tr, firstname = '', lastname = ''){
    const rowCountNeighborTd = document.createElement('td');
    rowCountNeighborTd.classList.add('rowCount');

    const firstNameNeighborTd = document.createElement('td');
    firstNameNeighborTd.innerHTML = `<input type="text" class="firstName neighbor" placeholder="Vorname" value="${firstname}">`;

    const lastNameNeighborTd = document.createElement('td');
    lastNameNeighborTd.innerHTML = `<input type="text" class="lastName neighbor" placeholder="Nachname" value="${lastname}">`;

    const deleteNeighborTd = document.createElement('td');
    deleteNeighborTd.classList.add('delete-neighbor');
    deleteNeighborTd.innerHTML = '<i class="fa-solid fa-circle-minus"></i>';

    

    const deleteNeighborBtn = deleteNeighborTd.querySelector('i');
    const newTds = {rowCountNeighborTd, firstNameNeighborTd, lastNameNeighborTd, deleteNeighborTd};
    addEventListenerNeighborInputs(tr, newTds, deleteNeighborBtn);

    return Object.values(newTds);;
}
function addEventListenerNeighborInputs(tr, newTds, elem) {
    elem.addEventListener('click', () => {
        newTds.rowCountNeighborTd.remove();
        newTds.firstNameNeighborTd.remove();
        newTds.lastNameNeighborTd.remove();
        newTds.deleteNeighborTd.remove();
        updateRowNumbers();

        addNeighborButtonTdToTr(tr);
        const lock = tr.querySelector(".lock");
        lock.classList.remove('deactivate');
    });
}


function addEventListenerNeighborButton(tr, elem) {
    const seatNeighbor = tr.querySelector(".seat-neighbor");
    const lock = tr.querySelector(".lock");
    const lockIcon = tr.querySelector(".lock i");
    elem.addEventListener('click', () => {
        lockIcon.classList.remove('fa-lock-open');
        lockIcon.classList.remove('fa-lock');
        lockIcon.classList.add('fa-lock-open');
        lock.classList.add('deactivate');
        elem.remove();
        seatNeighbor.remove();
        
        // new seat neighbor
        window.resizeTo(760, window.outerHeight);

        addNeighborInputTdsToTr(tr);
    });
}

// Update numbering in column "#"
function updateRowNumbers() {
    let idx = 1;
    document.querySelectorAll("#nameTable tbody tr").forEach(row => {
        row.querySelectorAll(".rowCount").forEach(cell => {
            cell.textContent = idx ++;
        });
    });
}