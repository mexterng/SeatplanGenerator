import { mountConstraintsView } from "./views/name-editor/constraints.js";
import { mountNamesView } from "./views/name-editor/names.js";

export async function router() {
    const container = document.getElementById("app");
    const { feature, view } = getRoute();

    switch (feature) {
        case "name-editor":
            await routeNameEditor(container, view);
            break;

        default:
            container.innerHTML = "Unbekanntes Feature";
    }
}

async function routeNameEditor(container, view) {
    loadFeatureCSS("css/name-editor.css");
    switch (view) {
        case "constraints":
            await mountConstraintsView(container);
            break;
        default:
            await mountNamesView(container);
    }
}

function loadFeatureCSS(cssHref) {
    const id = "feature-css";

    // remove old css
    const existing = document.getElementById(id);
    if (existing && existing.href.includes(cssHref)) return;
    if (existing) existing.remove();

    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = cssHref;

    document.head.appendChild(link);
}

function getRoute() {
    const params = new URLSearchParams(window.location.search);

    return {
        feature: params.get("feature"),
        view: params.get("view")
    };
}