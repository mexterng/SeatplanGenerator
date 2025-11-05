// Split fullname to lastname, firstname
function getNames(fullname, nameDelimiter) {
    const [lastname, firstname] = fullname.includes(nameDelimiter)
        ? fullname.split(nameDelimiter).map(n => n.trim())
        : ["", fullname];
    
    return { lastname, firstname };
}

// Parse input string of names
function parseNames(namesInput, personDelimiter, nameDelimiter) {
    let nameList = [];
    const inputSplit = namesInput.split(personDelimiter).map(n => n.trim()).filter(Boolean);
    inputSplit.forEach((item) => {
        nameList.push(getNames(item, nameDelimiter));
    });
    return nameList;
}