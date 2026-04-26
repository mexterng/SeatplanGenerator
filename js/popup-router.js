import { mountConstraintsView } from "./views/name-editor/constraints.js";
import { mountNamesView } from "./views/name-editor/names.js";

export function router() {
    const container = document.getElementById("app");
    const { feature, view } = getRoute();

    switch (feature) {
        case "name-editor":
            routeNameEditor(container, view);
            break;

        default:
            container.innerHTML = "Unbekanntes Feature";
    }
}

function routeNameEditor(container, view) {
    loadFeatureCSS("css/name-editor.css");
    switch (view) {
        case "constraints":
            mountConstraintsView(container);
            break;
        default:
            mountNamesView(container);
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