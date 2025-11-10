// ===============================
// Export Module
// ===============================

// PDF margins
const margin_top = 25;
const margin_right = 15;
const margin_bottom = 10;
const margin_left = 15;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('exportBtn').addEventListener('click', openExportPopup);
});

// Close popup
function closeExportPopup() {
  document.getElementById("exportOverlay").style.display = "none";
}

// Open popup to collect export data
function openExportPopup() {
  // show and focus first input field
  document.getElementById("exportOverlay").style.display = "flex";
  document.getElementById("dateFrom").value = new Date().toLocaleDateString('en-CA');
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

// Rotate a point around center
function rotatePoint(x, y, cx, cy, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const nx = cos * (x - cx) - sin * (y - cy) + cx;
  const ny = sin * (x - cx) + cos * (y - cy) + cy;
  return { x: nx, y: ny };
}

function getRotatedCorners(x, y, width, height, rotationDeg) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  
  return [
    rotatePoint(x, y, cx, cy, rotationDeg), // top-left
    rotatePoint(x + width, y, cx, cy, rotationDeg), // top-right
    rotatePoint(x + width, y + height, cx, cy, rotationDeg), // bottom-right
    rotatePoint(x, y + height, cx, cy, rotationDeg) // bottom-left
  ];
}

// Draw rotated rectangle as polygon
function drawRotatedRect(pdf, x, y, width, height, rotationDeg, fillStyle, strokeStyle) {
  const corners = getRotatedCorners(x, y, width, height, rotationDeg);
  pdf.setFillColor(...fillStyle);
  pdf.setDrawColor(...strokeStyle);

  pdf.lines(
    [
      [corners[1].x - corners[0].x, corners[1].y - corners[0].y],
      [corners[2].x - corners[1].x, corners[2].y - corners[1].y],
      [corners[3].x - corners[2].x, corners[3].y - corners[2].y],
      [corners[0].x - corners[3].x, corners[0].y - corners[3].y],
    ],
    corners[0].x,
    corners[0].y,
    [1,1],
    "FD"
  );
}

function drawTextRotated(pdf, text, textX, textY, angleDeg, fontSize, originX, originY) {
  pdf.setFontSize(fontSize);
  const angle = -angleDeg * Math.PI / 180;
  const textWidth = pdf.getTextWidth(text);
  const textHeight = fontSize * 0.285;

  const leftCorner = {
    x: textX - textWidth / 2, 
    y: textY + textHeight / 2
  };
  
  // Translate to origin
  const translated = {
    x: leftCorner.x - originX, 
    y: leftCorner.y - originY
  };

  // Apply rotation
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const rotated = {
    x: translated.x * cos - translated.y * sin, 
    y: translated.x * sin + translated.y * cos
  };
  // Translate back and adjust to text center
  const finalPos = {
    x: rotated.x + originX + textWidth / 2, 
    y: rotated.y + originY - textHeight / 2
  };

  pdf.text(text, finalPos.x, finalPos.y, { 
      align: "center", 
      baseline: "middle",
      angle: -angleDeg
  });
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
  await registerCustomFont(pdf, "assets/fonts/NotoSans-Regular-normal_base64.txt" ,"NotoSans");
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
    const angle = parseFloat(el.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
    const seatWidth = el.offsetWidth * scale;
    const seatHeight = el.offsetHeight * scale;
    const centerX = seatX + seatWidth / 2;
    const centerY = seatY + seatHeight / 2;

    // Draw rotated rectangle
    drawRotatedRect(pdf, seatX, seatY, seatWidth, seatHeight, angle, [238,238,238], [0,0,0]);

    // Draw rotated text
    const firstnameDiv = el.querySelector('.seat-firstname');
    const lastnameDiv = el.querySelector('.seat-lastname');
    const firstname = firstnameDiv.textContent.trim() || "";
    const lastname = lastnameDiv.textContent.trim() || "";

    const firstnameFontSizePt = parseFloat(window.getComputedStyle(firstnameDiv).fontSize) * 0.753 * (scale / 0.285);
    const lastnameFontSizePt = parseFloat(window.getComputedStyle(lastnameDiv).fontSize) * 0.753 * (scale / 0.285);
    
    if (lastname === "") {
      drawTextRotated(pdf, firstname, centerX, centerY, angle, firstnameFontSizePt, centerX, centerY);
    }
    else if (firstname === "") {
      drawTextRotated(pdf, lastname, centerX, centerY, angle, lastnameFontSizePt, centerX, centerY);
    }
    else{
      const lastnameHeight = lastnameFontSizePt * 25.4 / 72 * 1.5;
      drawTextRotated(pdf, firstname, centerX, centerY - 3 * lastnameHeight / 8, angle, firstnameFontSizePt, centerX, centerY);
      drawTextRotated(pdf, lastname, centerX, centerY + 5 * lastnameHeight / 8, angle, lastnameFontSizePt, centerX, centerY);
    }
  });

  // Draw all fixed elements
  const fixedElements = document.querySelectorAll('#canvas .fixed-element');
  fixedElements.forEach((el) => {
    const elemX = (parseFloat(el.style.left) - bbox.minX) * scale + margin_left;
    const elemY = (parseFloat(el.style.top) - bbox.minY) * scale + yOffset;
    const angle = parseFloat(el.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
    const elemWidth = el.offsetWidth * scale;
    const elemHeight = el.offsetHeight * scale;
    const centerX = elemX + elemWidth / 2;
    const centerY = elemY + elemHeight / 2;

    // Draw rotated rectangle
    drawRotatedRect(pdf, elemX, elemY, elemWidth, elemHeight, angle, [198,198,198], [0,0,0]);

    // Draw rotated text
    const elemNameDiv = el.querySelector('#fixed-name');
    const elemName = elemNameDiv.textContent.trim() || "";

    const elemNameFontSizePt = parseFloat(window.getComputedStyle(elemNameDiv).fontSize) * 0.753 * (scale / 0.285);
    
    drawTextRotated(pdf, elemName, centerX, centerY, angle, elemNameFontSizePt, centerX, centerY);
  });

  // Footer
  // Add footer text dynamically with full URL of current page
  pdf.setFontSize(6);
  pdf.setTextColor(125, 125, 125);
  pdf.text(
    "Erstellt mit " + window.location.href,
    pdfWidth - margin_right,
    pdfHeight - margin_bottom + 1,
    { baseline: "top", align: "right"}
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
    const rotation = parseFloat(el.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);

    const corners = getRotatedCorners(x, y, w, h, rotation);

    corners.forEach(corner => {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    });
  });

  const fixedElements = document.querySelectorAll('#canvas .fixed-element');
  fixedElements.forEach((el) => {
    const x = parseFloat(el.style.left);
    const y = parseFloat(el.style.top);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const rotation = parseFloat(el.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);

    const corners = getRotatedCorners(x, y, w, h, rotation);

    corners.forEach(corner => {
      minX = Math.min(minX, corner.x);
      minY = Math.min(minY, corner.y);
      maxX = Math.max(maxX, corner.x);
      maxY = Math.max(maxY, corner.y);
    });
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
