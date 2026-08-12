/**
 * UI logic for name table
 *
 * Responsibilities:
 * - Row management (add, delete, reorder)
 * - CSV import
 */

// ============================================
// IMPORTS
// ============================================

import { loadProgressBarTemplate, renderProgressBar } from "../../../templates/progressbar.js";
import { inputToUIjson, createSingle, createUIjson, jsonToString, buildSGModelFromUI} from "../../data/seatplan-model.js";
import { openModal } from '../../ui/modal-manager.js';
import { showInfo, showError } from "../../ui/modal-template.js";
import { initConstraints } from "./constraints.js";

// ============================================
// FILE-LOCAL CONSTANTS
// ============================================

let csvFiletext = "";
let fields = [];
let draggedRow = null;
let lastNameID = 0;

let isInternalNavigation = false;

// ============================================
// MOUNTED HTML
// ============================================
export async function mountNamesView(container) {
    container.innerHTML = `
        <div id="name-editor" class="text-slate-900 flex flex-col gap-4">

            <header></header>

            <p>Erfasse alle Personen, die am Sitzplan teilnehmen sollen.</p>

            <div>
                <button id="start-csv-import-btn" class="btn-primary">
                    <i class="fa-solid fa-file-import"></i>Namen aus csv-Datei importieren
                </button>
            </div>
            
            <input id="csvImportFile" class="hidden" type="file" accept=".csv">

            <table id="nameTable" class="border-collapse">
                <thead>
                    <tr>
                        <th class="bg-slate-300"></th>
                        <th class="bg-slate-300">#</th>
                        <th class="bg-slate-300 align-left">Vorname</th>
                        <th class="bg-slate-300 align-left">Nachname</th>
                        <th class="bg-slate-300"></th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>

            <button id="add-row-btn" class="btn-primary">
                <i class="fa-solid fa-plus"></i>Zeile hinzufügen
            </button>

            <div class="flex justify-between">
                <button id="cancel-btn" class="btn-secondary">Abbrechen</button>
                <button id="open-constraints-btn" class="btn-important">Regeln definieren <i class="fa-solid fa-arrow-right"></i></button>
            </div>

        </div>
    `;

    await loadProgressBarTemplate();
    container.querySelector("header").appendChild(renderProgressBar("Namen eingeben", 1, 2));
    initNameEditor(container);
}

// ============================================
// INIT
// ============================================

async function initNameEditor(root) {
    const nameTable = root.querySelector("#nameTable");
    await initLocalStorage();
    bindEvents(root, nameTable);
    restoreOrInitRows(nameTable);

    registerUnloadHandler();
}


// ============================================
// EVENT BINDING
// ============================================

function bindEvents(root, nameTable) {
    root.querySelector("#start-csv-import-btn")
        .addEventListener("click", () => startCsvImport(root));

    root.querySelector("#add-row-btn")
        .addEventListener("click", () => addRow(root));

    root.querySelector("#cancel-btn")
        .addEventListener("click", cancel);

    root.querySelector("#open-constraints-btn")
        .addEventListener("click", () => goToConstraints(root, nameTable));
}

// ============================================
// DATA INIT
// ============================================
async function initLocalStorage() {
    try {
        if(localStorage.getItem("nameEditorData")) return;
        const sgJSON = JSON.parse(localStorage.getItem("sgJSON"));

        if (sgJSON.version == 1 || sgJSON.version == 2){
            localStorage.setItem("nameEditorData", JSON.stringify({
                persons: sgJSON.persons,
                constraints: sgJSON.constraints,
            }));
        } else {
            await showError("Diese JSON Version wird leider nicht mehr unterstützt!");
        }

    } catch (err) {
        console.error(err);
    }
}
async function restoreOrInitRows(table) {
    const tbody = table.querySelector("tbody");

    const nameEditorData = JSON.parse(localStorage.getItem("nameEditorData"));

    tbody.innerHTML = "";

    if (nameEditorData.persons.length == 0) {
        addRow(table);
    } else {
        for (const person of nameEditorData.persons) {
            addRow(table, person.firstname, person.lastname, person.id);
        }
    }
}


// ============================================
// ROW MANAGEMENT
// ============================================
/**
 * Adds a row to the name table with optional neighbor.
 *
 * @param {string} firstname - First name
 * @param {string} lastname - Last name
 */
function addRow(table, firstname = '', lastname = '', id) {
    const tbody = table.querySelector('tbody');
    const rowCount = tbody.rows.length + 1;

    const tr = document.createElement('tr');

    // Assign incremental or predefined ID
    tr.id = ++lastNameID;

    if (id) {
        tr.id = id;

        // Keep lastNameID in sync
        if (id >= lastNameID) {
            lastNameID = id;
        }
    }

    tr.innerHTML = `
    <td class="draggable" title="Zeile verschieben"><i class="fa-solid fa-arrows-up-down"></i></td>
    <td class="rowCount" title="Laufende Nummer (ggf. Sitzplatznummer)">${rowCount}</td>
    <td><input type="text" class="firstName" placeholder="Vorname" value="${firstname}"></td>
    <td><input type="text" class="lastName" placeholder="Nachname" value="${lastname}"></td>
    <td class="delete-row" title="Zeile löschen"><i class="fa-solid fa-trash"></i></td>
    `;

    tbody.appendChild(tr);

    enableRowControls(table, tr);

    updateRowNumbers(table);
}

/**
 * Deletes a table row and updates numbering.
 *
 * @param {HTMLElement} row - Row element to delete
 */
function deleteRow(table, row) {
    row.remove();
    updateRowNumbers(table);
}

/**
 * Updates numbering in the "#"-column for all rows.
 */
function updateRowNumbers(table) {
    let idx = 1;

    table.querySelectorAll("tbody tr").forEach(row => {
        row.querySelectorAll(".rowCount").forEach(cell => {
            cell.textContent = idx++;
        });
    });
}

// ============================================
// CONFIRM / CANCEL
// ============================================

/**
 * Validates input, converts table data to UI JSON and exports it.
 *
 * @returns {Promise<void>}
 */
async function goToConstraints(root, table) {
    const rows = table.querySelectorAll('tbody tr');

    const names = [];
    rows.forEach(row => {
        const firstname = row.querySelector('.firstName').value.trim();
        const lastname = row.querySelector('.lastName').value.trim();
        if (firstname + lastname !== "") {
            const id = row.id;
            names.push({id, firstname, lastname});
        }
    });
    const nameEditorData = JSON.parse(localStorage.getItem("nameEditorData"));
    nameEditorData.persons = names;
    localStorage.setItem("nameEditorData", JSON.stringify(nameEditorData));
    markInternalNavigation();
    window.location.href = "popup.html?feature=name-editor&view=constraints";
}

/**
 * Cancels the table and closes window.
 */
function cancel() {
    markInternalNavigation();

    localStorage.removeItem("nameEditorData");
    closeNameEditorWindow();
}

// call this before any redirect / window.close()
export function markInternalNavigation() {
    isInternalNavigation = true;
}

// register once on init
export function registerUnloadHandler() {
    window.addEventListener("beforeunload", (e) => {
        if (isInternalNavigation) return;

        // trigger confirm dialog
        e.preventDefault();
        e.returnValue = "";

        // cleanup NUR wenn kein interner Wechsel
        localStorage.removeItem("nameEditorData");
        localStorage.removeItem("sgJSON");
    });
}

/**
 * Closes the popup window and clears local storage.
 */
export function closeNameEditorWindow() {
    markInternalNavigation();

    localStorage.removeItem('sgJSON');
    window.close();
}

// ============================================
// PUBLIC HANDLER — CSV IMPORT
// ============================================

function startCsvImport(root) {
    const input = root.querySelector('#csvImportFile');

    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) {
            await showInfo('Keine Datei ausgewählt (Import abgebrochen).');
            return;
        }

        try {
            csvFiletext = await file.text();
            fields = csvFiletext.split('\n')[0].replace('\r', '').split(';');
            const nameTable = root.querySelector("#nameTable");
            await openCsvImportModal(nameTable, fields);
        } catch (err) {
            await showError('Fehler beim Import: ' + err.message);
        }
    };
}

async function openCsvImportModal(table, fields) {
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

    const csvData = csvFiletext.split('\n').map(r => r.replace('\r', '').split(';'));

    csvData.slice(1).forEach(row => {
        const firstname = firstnameIndex >= 0 ? row[firstnameIndex] : '';
        const lastname  = lastnameIndex  >= 0 ? row[lastnameIndex]  : '';
        if (firstname || lastname) addRow(table, firstname, lastname);
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
function enableRowControls(table, row) {
    const tbody = table.querySelector("tbody");
    const tds = row.querySelectorAll("td");

    tds.forEach(td => {
        if (td.classList.contains("delete-row")) {
            td.addEventListener("click", () => deleteRow(table, row));
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
            updateRowNumbers(table);
        });

        td.addEventListener("dragover", e => {
            e.preventDefault();
            if (!draggedRow || draggedRow === row) return;

            const rect = row.getBoundingClientRect();
            const offset = e.clientY - rect.top;

            if (offset < rect.height / 2) {
                tbody.insertBefore(draggedRow, row);
            } else {
                tbody.insertBefore(draggedRow, row.nextSibling);
            } 
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
    const icon = lock.querySelector("i");

    icon.addEventListener("click", () => {
        if (lock.classList.contains("deactivate")) return;

        icon.classList.toggle("fa-lock");
        icon.classList.toggle("fa-lock-open");
    });
}

// ============================================
// NEIGHBOR
// ============================================
/**
 * Enables click event on link icon to toggle neighbor state.
 *
 * @param {HTMLElement} tr - Table row element
 */
function enableNeighborControls(tr) {
    const link = tr.querySelector(".link");
    const linkIcon = link.querySelector("i");
    linkIcon.addEventListener('click', () => {
        linkIcon.classList.toggle('fa-link');
        linkIcon.classList.toggle('fa-link-slash');
    });
}


function addNeighborButtonTdToTr(root, tr) {
    const neighborTd = createNeighborButtonTd();
    tr.appendChild(neighborTd);
    const neighborBtn = neighborTd.querySelector("button");
    addEventListenerNeighborButton(root, tr, neighborBtn);
}

function createNeighborButtonTd() {
    const neighborTd = document.createElement('td');
    neighborTd.classList.add("seat-neighbor");
    neighborTd.colSpan ="4";
    neighborTd.innerHTML = '<button class="btn-secondary"><i class="fa-solid fa-plus"></i> Sitznachbar</button>';
    return neighborTd;
}

function addNeighborInputTdsToTr(root, tr, firstname = '', lastname = '', mustBeNeighbors = true) {
    const tds = createNeighborInputTds(root, tr, firstname, lastname, mustBeNeighbors);
    tds.forEach(td => tr.appendChild(td));
    enableNeighborControls(tr);
    updateRowNumbers(root);
}

function createNeighborInputTds(root, tr, firstname = '', lastname = '', mustBeNeighbors = true) {
    const rowCountNeighborTd = document.createElement('td'); 
    rowCountNeighborTd.classList.add('rowCount');
    const mustBeNeighborsTd = document.createElement('td'); 
    mustBeNeighborsTd.classList.add('link');
    const linkIcon = mustBeNeighbors ? 'fa-link' : 'fa-link-slash';
    mustBeNeighborsTd.innerHTML = `<i class="fa-solid ${linkIcon}" title="Personen (NICHT) nebeneinander setzen"></i>`;
    const firstNameNeighborTd = document.createElement('td');
    firstNameNeighborTd.innerHTML = `<input type="text" class="firstName neighbor" placeholder="Vorname" value="${firstname}">`;
    const lastNameNeighborTd = document.createElement('td');
    lastNameNeighborTd.innerHTML = `<input type="text" class="lastName neighbor" placeholder="Nachname" value="${lastname}">`;
    const deleteNeighborTd = document.createElement('td'); deleteNeighborTd.classList.add('delete-neighbor');
    deleteNeighborTd.innerHTML = '<i class="fa-solid fa-circle-minus" title="Sitznachbar löschen"></i>';

    addEventListenerNeighborInputs(root, tr, {mustBeNeighborsTd, rowCountNeighborTd, firstNameNeighborTd, lastNameNeighborTd, deleteNeighborTd}, deleteNeighborTd.querySelector('i'));

    return [mustBeNeighborsTd, rowCountNeighborTd, firstNameNeighborTd, lastNameNeighborTd, deleteNeighborTd];
}

function addEventListenerNeighborInputs(root, tr, newTds, elem) {
    elem.addEventListener('click', () => {
        Object.values(newTds).forEach(td => td.remove());
        updateRowNumbers(root);
        addNeighborButtonTdToTr(root, tr);
        tr.querySelector(".lock").classList.remove('deactivate');
    });
}

function addEventListenerNeighborButton(root, tr, elem) {
    const seatNeighbor = tr.querySelector(".seat-neighbor");
    const lock = tr.querySelector(".lock");
    const lockIcon = lock.querySelector("i");

    elem.addEventListener('click', () => {
        lockIcon.classList.remove('fa-lock-open', 'fa-lock');
        lockIcon.classList.add('fa-lock-open');
        lock.classList.add('deactivate');

        elem.remove();
        seatNeighbor.remove();

        addNeighborInputTdsToTr(root, tr);
    });
}