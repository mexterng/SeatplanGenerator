export function mountConstraintsView(container) {
    container.innerHTML = `
        <div class="text-slate-900 flex flex-col gap-8">

            <h1>Regeln definieren (Schritt 2/2)</h1>
            
            <section class="space-y-4">
                <h3><i class="fa-solid fa-lock"></i>Feste Sitzplätze</h3>

                <div class="flex flex-col gap-2">
                    <table id="lockedSeats">
                        <thead>
                            <tr>
                                <th class="bg-slate-300">Name</th>
                                <th class="bg-slate-300">Sitzplatznummer</th>
                                <th class="bg-slate-300"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Vorname Name</td>
                                <td>2, 5, 6, 7</td>
                                <td class="delete-row" title="Zeile löschen"><i class="fa-solid fa-trash"></i></td>
                            </tr>
                        </tbody>
                    </table>
                    <button id="add-locked-seat-btn" class="btn-primary">
                        <i class="fa-solid fa-plus"></i>Zeile hinzufügen
                    </button>
                </div>
            </section>

            <section class="space-y-4">
                <h3><i class="fa-solid fa-user-group"></i>Sitznachbarn</h3>

                <div class="flex flex-col gap-2">
                    <table id="seatNeighbors">
                        <tbody>
                            <tr>
                                <td>Vorname Name</td>
                                <td><i class="fa-solid fa-link"></i></td>
                                <td>Vorname Name</td>
                                <td class="delete-row" title="Zeile löschen"><i class="fa-solid fa-trash"></i></td>
                            </tr>
                        </tbody>
                    </table>
                    <button id="add-neighbors-btn" class="btn-primary">
                        <i class="fa-solid fa-plus"></i>Paar hinzufügen
                    </button>
                </div>
            </section>

            <section class="space-y-4">
                <h3><i class="fa-solid fa-user-slash"></i>Keine Sitznachbarn</h3>

                <div class="flex flex-col gap-2">
                    <table id="seatNoNeighbors">
                        <tbody>
                            <tr>
                                <td>Vorname Name</td>
                                <td><i class="fa-solid fa-link-slash"></i></td>
                                <td>Vorname Name</td>
                                <td class="delete-row" title="Zeile löschen"><i class="fa-solid fa-trash"></i></td>
                            </tr>
                        </tbody>
                    </table>
                    <button id="add-no-neighbors-btn" class="btn-primary">
                        <i class="fa-solid fa-plus"></i>Paar hinzufügen
                    </button>
                </div>
            </section>
            
            <div class="flex justify-between">
                <button id="back-btn" class="btn-secondary">Zurück</button>
                <button id="open-constraints-btn" class="btn-important"><i class="fa-solid fa-check"></i> Bestätigen</button>
            </div>
        </div>
    `;

    document.getElementById("back-btn").addEventListener("click", () => {
        window.location.href = "popup.html?feature=name-editor";
    });

    initConstraints();
}

export function initConstraints(root) {
    console.log(JSON.parse(localStorage.getItem("nameEditorData")));
}