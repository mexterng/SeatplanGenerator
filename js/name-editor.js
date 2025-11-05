var personDelimiter = ";"
var nameDelimiter = ","

window.addEventListener('DOMContentLoaded', () => {
    const { person, name } = JSON.parse(localStorage.getItem('delimiter'));
    const nameStr = localStorage.getItem('namesStr');
    personDelimiter = person;
    nameDelimiter = name;
    initRows(nameStr);
});

function initRows(names){
    const nameList = parseNames(names, personDelimiter, nameDelimiter);
    nameList.forEach((person) => {
        addRow(person.firstname, person.lastname);
    });
}

function addRow(firstname = '', lastname = ''){
    const tbody = document.querySelector('#nameTable tbody');
    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');

    tr.innerHTML = `
        <td>${rowCount}</td>
        <td><input type="text" class="firstName" placeholder="Vorname" value="${firstname}"></td>
        <td><input type="text" class="lastName" placeholder="Nachname" value="${lastname}"></td>
    `;
    tbody.appendChild(tr);
}

function confirm(){
    const rows = document.querySelectorAll('#nameTable tbody tr');
    const values = [];

    rows.forEach(row => {
        const first = row.querySelector('.firstName').value.trim();
        const last = row.querySelector('.lastName').value.trim();
        if (first && last == '') {
            values.push(`${first}`.trim());
        }
        else if (first || last) {
            values.push(`${last}${nameDelimiter} ${first}`.trim());
        }
    });

    const result = values.join(personDelimiter + ' ');

    if (window.opener && !window.opener.closed) {
        const mainInput = window.opener.document.getElementById('namesInput');
        if (mainInput) mainInput.value = result;
    } else {
        alert("Hauptseite nicht gefunden oder geschlossen.\n" +
            "Ergebnis:\n" +
            "\n---------------------------------\n" + 
            result + 
            "\n---------------------------------\n" +
            "\nKopiere den Text zwischen den Zeilen und füge diesen manuell ein.");
    }

    closeWindow();
}

function cancel(){
    closeWindow();
}

function closeWindow(){
    localStorage.removeItem('namesStr');
    window.close();
}