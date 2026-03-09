// ============================================
// File: ui/export-pdf.js
// ============================================

/**
 * Provides vector-based PDF export for the seating plan.
 * Responsibilities:
 * - Handle export popup interactions
 * - Calculate rotated bounding boxes
 * - Render seats and fixed elements into a vector PDF
 * - Register and apply custom fonts
 */

// ============================================
// IMPORTS
// ============================================

import { state } from '../state.js';
import { openModal } from '../ui/modal-manager.js';

// ============================================
// FILE LOCAL CONSTANTS
// ============================================

const PDF_MARGIN_TOP = 25;
const PDF_MARGIN_RIGHT = 15;
const PDF_MARGIN_BOTTOM = 10;
const PDF_MARGIN_LEFT = 15;

// ============================================
// PUBLIC EXPORT FUNCTION
// ============================================

/**
 * Exports the current seating plan as vector PDF.
 *
 * @param {string} className - Name of the class.
 * @param {string} dateFrom - Start date (YYYY-MM-DD).
 * @param {string} dateTo - End date (YYYY-MM-DD).
 * @param {string} teacherName - Name of the teacher.
 * @returns {Promise<void>}
 */
export async function exportSeatsVectorPDF(className, dateFrom, dateTo, teacherName) {
    if (!state.seats?.length) {
        await showError('Keine Sitzplätze vorhanden!');
        return;
    }

    const dateFromStr = formatDateToDDMMYYYY(dateFrom);
    const dateToStr = formatDateToDDMMYYYY(dateTo);

    const jsPDF = await _loadJsPDF();

    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const step = 7;

    await registerCustomFont(pdf, './../../assets/fonts/NotoSans-Regular-normal_base64.txt', 'NotoSans');

    pdf.setFontSize(12);

    // ===== Header =====
    pdf.text(`Klasse: ${className}`, PDF_MARGIN_LEFT, PDF_MARGIN_TOP);
    pdf.text(`Lehrkraft: ${teacherName}`, PDF_MARGIN_LEFT, PDF_MARGIN_TOP + step);
    pdf.text(`Stand: ${dateFromStr}`, pdfWidth - PDF_MARGIN_RIGHT, PDF_MARGIN_TOP, { align: 'right' });
    pdf.text(`Gültig bis: ${dateToStr}`, pdfWidth - PDF_MARGIN_RIGHT, PDF_MARGIN_TOP + step, { align: 'right' });

    pdf.setLineWidth(0.2);
    pdf.setDrawColor(0, 0, 0);
    pdf.line(PDF_MARGIN_LEFT, PDF_MARGIN_TOP + step * 2, pdfWidth - PDF_MARGIN_RIGHT, PDF_MARGIN_TOP + step * 2);

    const yOffset = PDF_MARGIN_TOP + step * 3;
    const bbox = getSeatsBoundingBox(state.seats);
    if (!bbox) return;

    const scaleX = (pdfWidth - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT) / bbox.width;
    const scaleY = (pdfHeight - yOffset - PDF_MARGIN_BOTTOM) / bbox.height;

    const scale = Math.min(scaleX, scaleY);

    drawSeatsToPDF(pdf, bbox, scale, yOffset);
    drawFixedElementsToPDF(pdf, bbox, scale, yOffset);

    // ===== Footer =====
    pdf.setFontSize(6);
    pdf.setTextColor(125, 125, 125);
    pdf.text(`Erstellt mit ${window.location.href}`, pdfWidth - PDF_MARGIN_RIGHT, pdfHeight - PDF_MARGIN_BOTTOM + 1, { baseline: 'top', align: 'right' });

    pdf.save(`Sitzplan_${className}_${dateFrom}.pdf`);
}

/**
 * Dynamically load jsPDF UMD and return the jsPDF constructor.
 * @returns {Promise<function>} jsPDF constructor
 */
function _loadJsPDF() {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);

        const script = document.createElement('script');
        script.src = './../../libs/jspdf.umd.min.js';
        script.onload = () => {
            if (window.jspdf && window.jspdf.jsPDF) {
                resolve(window.jspdf.jsPDF);
            } else {
                reject(new Error('jsPDF did not initialize correctly.'));
            }
        };
        script.onerror = () => reject(new Error('Failed to load jsPDF.'));
        document.head.appendChild(script);
    });
}

// ============================================
// UI HANDLER
// ============================================

/**
 * Opens a modal popup for exporting seat assignments as a PDF.
 * Collects the class, date range, and teacher from user input
 * and triggers the PDF export process.
 *
 * @returns {void}
 */
export async function openExportPopup() {

    const content = `
        <div class="flex flex-col gap-4">
            <label>Klasse:<br><input id="className" class="w-full"></label>
            <label>Stand:<br><input id="dateFrom" type="date" class="w-full"></label>
            <label>Gültig bis:<br><input id="dateTo" type="date" class="w-full"></label>
            <label>Lehrkraft:<br><input id="teacherName" class="w-full"></label>
        </div>
    `;

    const result = await openModal({
        title: "PDF Export",
        content,
        buttons: [
            { label: "Abbrechen", value: null, className: "btn-secondary" },
            { label: "Exportieren", value: "export", className: "btn-primary" }
        ],
        onOpen: (modal) => {
            modal.querySelector("#dateFrom").value = new Date().toLocaleDateString('en-CA');
        },
        onSubmit: (modal) => ({
            className: modal.querySelector("#className").value ?? "",
            dateFrom: modal.querySelector("#dateFrom").value ?? "",
            dateTo: modal.querySelector("#dateTo").value ?? "",
            teacher: modal.querySelector("#teacherName").value ?? ""
        })
    });

    if (!result) return;

    exportSeatsVectorPDF(result.className, result.dateFrom, result.dateTo, result.teacher);
}

// ============================================
// PDF DRAWING HELPERS
// ============================================

/**
 * Draws all seat elements into the PDF.
 *
 * @param {jsPDF} pdf - jsPDF instance.
 * @param {Object} bbox - Bounding box.
 * @param {number} scale - Scale factor.
 * @param {number} yOffset - Vertical offset.
 * @returns {void}
 */
function drawSeatsToPDF(pdf, bbox, scale, yOffset) {
    state.seats.forEach(s => {
        const el = s.element;

        const seatX = (parseFloat(el.style.left) - bbox.minX) * scale + PDF_MARGIN_LEFT;

        const seatY = (parseFloat(el.style.top) - bbox.minY) * scale + yOffset;

        const angle = extractRotation(el);
        const sw = el.offsetWidth * scale;
        const sh = el.offsetHeight * scale;

        const cx = seatX + sw / 2;
        const cy = seatY + sh / 2;

        drawRotatedRect(pdf, seatX, seatY, sw, sh, angle, [238, 238, 238], [0, 0, 0]);

        drawSeatText(pdf, el, cx, cy, angle, scale);
    });
}

/**
 * Draws all fixed elements into the PDF.
 *
 * @param {jsPDF} pdf - jsPDF instance.
 * @param {Object} bbox - Bounding box.
 * @param {number} scale - Scale factor.
 * @param {number} yOffset - Vertical offset.
 * @returns {void}
 */
function drawFixedElementsToPDF(pdf, bbox, scale, yOffset) {
    document
        .querySelectorAll('#canvas .fixed-element')
        .forEach(el => {
            const ex = (parseFloat(el.style.left) - bbox.minX) * scale + PDF_MARGIN_LEFT;

            const ey = (parseFloat(el.style.top) - bbox.minY) * scale + yOffset;

            const angle = extractRotation(el);
            const ew = el.offsetWidth * scale;
            const eh = el.offsetHeight * scale;

            const cx = ex + ew / 2;
            const cy = ey + eh / 2;

            drawRotatedRect(pdf, ex, ey, ew, eh, angle, [198, 198, 198], [0, 0, 0]);

            const nameDiv = el.querySelector('#fixed-name');
            const name = nameDiv?.textContent.trim() || '';

            const nameSize = parseFloat(window.getComputedStyle(nameDiv).fontSize) * 0.753 * (scale / 0.285);

            drawTextRotated(pdf, name, cx, cy, angle, nameSize, cx, cy);
        });
}

// ============================================
// GEOMETRY & TEXT HELPERS
// ============================================

/**
 * Formats date string (YYYY-MM-DD) to DD.MM.YYYY.
 *
 * @param {string} dateString - Input date string.
 * @returns {string} Formatted date or placeholder.
 */
function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '                  ';

    const [year, month, day] = dateString.split('-');
    return `${day}.${month}.${year}`;
}

/**
 * Extracts rotation angle from element transform style.
 *
 * @param {HTMLElement} el - DOM element.
 * @returns {number} Rotation in degrees.
 */
function extractRotation(el) {
    return parseFloat(el.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
}

/**
 * Calculates bounding box including rotated seats and fixed elements.
 *
 * @param {Array} seatList - Array of seat objects.
 * @returns {Object|null} Bounding box or null if empty.
 */
function getSeatsBoundingBox(seatList) {
    if (!seatList?.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const processEl = el => {
        const x = parseFloat(el.style.left);
        const y = parseFloat(el.style.top);
        const rot = extractRotation(el);

        getRotatedCorners(x, y, el.offsetWidth, el.offsetHeight, rot
        ).forEach(c => {
            minX = Math.min(minX, c.x);
            minY = Math.min(minY, c.y);
            maxX = Math.max(maxX, c.x);
            maxY = Math.max(maxY, c.y);
        });
    };

    seatList.forEach(s => processEl(s.element));

    document
        .querySelectorAll('#canvas .fixed-element')
        .forEach(processEl);

    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Rotates a point around a center.
 *
 * @param {number} x - X coordinate.
 * @param {number} y - Y coordinate.
 * @param {number} cx - Center X.
 * @param {number} cy - Center Y.
 * @param {number} angleDeg - Rotation in degrees.
 * @returns {{x:number,y:number}} Rotated point.
 */
function rotatePoint(x, y, cx, cy, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return {
        x: cos * (x - cx) - sin * (y - cy) + cx,
        y: sin * (x - cx) + cos * (y - cy) + cy
    };
}

/**
 * Returns rotated rectangle corner points.
 *
 * @param {number} x - Top-left X.
 * @param {number} y - Top-left Y.
 * @param {number} width - Width.
 * @param {number} height - Height.
 * @param {number} rotationDeg - Rotation.
 * @returns {Array} Corner points.
 */
function getRotatedCorners(x, y, width, height, rotationDeg) {
    const cx = x + width / 2;
    const cy = y + height / 2;

    return [
        rotatePoint(x, y, cx, cy, rotationDeg),
        rotatePoint(x + width, y, cx, cy, rotationDeg),
        rotatePoint(x + width, y + height, cx, cy, rotationDeg),
        rotatePoint(x, y + height, cx, cy, rotationDeg)
    ];
}

/**
 * Draws a rotated rectangle into PDF.
 *
 * @returns {void}
 */
function drawRotatedRect(pdf, x, y, width, height, rotationDeg, fillStyle, strokeStyle) {
    const corners = getRotatedCorners(x, y, width, height, rotationDeg);

    pdf.setFillColor(...fillStyle);
    pdf.setDrawColor(...strokeStyle);

    pdf.lines(
        [
            [
                corners[1].x - corners[0].x,
                corners[1].y - corners[0].y
            ],
            [
                corners[2].x - corners[1].x,
                corners[2].y - corners[1].y
            ],
            [
                corners[3].x - corners[2].x,
                corners[3].y - corners[2].y
            ],
            [
                corners[0].x - corners[3].x,
                corners[0].y - corners[3].y
            ]
        ],
        corners[0].x,
        corners[0].y,
        [1, 1],
        'FD'
    );
}

/**
 * Draws rotated text centered on a point.
 *
 * @returns {void}
 */
function drawTextRotated(pdf, text, textX, textY, angleDeg, fontSize, originX, originY) {
    pdf.setFontSize(fontSize);

    const angle = (-angleDeg * Math.PI) / 180;
    const textWidth = pdf.getTextWidth(text);
    const textHeight = fontSize * 0.285;

    // Calculate top-left corner before rotation
    const leftCorner = {
        x: textX - textWidth / 2,
        y: textY + textHeight / 2
    };

    const translated = {
        x: leftCorner.x - originX,
        y: leftCorner.y - originY
    };

    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    const rotated = {
        x: translated.x * cos - translated.y * sin,
        y: translated.x * sin + translated.y * cos
    };

    const finalPos = {
        x: rotated.x + originX + textWidth / 2,
        y: rotated.y + originY - textHeight / 2
    };

    pdf.text(text, finalPos.x, finalPos.y, {
        align: 'center',
        baseline: 'middle',
        angle: -angleDeg
    });
}

/**
 * Draws first and last name inside a seat.
 *
 * @returns {void}
 */
function drawSeatText(pdf, el, cx, cy, angle, scale) {
    const fnDiv = el.querySelector('.seat-firstname');
    const lnDiv = el.querySelector('.seat-lastname');

    const fn = fnDiv.textContent.trim();
    const ln = lnDiv.textContent.trim();

    const fnSize = parseFloat(window.getComputedStyle(fnDiv).fontSize) * 0.753 * (scale / 0.285);
    const lnSize = parseFloat(window.getComputedStyle(lnDiv).fontSize) * 0.753 * (scale / 0.285);

    if (!fn && !ln) return;

    if (!ln) {
        drawTextRotated(pdf, fn, cx, cy, angle, fnSize, cx, cy);
        return;
    }

    if (!fn) {
        drawTextRotated(pdf, ln, cx, cy, angle, lnSize, cx, cy);
        return;
    }

    const lnH = (lnSize * 25.4) / 72 * 1.5;

    drawTextRotated(
        pdf,
        fn,
        cx,
        cy - (3 * lnH) / 8,
        angle,
        fnSize,
        cx,
        cy
    );

    drawTextRotated(
        pdf,
        ln,
        cx,
        cy + (5 * lnH) / 8,
        angle,
        lnSize,
        cx,
        cy
    );
}

/**
 * Registers a custom base64 font in jsPDF.
 *
 * @param {jsPDF} doc - jsPDF instance.
 * @param {string} base64Filepath - Path to base64 font file.
 * @param {string} fontName - Internal font name.
 * @returns {Promise<void>}
 */
async function registerCustomFont(doc, base64Filepath, fontName = 'CustomFont') {
    const response = await fetch(base64Filepath);

    if (!response.ok) {
        throw new Error(`Font nicht gefunden: ${response.status}`);
    }

    const fontBase64 = await response.text();

    doc.addFileToVFS(`${fontName}.ttf`, fontBase64);
    doc.addFont(`${fontName}.ttf`, fontName, 'normal');
    doc.setFont(fontName);
}