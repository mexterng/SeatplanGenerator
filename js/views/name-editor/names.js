import { initNameEditor } from "../../ui/name-editor.js";

export function mountNameEditor(container) {
    container.innerHTML = `
        <div class="text-slate-900 flex flex-col gap-4">

            <h1>Namen bearbeiten</h1>

            <button id="start-csv-import-btn" class="btn-primary">
                <i class="fa-solid fa-file-import"></i>Namen aus csv-Datei importieren
            </button>

            <input id="csvImportFile" class="hidden" type="file" accept=".csv">

            <table id="nameTable" class="border-collapse">
                <thead>
                    <tr>
                        <th class="bg-slate-300"></th>
                        <th class="bg-slate-300"></th>
                        <th class="bg-slate-300">#</th>
                        <th class="bg-slate-300"><i class="fa-solid fa-anchor-lock"></i></th>
                        <th class="bg-slate-300">Vorname</th>
                        <th class="bg-slate-300">Nachname</th>
                        <th colspan="4" class="border-none">Sitznachbar</th>
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
                <button id="confirm-btn" class="btn-important">Bestätigen</button>
            </div>

        </div>
    `;

    initNameEditor(container);
}