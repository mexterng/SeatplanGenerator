// ===============================
// Export Module
// ===============================

// PDF margins
const margin_top = 25;
const margin_right = 15;
const margin_bottom = 10;
const margin_left = 15;

// Open popup to collect export data
function openExportPopup() {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "exportOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0,0,0,0.5)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "1000";

  // Create popup
  const popup = document.createElement("div");
  popup.style.backgroundColor = "white";
  popup.style.padding = "20px";
  popup.style.borderRadius = "10px";
  popup.style.width = "300px";
  popup.style.boxShadow = "0 5px 15px rgba(0,0,0,0.3)";

  popup.innerHTML = `
        <h3>PDF Export</h3>
        <label>Name der Klasse:<br><input type="text" id="className" style="width:100%"></label><br><br>
        <label>Stand:<br><input type="date" id="dateFrom" style="width:100%" value="${
          new Date().toISOString().split("T")[0]
        }"></label><br><br>
        <label>Gültig bis:<br><input type="date" id="dateTo" style="width:100%"></label><br><br>
        <label>Name der Lehrkraft:<br><input type="text" id="teacherName" style="width:100%"></label><br><br>
        <button id="exportPdfBtn">Exportieren</button>
        <button id="cancelExportBtn" style="margin-left:10px;">Abbrechen</button>
    `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Cancel button
  document.getElementById("cancelExportBtn").addEventListener("click", () => {
    document.body.removeChild(overlay);
  });

  // Export button
  document.getElementById("exportPdfBtn").addEventListener("click", () => {
    const className = document.getElementById("className").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const teacherName = document.getElementById("teacherName").value;

    exportSeatsVectorPDF(className, dateFrom, dateTo, teacherName);
    document.body.removeChild(overlay);
  });
}

// Format date string to DD.MM.YYYY
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return "                  ";
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

// Export seats as vector PDF
function exportSeatsVectorPDF(className, dateFrom, dateTo, teacherName) {
  const dateFrom_str = formatDateToDDMMYYYY(dateFrom);
  const dateTo_str = formatDateToDDMMYYYY(dateTo);
  if (!seats || seats.length === 0) {
    alert("Keine Sitzplätze vorhanden!");
    return;
  }

  const { jsPDF } = window.jspdf;

  // DIN A4 Landscape in mm
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // Header
  pdf.setFontSize(12);
  const margin_step = 7;
  pdf.text(`Klasse: ${className}`, margin_left, margin_top + margin_step * 0);
  pdf.text(
    `Lehrkraft: ${teacherName}`,
    margin_left,
    margin_top + margin_step * 1
  );
  pdf.text(
    `Stand: ${dateFrom_str}`,
    pdfWidth - margin_right,
    margin_top + margin_step * 0,
    { align: "right" }
  );
  pdf.text(
    `Gültig bis: ${dateTo_str}`,
    pdfWidth - margin_right,
    margin_top + margin_step * 1,
    { align: "right" }
  );

  // Separator line
  pdf.setLineWidth(0.2);
  pdf.setDrawColor(0, 0, 0);
  pdf.line(
    margin_left,
    margin_top + margin_step * 2,
    pdf.internal.pageSize.getWidth() - margin_right,
    margin_top + margin_step * 2
  );

  const yOffset = margin_top + margin_step * 3;

  // Compute bounding box of seats
  const bbox = getSeatsBoundingBox(seats);
  if (!bbox) return;

  const scaleX = (pdfWidth - margin_left - margin_right) / bbox.width;
  const scaleY = (pdfHeight - yOffset - margin_bottom) / bbox.height;
  const scale = Math.min(scaleX, scaleY);

  // Draw each seat
  seats.forEach((s) => {
    const el = s.element;
    const nameDiv = el.querySelector(".seat-name");

    const seatX = (parseFloat(el.style.left) - bbox.minX) * scale + margin_left;
    const seatY = (parseFloat(el.style.top) - bbox.minY) * scale + yOffset;
    const seatWidth = el.offsetWidth * scale;
    const seatHeight = el.offsetHeight * scale;

    // Draw rectangle
    pdf.setFillColor(238, 238, 238);
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(seatX, seatY, seatWidth, seatHeight, "FD");

    // Center name text
    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    const text = nameDiv.textContent || "";
    pdf.text(text, seatX + seatWidth / 2, seatY + seatHeight / 2, {
      align: "center",
      baseline: "middle",
    });
  });

  // Footer
  // Add footer text dynamically with full URL of current page
  pdf.setFontSize(6);
  pdf.setTextColor(125, 125, 125);
  pdf.text(
    "Erstellt mit " + window.location.href,
    pdfWidth - margin_right,
    pdfHeight - margin_bottom,
    { align: "right" }
  );

  pdf.save(`Sitzplan_${className}_${dateFrom}.pdf`);
}

// Compute bounding box for seats
function getSeatsBoundingBox(seats) {
  if (!seats || seats.length === 0) return null;

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  seats.forEach((s) => {
    const el = s.element;
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
