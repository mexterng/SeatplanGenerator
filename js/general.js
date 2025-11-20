// Split fullname to lastname, firstname
function getNames(fullname, nameDelimiter, lockedSeatTag) {
    const [name, lockedSeat] = fullname.endsWith(lockedSeatTag)
        ? [fullname.slice(0, -1), true]
        : [fullname, false];
    const [lastname, firstname] = name.includes(nameDelimiter)
        ? name.split(nameDelimiter).map(n => n.trim())
        : ["", name];
    
    return { lastname, firstname , lockedSeat};
}

// Parse input string of names
function parseNames(namesInput, personDelimiter, nameDelimiter, lockedSeatTag) {
    let nameList = [];
    const inputSplit = namesInput.split(personDelimiter).map(n => n.trim()).filter(Boolean);
    inputSplit.forEach((item) => {
        nameList.push(getNames(item, nameDelimiter, lockedSeatTag));
    });
    return nameList;
}