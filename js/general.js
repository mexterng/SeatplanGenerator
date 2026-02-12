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

// Parse input string of names with possible groups in []
function parseNames(namesInput, personDelimiter, nameDelimiter, lockedSeatTag) {
    const nameList = [];
    let buffer = "";
    let inGroup = false;

    for (let char of namesInput) {
        if (char === "[") {
            inGroup = true;
            buffer = "";
        } else if (char === "]") {
            inGroup = false;
            // parse group
            const groupEntries = buffer
                .split(personDelimiter)
                .map(n => n.trim())
                .filter(n => n.length > 0)
                .map(n => getNames(n, nameDelimiter, lockedSeatTag));
            nameList.push(groupEntries);
            buffer = "";
        } else {
            if (inGroup) {
                buffer += char;
            } else {
                if (char === personDelimiter) {
                    const entry = buffer.trim();
                    if (entry) nameList.push(getNames(entry, nameDelimiter, lockedSeatTag));
                    buffer = "";
                } else {
                    buffer += char;
                }
            }
        }
    }

    // add last entry if any
    if (buffer.trim()) {
        nameList.push(getNames(buffer.trim(), nameDelimiter, lockedSeatTag));
    }
    return nameList;
}

// Flatten nested arrays of name objects
function flattenNames(nameList) {
    if (Array.isArray(nameList)) {
        return nameList.flatMap(flattenNames);
    }
    return [nameList];
}