# SeatplanGenerator
Ein interaktiver **Sitzplan-Generator** für Veranstaltungen, Klassen oder Meetings. Mit dieser Webanwendung lassen sich Sitzplätze visuell auf einem Canvas anordnen, speichern und automatisch mit Namen besetzen.

## Funktionen

- **Sitzplätze erstellen**: Anzahl der Sitzplätze über ein Eingabefeld festlegen und auf dem Canvas platzieren.
- **Drag & Drop**: Sitzplätze können frei (mit Einrastfunktion) auf dem Canvas verschoben werden.
- **Löschen**: Jeder Sitzplatz hat ein „×“-Symbol zum Entfernen.
- **Daten speichern**: Sitzplatzpositionen und Namen werden im lokalen Speicher (LocalStorage) gesichert, sodass die Daten beim nächsten Laden wiederhergestellt werden können.
- **Namen zuweisen**: Namen (kommagetrennt) automatisch zufällig auf die Sitzplätze verteilen.
- **Warnungen**:
  - Wenn zu wenige Namen für die Sitzplätze vorhanden sind, wird der Nutzer gefragt, ob fortgefahren werden soll.
  - Wenn mehr Namen als Sitzplätze vorhanden sind, wird eine Warnung angezeigt.

## Installation

1. Repository klonen oder ZIP herunterladen.
2. `index.html` im Browser öffnen.
3. Es wird **kein Server benötigt**, reine HTML/CSS/JS-Lösung.

## Nutzung

1. Anzahl der Sitzplätze eingeben und auf „Sitzplätze neu zeichnen“ klicken.
2. Namen in das Eingabefeld „Namen (kommagetrennt)“ eintragen.
3. Sitzplätze bei Bedarf per Drag & Drop verschieben.
4. Sitzplätze und Namen speichern.
5. Mit „Auslosen“ die Namen zufällig den Sitzplätzen zuweisen.

## Dateien

- `index.html` – Hauptseite mit Steuerung und Canvas
- `styles.css` – Styling für Canvas, Buttons und Inputs
- `script.js` – Logik für Sitzplätze, Drag & Drop, Speichern und Namen zuweisen

## Design

- Moderne Buttons mit Farbverlauf (Primary und Secondary)  
- Blaues Farbkonzept für Input-Felder und Sitzplätze  
- Flexibles Layout, Canvas füllt automatisch den restlichen Platz im Browserfenster

## Hinweise

- Alle Daten werden lokal im Browser gespeichert (`localStorage`), es gibt keine serverseitige Speicherung.
- Die Anwendung funktioniert auf Desktop-Browsern am besten, da Drag & Drop auf mobilen Geräten eingeschränkt sein kann.
