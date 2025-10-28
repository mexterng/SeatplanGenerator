# SeatplanGenerator
Ein interaktiver **Sitzplan-Generator** für Klassen, Veranstaltungen oder Meetings. Sitzplätze können visuell auf einem Canvas angeordnet, gespeichert und automatisch oder manuell mit Namen besetzt werden.

## Funktionen

- **Sitzplätze erstellen**: Anzahl der Sitzplätze über ein Eingabefeld festlegen und auf dem Canvas platzieren.
- **Drag & Drop**: Sitzplätze können frei (mit Einrastfunktion) auf einem 10px-Gitter verschoben werden.
- **Löschen**: Jeder Sitzplatz hat ein „×“-Symbol zum Entfernen.
- **Daten speichern**: Sitzplatzpositionen und Namen werden im lokalen Speicher (LocalStorage) gesichert, sodass die Daten beim nächsten Laden wiederhergestellt werden können.
- **Namen zuweisen**:
  - **Automatisch auslosen**: Namen zufällig auf die Sitzplätze verteilen.
  - **Übertragen**: Namen in der Reihenfolge der Eingabe den Sitzplätzen zuweisen.
- **Warnmeldungen**:
  - Weniger Namen als Sitzplätze → Bestätigung zum Fortfahren.
  - Mehr Namen als Sitzplätze → Warnung, dass nicht alle Personen einen Platz erhalten.
- **PDF-Export**: Sitzplan inklusive Namen, Klassenbezeichnung, Lehrkraft und Datum als DIN A4 PDF speichern.

## Installation

1. Repository klonen oder ZIP herunterladen.
2. `index.html` im Browser öffnen.
3. Kein Server erforderlich, reine HTML/CSS/JS-Lösung.

## Nutzung

1. Anzahl der Sitzplätze eingeben und auf **„Sitzplätze neu zeichnen“** klicken.
2. Namen kommagetrennt in das Eingabefeld **„Namen (semikolon-getrennt)“** eintragen:
   `Nachname, Vorname; nur_Nachname,; nur_Vorname`
4. Sitzplätze bei Bedarf per Drag & Drop verschieben.
5. Namen zuweisen:
   - **„Namen übertragen“** → Reihenfolge der Eingabe.
   - **„Sitzplätze auslosen“** → zufällige Verteilung.
6. Sitzplätze und Namen speichern.
7. PDF-Export über **„PDF Export“** nutzen.

[Ausführliche Anleitung](help.html)

## Dateien

- `index.html` – Hauptseite
- `styles.css` und `style_back.css` – Styling
- `script.js` – Logik für Sitzplätze, Drag & Drop, Speichern und Namen zuweisen
- `export.js` – Logik für PDF-Export
- `help.html` – Benutzungsanleitung

## Hinweise

- Alle Daten werden (bei manueller Speicherung) lokal im Browser gespeichert (`localStorage`).
- Desktop-Browser empfohlen, Drag & Drop auf mobilen Geräten teilweise eingeschränkt.
