// ============================================
// File: ui/name-editor.js
// ============================================

/**
 * Handles UI for name table, including:
 * - Adding, deleting and reordering rows
 * - Lock/unlock seat controls
 * - Neighbor inputs and buttons
 * - CSV import for names
 * - Persisting data to main page
 */

// ============================================
// IMPORTS
// ============================================

import { parseNames } from "./../data/names.js";
import { openModal } from './modal-manager.js';

// ============================================
// FILE-LOCAL CONSTANTS
// ============================================

let personDelimiter = ";";
let nameDelimiter = ",";
let lockedSeatTag = "#";

let csvFiletext = "";
let fields = [];
let draggedRow = null;

// ============================================
// PUBLIC HANDLER — INITIALIZATION
// ============================================

/**
 * Adjusts body width to fit the first 6 columns of the table.
 */
function resizeBody() {
    const table = document.getElementById('nameTable');
    const firstRow = table.rows[0];
    let width = 0;
    
    document.body.style.width = "0px";
    for (let i = 0; i < 6; i++) {
        width += firstRow.cells[i].offsetWidth;
    }

    document.body.style.width = width + "px";
}

// Initialize table on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
    const delimiterData = JSON.parse(localStorage.getItem('delimiter'));
    if (delimiterData) {
        const { person, name, lockedSeat} = delimiterData;
        personDelimiter = person;
        nameDelimiter = name;
        lockedSeatTag = lockedSeat;
    }

    const nameStr = localStorage.getItem('namesStr');
    if (!nameStr) {
        addRow();
    } else {
        initRows(nameStr);
    }
    resizeBody();
});

/**
 * Binds all buttons to their respective actions.
 */
document.getElementById('start-csv-import-btn').addEventListener('click', startCsvImport);
document.getElementById('add-row-btn').addEventListener('click', () => {addRow();});
document.getElementById('cancel-btn').addEventListener('click', cancel);
document.getElementById('confirm-btn').addEventListener('click', confirm);

/**
 * Initializes table rows from a names string.
 *
 * @param {string} names - Raw names input string
 */
function initRows(names) {
    const nameList = parseNames(names, personDelimiter, nameDelimiter, lockedSeatTag);
    nameList.forEach((p) => {
        if (Array.isArray(p)) {
            addRow(p[0].firstname, p[0].lastname, false, p[1].firstname, p[1].lastname);
        } else {
            addRow(p.firstname, p.lastname, p.lockedSeat);
        }
    });
}

// ============================================
// PUBLIC HANDLER — TABLE ROW MANAGEMENT
// ============================================

/**
 * Adds a row to the name table with optional neighbor.
 *
 * @param {string} firstname - First name
 * @param {string} lastname - Last name
 * @param {boolean} lockedSeat - Whether seat is locked
 * @param {string} neighborFirstname - Neighbor first name
 * @param {string} neighborLastname - Neighbor last name
 */
function addRow(firstname = '', lastname = '', lockedSeat = false, neighborFirstname = '', neighborLastname = '') {
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

    if (!neighborFirstname && !neighborLastname) {
        addNeighborButtonTdToTr(tr);
    } else {
        window.resizeTo(760, window.outerHeight);
        addNeighborInputTdsToTr(tr, neighborFirstname, neighborLastname);
        tr.querySelector(".lock").classList.add('deactivate');
    }

    tbody.appendChild(tr);
    enableLockControls(tr);
    enableRowControls(tbody, tr);
    updateRowNumbers();
    resizeBody();
}

/**
 * Deletes a table row and updates numbering.
 *
 * @param {HTMLElement} row - Row element to delete
 */
function deleteRow(row) {
    row.remove();
    updateRowNumbers();
    resizeBody();
}

/**
 * Updates numbering in the "#"-column for all rows.
 */
function updateRowNumbers() {
    let idx = 1;
    document.querySelectorAll("#nameTable tbody tr").forEach(row => {
        row.querySelectorAll(".rowCount").forEach(cell => {
            cell.textContent = idx++;
        });
    });
}

// ============================================
// PUBLIC HANDLER — CONFIRM / CANCEL / CLOSE
// ============================================

/**
 * Confirms table data and sends it to main window input.
 */
function confirm() {
    const rows = document.querySelectorAll('#nameTable tbody tr');
    const values = [];

    function generateNameString(first, last, lockedStr) {
        if (first && last == '') return `${first} ${lockedStr}`.trim();
        if (first || last) return `${last}${nameDelimiter} ${first} ${lockedStr}`.trim();
        return '';
    }
    
    rows.forEach(row => {
        const first = row.querySelector('.firstName').value.trim();
        const last = row.querySelector('.lastName').value.trim();
        const locked = row.querySelector('.lock i').classList.contains('fa-lock');
        const lockedStr = locked ? '#' : '';
        const neighbor = row.querySelector('.neighbor') !== null;
        const neighborFirst = neighbor ? row.querySelector('.firstName.neighbor').value.trim() : '';
        const neighborLast = neighbor ? row.querySelector('.lastName.neighbor').value.trim() : '';

        if (neighbor) {
            values.push("[" + generateNameString(first, last, ''));
            values.push(generateNameString(neighborFirst, neighborLast, '') + "]");
        } else {
            values.push(generateNameString(first, last, lockedStr));        
        }
    });

    while (values.length > 0 && (values[values.length - 1] === "" || values[values.length - 1] == null)) {
        values.pop();
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

/**
 * Cancels the table and closes window.
 */
function cancel() {
    closeWindow();
}

/**
 * Closes the popup window and clears local storage.
 */
function closeWindow() {
    localStorage.removeItem('namesStr');
    window.close();
}

// ============================================
// PUBLIC HANDLER — CSV IMPORT
// ============================================

/**
 * Starts CSV file import by opening file picker.
 */
function startCsvImport() {
    openCsvFilepicker();
}

/**
 * Opens file picker and reads CSV content.
 */
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
            await openCsvImportModal(fields);
        } catch (err) {
            alert('Fehler beim Import: ' + err.message);
        }
    }
}

async function openCsvImportModal(fields) {
    const allFields = ["---", ...fields];

    const content = `
        <div class="flex flex-col gap-2">
            <p>Ordnen Sie jeweils die richtige Spalte der CSV-Datei zu oder wählen Sie "---".</p>
            <div class="flex items-center">
                <label class="w-24">Vorname:</label>
                <select id="firstnameSelect" class="flex-1 min-w-16"></select>
            </div>
            <div class="flex items-center">
                <label class="w-24">Nachname:</label>
                <select id="lastnameSelect" class="flex-1 min-w-16"></select>
            </div>
        </div>
    `;

    const result = await openModal({
        title: "CSV Import",
        content,
        buttons: [
            { label: "Abbrechen", value: null, className: "btn-secondary" },
            { label: "Importieren", value: "import", className: "btn-primary" }
        ],
        onOpen: (modal) => {
            // populate selects
            const firstnameSelect = modal.querySelector("#firstnameSelect");
            const lastnameSelect = modal.querySelector("#lastnameSelect");

            [firstnameSelect, lastnameSelect].forEach(select => {
                select.innerHTML = "";
                allFields.forEach(f => {
                    const option = document.createElement("option");
                    option.text = f;
                    option.value = f;
                    select.add(option);
                });
            });

            // focus first input/select
            firstnameSelect.focus();
        },
        onSubmit: (modal) => {
            const firstnameCol = modal.querySelector("#firstnameSelect").value;
            const lastnameCol = modal.querySelector("#lastnameSelect").value;
            return { firstnameCol, lastnameCol };
        }
    });

    if (!result) return; // Abbrechen

    // CSV verarbeiten
    const tbody = document.querySelector('#nameTable tbody');
    tbody.querySelectorAll('tr').forEach(tr => tr.remove());

    const firstnameIndex = fields.indexOf(result.firstnameCol);
    const lastnameIndex = fields.indexOf(result.lastnameCol);

    const csvData = csvFiletext.split('\n').map(r => r.replace('\r', '').split(','));

    csvData.slice(1).forEach(row => {
        const firstname = firstnameIndex >= 0 ? row[firstnameIndex] : '';
        const lastname  = lastnameIndex  >= 0 ? row[lastnameIndex]  : '';
        if (firstname || lastname) addRow(firstname, lastname);
    });
}

// ============================================
// PUBLIC HANDLER — ROW DRAG & LOCK
// ============================================

/**
 * Enables drag, delete, and input prevention for a row.
 *
 * @param {HTMLElement} tbody - Table body
 * @param {HTMLElement} row - Row element
 */
function enableRowControls(tbody, row) {
    const tds = row.querySelectorAll("td");

    tds.forEach(td => {
        if (td.classList.contains("delete-row")) {
            td.addEventListener("click", () => deleteRow(row));
        }

        if (!td.classList.contains("draggable")) return;

        td.setAttribute("draggable", "true");
        td.style.cursor = "grab";

        td.addEventListener("dragstart", e => {
            draggedRow = row;
            row.classList.add("dragging");
            e.dataTransfer.setDragImage(row, 0, 0);
            e.dataTransfer.effectAllowed = "move";
        });

        td.addEventListener("dragend", () => {
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

            if (offset < middle) tbody.insertBefore(draggedRow, row);
            else tbody.insertBefore(draggedRow, row.nextSibling);
        });
    });

    row.querySelectorAll("input").forEach(input => {
        input.setAttribute("draggable", "false");
        input.addEventListener("dragstart", e => e.preventDefault());
    });
}

/**
 * Enables click event on lock icon to toggle locked state.
 *
 * @param {HTMLElement} tr - Table row element
 */
function enableLockControls(tr) {
    const lock = tr.querySelector(".lock");
    const lockIcon = lock.querySelector("i");
    lockIcon.addEventListener('click', () => {
        if (lock.classList.contains('deactivate')) return;
        lockIcon.classList.toggle('fa-lock-open');
        lockIcon.classList.toggle('fa-lock');
    });
}

// ============================================
// PUBLIC HANDLER — SEAT NEIGHBOR MANAGEMENT
// ============================================

function addNeighborButtonTdToTr(tr){
    const neighborTd = createNeighborButtonTd();
    tr.appendChild(neighborTd);
    const neighborBtn = neighborTd.querySelector("button");
    addEventListenerNeighborButton(tr, neighborBtn);
}

function createNeighborButtonTd() {
    const neighborTd = document.createElement('td');
    neighborTd.classList.add("seat-neighbor");
    neighborTd.colSpan ="3";
    neighborTd.innerHTML = '<button class="btn-secondary"><i class="fa-solid fa-plus"></i> Sitznachbar</button>';
    return neighborTd;
}

function addNeighborInputTdsToTr(tr, firstname = '', lastname = '') {
    const tds = createNeighborInputTds(tr, firstname, lastname);
    tds.forEach(td => tr.appendChild(td));
    updateRowNumbers();
}

function createNeighborInputTds(tr, firstname = '', lastname = '') {
    const rowCountNeighborTd = document.createElement('td'); rowCountNeighborTd.classList.add('rowCount');
    const firstNameNeighborTd = document.createElement('td');
    firstNameNeighborTd.innerHTML = `<input type="text" class="firstName neighbor" placeholder="Vorname" value="${firstname}">`;
    const lastNameNeighborTd = document.createElement('td');
    lastNameNeighborTd.innerHTML = `<input type="text" class="lastName neighbor" placeholder="Nachname" value="${lastname}">`;
    const deleteNeighborTd = document.createElement('td'); deleteNeighborTd.classList.add('delete-neighbor');
    deleteNeighborTd.innerHTML = '<i class="fa-solid fa-circle-minus"></i>';

    addEventListenerNeighborInputs(tr, {rowCountNeighborTd, firstNameNeighborTd, lastNameNeighborTd, deleteNeighborTd}, deleteNeighborTd.querySelector('i'));

    return [rowCountNeighborTd, firstNameNeighborTd, lastNameNeighborTd, deleteNeighborTd];
}

function addEventListenerNeighborInputs(tr, newTds, elem) {
    elem.addEventListener('click', () => {
        Object.values(newTds).forEach(td => td.remove());
        updateRowNumbers();
        addNeighborButtonTdToTr(tr);
        tr.querySelector(".lock").classList.remove('deactivate');
    });
}

function addEventListenerNeighborButton(tr, elem) {
    const seatNeighbor = tr.querySelector(".seat-neighbor");
    const lock = tr.querySelector(".lock");
    const lockIcon = lock.querySelector("i");

    elem.addEventListener('click', () => {
        lockIcon.classList.remove('fa-lock-open', 'fa-lock');
        lockIcon.classList.add('fa-lock-open');
        lock.classList.add('deactivate');

        elem.remove();
        seatNeighbor.remove();

        window.resizeTo(760, window.outerHeight);
        addNeighborInputTdsToTr(tr);
    });
}