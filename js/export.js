// ===============================
// Export Module
// ===============================

// PDF margins
const margin_top = 25;
const margin_right = 15;
const margin_bottom = 10;
const margin_left = 15;

// Close popup
function closeExportPopup() {
  document.getElementById("exportOverlay").style.display = "none";
}

// Open popup to collect export data
function openExportPopup() {
  // show and focus first input field
  document.getElementById("exportOverlay").style.display = "flex";
  document.getElementById("className").focus();

  // Cancel button
  document.getElementById("cancelExportBtn").addEventListener("click", closeExportPopup);

  // ESC-key
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && document.getElementById("exportOverlay").style.display !== "none") {
      closeExportPopup();
    }
  });

  // Export button
  document.getElementById("exportPdfBtn").addEventListener("click", () => {
    const className = document.getElementById("className").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;
    const teacherName = document.getElementById("teacherName").value;

    exportSeatsVectorPDF(className, dateFrom, dateTo, teacherName);
    closeExportPopup();
  });
}

// Format date string to DD.MM.YYYY
function formatDateToDDMMYYYY(dateString) {
  if (!dateString) return "                  ";
  const [year, month, day] = dateString.split("-");
  return `${day}.${month}.${year}`;
}

// Export seats as vector PDF
async function exportSeatsVectorPDF(className, dateFrom, dateTo, teacherName) {
  const dateFrom_str = formatDateToDDMMYYYY(dateFrom);
  const dateTo_str = formatDateToDDMMYYYY(dateTo);
  if (!seats || seats.length === 0) {
    alert("Keine Sitzplätze vorhanden!");
    return;
  }
  
  // DIN A4 Landscape in mm
  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  // Header
  await registerCustomFont(pdf, "./../assets/fonts/NotoSans-Regular-normal_base64.txt" ,"NotoSans");
  pdf.setFontSize(12);
  const margin_step = 7;
  pdf.text(
    `Klasse: ${className}`, 
    margin_left, 
    margin_top + margin_step * 0
  );
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

    const seatX = (parseFloat(el.style.left) - bbox.minX) * scale + margin_left;
    const seatY = (parseFloat(el.style.top) - bbox.minY) * scale + yOffset;
    const seatWidth = el.offsetWidth * scale;
    const seatHeight = el.offsetHeight * scale;

    // Draw rectangle
    pdf.setFillColor(238, 238, 238);
    pdf.setDrawColor(0, 0, 0);
    pdf.rect(seatX, seatY, seatWidth, seatHeight, "FD");

    // Center name text
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    const firstnameDiv = el.querySelector('.seat-firstname');
    const lastnameDiv = el.querySelector('.seat-lastname');
    const firstname = firstnameDiv.textContent.trim() || "";
    const lastname = lastnameDiv.textContent.trim() || "";

    // Get font size
    const firstnameFontSizePt = parseFloat(window.getComputedStyle(firstnameDiv).fontSize) * 0.753 * (scale / 0.285);
    const lastnameFontSizePt = parseFloat(window.getComputedStyle(lastnameDiv).fontSize) * 0.753 * (scale / 0.285);

    const centerX = seatX + seatWidth / 2;
    const centerY = seatY + seatHeight / 2;

    const style = { align: "center", baseline: "middle" };
    
    if (lastname === "") {
      pdf.setFontSize(firstnameFontSizePt);
      pdf.text(firstname, centerX, centerY, style);
    }
    else if (firstname === "") {
      pdf.setFontSize(lastnameFontSizePt);
      pdf.text(lastname, centerX, centerY, style);
    }
    else{
      const lastnameHeight = lastnameFontSizePt * 25.4 / 72 * 1.5;
      pdf.setFontSize(firstnameFontSizePt);
      pdf.text(firstname, centerX, centerY - 3 * lastnameHeight / 8, style);
      pdf.setFontSize(lastnameFontSizePt);
      pdf.text(lastname, centerX, centerY + 5 * lastnameHeight / 8, style);
    }
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

async function registerCustomFont(doc, base64Filepath, fontName = "CustomFont") {
  const response = await fetch(base64Filepath);
  const fontBase64 = await response.text();
  doc.addFileToVFS(`${fontName}.ttf`, fontBase64);
  doc.addFont(`${fontName}.ttf`, fontName, "normal");
  doc.setFont(fontName);
}
