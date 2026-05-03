export async function loadProgressBarTemplate() {
    const res = await fetch("./templates/progressbar.html");
    if (!res.ok) throw new Error("failed to load templates");

    const html = await res.text();

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;

    document.body.appendChild(wrapper);

    // load CSS (only once)
    if (!document.getElementById("progressbar-styles")) {
        const link = document.createElement("link");
        link.id = "progressbar-styles";
        link.rel = "stylesheet";
        link.href = "./templates/progressbar.css";

        document.head.appendChild(link);
    }
}

export function renderProgressBar(title, currentStep, totalSteps, showStepText = true) {
    const tpl = document.getElementById("progressbar-template");
    if (!tpl) throw new Error("progressbar-template not found");
    const clone = tpl.content.cloneNode(true);

    const percentage = totalSteps > 0
        ? Math.min(100, Math.max(0, (currentStep / totalSteps) * 100))
        : 0;

    // fill content
    clone.querySelector("[data-title]").textContent = title;
    if (showStepText) clone.querySelector("[data-step]").textContent = `Schritt ${currentStep}/${totalSteps}`;
    clone.querySelector("[data-bar]").style.width = `${percentage}%`;

    return clone;
}