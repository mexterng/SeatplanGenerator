import { loadProgressBarTemplate, renderProgressBar } from "../../../templates/progressbar.js";
import { createUIjson, jsonToString } from "../../data/seatplan-model.js";
import { showError } from "../../ui/modal-template.js";
import { closeNameEditorWindow } from "./names.js";

const lockedTableID = "lockedTable";
const pairsTableID = "pairsTable";
const noPairsTableID = "noPairsTable";

export async function mountConstraintsView(container) {
    container.innerHTML = `
        <div id="name-editor" class="text-slate-900 flex flex-col gap-8">

            <header></header>
            
            <section class="space-y-4">
                <h2><i class="fa-solid fa-lock"></i> Feste Sitzplätze</h2>
                <p class="about">Einer Person können eine oder mehrere mögliche Sitzplatznummern zugewiesen werden.</p>

                <div class="flex flex-col gap-2">
                    <table id="${lockedTableID}">
                        <tbody>
                        </tbody>
                    </table>
                    <button id="add-locked-seat-btn" class="btn-primary">
                        <i class="fa-solid fa-plus"></i>Zeile hinzufügen
                    </button>
                </div>
            </section>

            <section class="space-y-4">
                <h2><i class="fa-solid fa-user-group"></i> Sitznachbarn</h2>
                <p class="about">Folgende Personen sollen immer nebeneinander sitzen.</p>

                <div class="flex flex-col gap-2">
                    <table id="${pairsTableID}">
                        <tbody>
                        </tbody>
                    </table>
                    <button id="add-neighbors-btn" class="btn-primary">
                        <i class="fa-solid fa-plus"></i>Paar hinzufügen
                    </button>
                </div>
            </section>

            <section class="space-y-4">
                <h2><i class="fa-solid fa-user-slash"></i> Keine Sitznachbarn</h2>
                <p class="about">Folgende Personen dürfen nicht nebeneinander sitzen.</p>

                <div class="flex flex-col gap-2">
                    <table id="${noPairsTableID}">
                        <tbody>
                        </tbody>
                    </table>
                    <button id="add-no-neighbors-btn" class="btn-primary">
                        <i class="fa-solid fa-plus"></i>Paar hinzufügen
                    </button>
                </div>
            </section>
            
            <div class="flex justify-between">
                <button id="back-btn" class="btn-secondary">Zurück</button>
                <button id="confirm-btn" class="btn-important"><i class="fa-solid fa-check"></i> Bestätigen</button>
            </div>
        </div>
    `;

    initConstraints(container);
    await loadProgressBarTemplate();
    container.querySelector("header").appendChild(renderProgressBar("Regeln definieren", 2, 2));
}

// ============================================
// INIT
// ============================================
export async function initConstraints(root) {
    await bindEvents(root);

    const data = JSON.parse(localStorage.getItem("nameEditorData"));
    const persons = data?.persons ?? [];
    const constraints = data?.constraints ?? [];

    setupTable({
        tableId: lockedTableID,
        buttonId: "add-locked-seat-btn",
        type: "locked",
        persons
    });

    setupTable({
        tableId: pairsTableID,
        buttonId: "add-neighbors-btn",
        type: "pair",
        persons
    });

    setupTable({
        tableId: noPairsTableID,
        buttonId: "add-no-neighbors-btn",
        type: "noPair",
        persons
    });

    initFromConstraints(persons, constraints);
}


// ============================================
// EVENT BINDING
// ============================================

async function bindEvents(root) {
    root.querySelector("#back-btn")
        .addEventListener("click", () => {back(root)});

    root.querySelector("#confirm-btn")
        .addEventListener("click", async () => {confirm(root)});
}




function getPersons() {
    const data = JSON.parse(localStorage.getItem("nameEditorData"));
    console.log(data?.persons);
    return data?.persons ?? [];
}

function createPersonSelect(persons, selectedId = "") {
    const select = document.createElement("select");
    select.classList.add("name");

    // Empty option
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "-- auswählen --";
    select.appendChild(emptyOption);

    persons.forEach(p => {
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${p.firstname} ${p.lastname}`.trim();

        if (String(p.id) === String(selectedId)) {
            option.selected = true;
        }

        select.appendChild(option);
    });

    return select;
}

function createRow({ type, persons, data = {} }) {
    const tr = document.createElement("tr");

    if (type === "locked") {
        const td1 = document.createElement("td");
        td1.appendChild(createPersonSelect(persons, data.id));

        const td2 = document.createElement("td");
        const input = document.createElement("input");
        input.classList.add("seatNumbers");
        input.placeholder = "z. B. 1,3,7";
        input.value = data.seats ?? "";
        td2.appendChild(input);

        tr.append(td1, td2);
    }

    if (type === "pair" || type === "noPair") {
        const td1 = document.createElement("td");
        td1.appendChild(createPersonSelect(persons, data.a));

        const td2 = document.createElement("td");
        td2.innerHTML = type === "pair"
            ? `<i class="fa-solid fa-link"></i>`
            : `<i class="fa-solid fa-link-slash"></i>`;

        const td3 = document.createElement("td");
        td3.appendChild(createPersonSelect(persons, data.b));

        tr.append(td1, td2, td3);
    }

    const tdDelete = document.createElement("td");
    tdDelete.classList.add("delete-row");
    tdDelete.innerHTML = `<i class="fa-solid fa-trash"></i>`;
    tdDelete.onclick = () => tr.remove();

    tr.appendChild(tdDelete);

    return tr;
}

function setupTable({ tableId, buttonId, type, persons }) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    const button = document.getElementById(buttonId);

    button.addEventListener("click", () => {
        const row = createRow({ type, persons });
        tableBody.appendChild(row);
    });
}

function initFromConstraints(persons, constraints) {
    const lockedTableBody = document.querySelector(`#${lockedTableID} tbody`);
    const pairsTableBody = document.querySelector(`#${pairsTableID} tbody`);
    const noPairsTableBody = document.querySelector(`#${noPairsTableID} tbody`);

    constraints.forEach(c => {
        if (c.type === "pair" || c.type === "noPair") {
            const row = createRow({
                type: c.type,
                persons,
                data: {
                    a: c.a,
                    b: c.b
                }
            });

            (c.type === "pair" ? pairsTableBody : noPairsTableBody)
                .appendChild(row);
        } else if (c.type === "locked") {
            const row = createRow({
                type: c.type,
                persons,
                data: {
                    id: c.id,
                    seats: c.seats
                }
            });

            lockedTableBody.appendChild(row);

        }
    });
}

function parseSeatInput(value) {
    if (!value) return null;

    const numbers = value
        .split(",")
        .map(v => v.trim())
        .filter(v => v !== "")
        .map(v => Number(v));

    // check if all are valid numbers
    if (numbers.length === 0 || numbers.some(n => Number.isNaN(n))) {
        return null;
    }

    return numbers;
}

async function readLockedSeats(root, tableID, type, verify = true) {
    const rows = root.querySelectorAll(`#${tableID} tbody tr`);
    const result = [];

    for (const [row] of rows.entries()) {
        row.classList.remove("error-row");

        const select = row.querySelector("select");
        const input = row.querySelector("input");

        const id = select.value;
        const seats = parseSeatInput(input.value);

        if (verify && !id) {
            row.classList.add("error-row");
            await showError(`Kein Name ausgewählt.`);
            return null;
        }

        if (verify && !seats) {
            row.classList.add("error-row");
            await showError(`Ungültige Sitzplatznummern.`);
            return null;
        }

        result.push({
            type,
            id,
            seats
        });
    }

    return result;
}

async function readPairs(root, tableID, type, verify = true) {
    const rows = root.querySelectorAll(`#${tableID} tbody tr`);
    const result = [];

    for (const [row] of rows.entries()) {
        row.classList.remove("error-row");

        const selects = row.querySelectorAll("select");
        const a = selects[0].value;
        const b = selects[1].value;

        if (verify && (!a || !b)) {
            row.classList.add("error-row");
            await showError(`Beide Namen müssen ausgewählt sein.`);
            return null;
        }

        if (verify && a === b) {
            row.classList.add("error-row");
            await showError(`Eine Person kann nicht sich selbst zugeordnet werden.`);
            return null;
        }

        result.push({
            type: type,
            a,
            b,
        });
    }

    return result;
}

async function back(root) {
    const locked = await readLockedSeats(root, lockedTableID, "locked", false);
    const neighbors = await readPairs(root, pairsTableID, "pair", false);
    const noNeighbors = await readPairs(root, noPairsTableID, "noPair", false);

    const allConstraints = [
        ...locked,
        ...neighbors,
        ...noNeighbors,
    ];

    // bestehende Daten laden
    const data = JSON.parse(localStorage.getItem("nameEditorData")) ?? {};

    const newData = {
        ...data,
        constraints: allConstraints
    };

    localStorage.setItem("nameEditorData", JSON.stringify(newData));

    window.location.href = "popup.html?feature=name-editor";
}

async function confirm(root) {
    const locked = await readLockedSeats(root, lockedTableID, "locked");
    if (!locked) return;

    const neighbors = await readPairs(root, pairsTableID, "pair");
    if (!neighbors) return;

    const noNeighbors = await readPairs(root, noPairsTableID, "noPair");
    if (!noNeighbors) return;

    const allConstraints = [
        ...locked,
        ...neighbors,
        ...noNeighbors,
    ];

    // bestehende Daten laden
    const data = JSON.parse(localStorage.getItem("nameEditorData")) ?? {};

    const newData = {
        ...data,
        constraints: allConstraints
    };

    const uiJSON = createUIjson(newData.persons, newData.constraints);

    localStorage.removeItem("nameEditorData");

    if (window.opener && !window.opener.closed) {
        const mainInput = window.opener.document.getElementById('namesInput');
        if (mainInput) mainInput.value = jsonToString(uiJSON, true, true);
    } else {
        await showInfo("Hauptseite nicht gefunden oder geschlossen.\n" +
            "Ergebnis:\n" +
            "\n---------------------------------\n" + 
            jsonToString(uiJSON, false, true) + 
            "\n---------------------------------\n" +
            "\nKopiere den Text zwischen den Zeilen und füge diesen manuell ein.");
    }

    closeNameEditorWindow();
}