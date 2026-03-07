import { openModal } from './modal-manager.js';

const STORAGE_KEY = "appLastSeenVersion";
const REPO_API = "https://api.github.com/repos/mexterng/SeatplanGenerator/releases";

/**
 * Fetch GitHub releases
 * @returns {Promise<Array>} list of releases
 */
async function fetchReleases() {
    try {
        const res = await fetch(REPO_API);
        const releases = await res.json();
        return releases || [];
    } catch (e) {
        console.error("Error fetching releases:", e);
        return [];
    }
}

/**
 * Compare semantic versions, return true if v1 > v2
 */
function isVersionNewer(v1, v2) {
    if (!v2) return true;
    const a = v1.replace(/^v/, "").split('.').map(Number);
    const b = v2.replace(/^v/, "").split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const n1 = a[i] ?? 0;
        const n2 = b[i] ?? 0;
        if (n1 > n2) return true;
        if (n1 < n2) return false;
    }
    return false;
}

/**
 * Convert Markdown-like release notes to HTML (<ul> for "-")
 */
function parseReleaseNotes(mdText) {
    const lines = mdText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    let html = "";
    let inList = false;

    lines.forEach(line => {
        if (line.startsWith("-")) {
            if (!inList) { html += "<ul class='list-disc ml-5 text-sm'>"; inList = true; }
            html += `<li>${line.slice(1).trim()}</li>`;
        } else {
            if (inList) { html += "</ul>"; inList = false; }
            html += `<p class='text-sm mb-1'>${line}</p>`;
        }
    });

    if (inList) html += "</ul>";
    return html;
}

/**
 * Show version popup / welcome message
 */
export async function showVersionPopup() {
    const releases = await fetchReleases();
    if (!releases.length) return;

    const currentVersion = releases[0].tag_name;
    const lastSeen = localStorage.getItem(STORAGE_KEY);

    // Already seen current version -> do nothing
    if (lastSeen === currentVersion) return;

    let content = "";
    let isWelcomePopup = false;

    // No version in localStorage -> show welcome message
    if (!lastSeen) {
        isWelcomePopup = true;
        content = `
            <b class="text-xl">Alle Features im Überblick:</b>
            <ul class="list-disc ml-5">
                <li>Sitzplätze erstellen, verschieben, drehen, duplizieren und löschen</li>
                <li>Namen automatisch auslosen oder manuell zuweisen</li>
                <li>Für einzelne Personen feste Sitzplatznummern oder Nachbarschaften festlegen</li>
                <li>Daten (Sitzplan, Namen, etc.) werden ausschließlich lokal im Browser gespeichert</li>
                <li>Daten (Sitzplan, Namen) können exportiert und geteilt werden</li>
                <li>Sitzpläne als PDF exportieren</li>
            </ul>
            <p class="mt-2">Alle neuen Features werden nach Updates hier angezeigt.</p>
        `;
    }
    // Version in storage kleiner als aktuelle -> show release notes
    else {
        for (const release of releases) {
            const version = release.tag_name;
            if (!isVersionNewer(version, lastSeen)) continue;

            content += `<div class="versionNote">`;
            content += `<div class="font-semibold text-sm mb-1">Version ${version}</div>`;
            content += parseReleaseNotes(release.body || "");
            content += `</div>`;
        }
        if (!content) return; // no new releases
    }

    // Only show checkbox if this is version popup
    const fullContent = `<div class="flex flex-col gap-4"><div class="flex flex-col gap-4 max-h-[calc(80vh-13.5rem)] overflow-y-auto">${content}</div>
           <label class="flex items-center gap-2 text-sm cursor-pointer mt-4">
               <input id="popupDontShow" type="checkbox">
               Nicht mehr anzeigen
           </label></div>`;

    await openModal({
        title: isWelcomePopup ? "Willkommen beim Sitzplangenerator": "Es gibt Neuigkeiten",
        content: fullContent,
        onSubmit: (modal) => {
            const checkbox = modal.querySelector("#popupDontShow");
            if (checkbox?.checked) {
                localStorage.setItem(STORAGE_KEY, currentVersion);
            }
            return true;
        },
        buttons: [
            {
                label: "OK",
                value: true,
                className: "btn-primary"
            }
        ]
    });
}