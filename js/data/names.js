// ============================================
// File: data/names.js
// ============================================

/**
 * Provides functions for parsing names, shuffling, and assigning them to seats.
 *
 * Responsibilities:
 * - Parse individual and grouped names from input
 * - Flatten nested name arrays
 * - Shuffle names while respecting locked seats
 * - Assign names to seats with optional backtracking
 */

// ============================================
// IMPORTS
// ============================================

import { DOM } from '../dom.js';
import { state, PERSON_DELIMITER, NAME_DELIMITER, LOCKED_SEAT_TAG } from '../state.js';

// ============================================
// FILE-LOCAL CONSTANTS
// ============================================

// No additional constants required for this module

// ============================================
// PUBLIC HANDLER — NAME PARSING
// ============================================

/**
 * Splits a fullname string into lastname, firstname, and lockedSeat flag.
 *
 * @param {string} fullname - Full name string
 * @param {string} nameDelimiter - Delimiter between lastname and firstname
 * @param {string} lockedSeatTag - Suffix indicating seat is locked
 * @returns {Object} Object with {lastname, firstname, lockedSeat}
 */
export function getNames(fullname, nameDelimiter = NAME_DELIMITER, lockedSeatTag = LOCKED_SEAT_TAG) {
    const [name, lockedSeat] = fullname.endsWith(lockedSeatTag)
        ? [fullname.slice(0, -1), true]
        : [fullname, false];
    const [lastname, firstname] = name.includes(nameDelimiter)
        ? name.split(nameDelimiter).map(n => n.trim())
        : ['', name];
    return { lastname, firstname, lockedSeat };
}

/**
 * Parses an input string containing individual or grouped names.
 *
 * @param {string} namesInput - Raw names input
 * @param {string} personDelimiter - Separator between names
 * @param {string} nameDelimiter - Separator between lastname and firstname
 * @param {string} lockedSeatTag - Suffix indicating locked seats
 * @returns {Array} Nested array of parsed name objects
 */
export function parseNames(namesInput, personDelimiter = PERSON_DELIMITER, nameDelimiter = NAME_DELIMITER, lockedSeatTag = LOCKED_SEAT_TAG) {
    const nameList = [];
    let buffer = '';
    let inGroup = false;

    for (const char of namesInput) {
        if (char === '[') {
            inGroup = true;
            buffer = '';
        } else if (char === ']') {
            inGroup = false;
            const groupEntries = buffer
                .split(personDelimiter)
                .map(n => n.trim())
                .filter(n => n.length > 0)
                .map(n => getNames(n, nameDelimiter, lockedSeatTag));
            nameList.push(groupEntries);
            buffer = '';
        } else if (inGroup) {
            buffer += char;
        } else if (char === personDelimiter) {
            const entry = buffer.trim();
            if (entry) nameList.push(getNames(entry, nameDelimiter, lockedSeatTag));
            buffer = '';
        } else {
            buffer += char;
        }
    }

    if (buffer.trim()) {
        nameList.push(getNames(buffer.trim(), nameDelimiter, lockedSeatTag));
    }

    return nameList;
}

/**
 * Flattens nested arrays of names into a single array.
 *
 * @param {Array} nameList - Nested name arrays
 * @returns {Array} Flattened name objects array
 */
export function flattenNames(nameList) {
    return Array.isArray(nameList) ? nameList.flatMap(flattenNames) : [nameList];
}

// ============================================
// PRIVATE HANDLER — SHUFFLE
// ============================================

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 *
 * @param {Array} arr - Array to shuffle
 * @returns {Array} Shuffled copy of array
 */
function _shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

/**
 * Shuffles names that are not locked, preserving locked seats.
 *
 * @param {Array} array - Array of name objects
 * @returns {Array} New array with non-locked names shuffled
 */
export function shuffleNamesWithoutPairs(array) {
    const result = [...array];
    const freeItems = _shuffle(result.filter(item => !item.lockedSeat));
    let freeIdx = 0;
    result.forEach((item, i) => {
        if (!item.lockedSeat) result[i] = freeItems[freeIdx++];
    });
    return result;
}

// ============================================
// PUBLIC HANDLER — SEAT ASSIGNMENT
// ============================================

/**
 * Assigns names to seats, optionally shuffling with or without backtracking.
 *
 * @param {boolean} doShuffle - Whether to shuffle names
 * @returns {Promise<void>}
 */
export async function assignNames(doShuffle = false) {
    const nameListNested = parseNames(
        DOM.namesInput.value,
        PERSON_DELIMITER,
        NAME_DELIMITER,
        LOCKED_SEAT_TAG
    );
    const nameList = nameListNested.flatMap(flattenNames);

    if (!nameList[0] || nameList[0].firstname === '' || state.seats.length === 0) {
        alert('Keine Namen oder Sitzplätze zum Zuordnen!');
        return;
    }

    if (nameList.length < state.seats.length) {
        if (!confirm(`Achtung: Es werden nicht alle Sitzplätze besetzt werden. Es gibt ${state.seats.length} Sitzplätze, aber nur ${nameList.length} Personen. Fortfahren?`)) return;
    }
    if (nameList.length > state.seats.length) {
        alert(`Achtung: Es fehlen ${nameList.length - state.seats.length} Sitzplätze.`);
        return;
    }

    // Fill missing slots with empty names
    const fullNameList = [...nameList];
    while (fullNameList.length < state.seats.length) {
        fullNameList.push(getNames('', NAME_DELIMITER, LOCKED_SEAT_TAG));
    }

    let shuffledNames = fullNameList;
    if (doShuffle) {
        if (!nameListNested.some(item => Array.isArray(item))) {
            shuffledNames = shuffleNamesWithoutPairs(fullNameList);
        } else {
            const edges = getNormalizedSeatConnectionSet(state.seats);
            const solution = generateSeatAssignmentBacktracking(nameListNested, edges, state.seats.length, NAME_DELIMITER, LOCKED_SEAT_TAG);
            if (solution) {
                shuffledNames = solution;
            } else {
                alert('Achtung: Es kann keine gültige Besetzung gefunden werden. Beachten Sie vorgegebene Sitznachbarn und als benachbart gekennzeichnete Sitzplätze.');
                return;
            }
        }
    }

    if (document.getElementById('countdown-checkbox').checked) {
        await showCountdown(5);
    }

    state.seats.forEach((s, i) => {
        s.element.querySelector('.seat-firstname').textContent = shuffledNames[i].firstname;
        s.element.querySelector('.seat-lastname').textContent = shuffledNames[i].lastname;
    });

    _toggleClearCreateSeatsButton(true);
}

/**
 * Clears all assigned names from seats.
 *
 * @returns {void}
 */
export function clearSeats() {
    state.seats.forEach(s => {
        s.element.querySelector('.seat-firstname').textContent = '';
        s.element.querySelector('.seat-lastname').textContent = '';
    });

    _toggleClearCreateSeatsButton(false);
}

/**
 * Toggles visibility of clear and create seat buttons depending on assignment state.
 *
 * @param {boolean} namesAssigned - Whether names have been assigned
 * @returns {void}
 */
function _toggleClearCreateSeatsButton(namesAssigned) {
    const createBtn = document.getElementById('create-seats-btn');
    const clearBtn = document.getElementById('clear-seats-btn');

    clearBtn.style.display = namesAssigned ? 'flex' : 'none';
    createBtn.style.display = namesAssigned ? 'none' : 'flex';
}

// ============================================
// PUBLIC HANDLER — BACKTRACKING ALGORITHM
// ============================================

/**
 * Generates seat assignment using backtracking to satisfy adjacency/group constraints.
 *
 * @param {Array} persons - Nested array of person objects or groups
 * @param {Array} edges - Array of seat adjacency pairs
 * @param {number} seatCount - Total number of seats
 * @param {string} nameDelimiter - Delimiter between lastname and firstname
 * @param {string} lockedSeatTag - Suffix indicating locked seats
 * @returns {Array|null} Assigned seat array or null if impossible
 */
export function generateSeatAssignmentBacktracking(persons, edges, seatCount, nameDelimiter, lockedSeatTag) {
    const edgePairs = edges.map(([a, b]) => [a - 1, b - 1]);

    let idCounter = 0;
    const flatPersons = [];
    const clusterIds = [];
    const clusterMap = {};

    persons.forEach((p, idx) => {
        if (Array.isArray(p)) {
            clusterIds.push(idx);
            clusterMap[idx] = [];
            p.forEach(sub => {
                const obj = { ...sub, cluster: idx, _pid: idCounter++ };
                flatPersons.push(obj);
                clusterMap[idx].push(obj);
            });
        } else {
            flatPersons.push({ ...p, cluster: null, _pid: idCounter++ });
        }
    });

    const shuffledClusters = _shuffle(clusterIds);
    const seatSlots = Array(seatCount).fill(null);

    flatPersons.forEach((p, idx) => {
        if (p.lockedSeat) seatSlots[idx] = p;
    });

    function placeCluster(idx, edgesList) {
        if (idx >= shuffledClusters.length) return true;

        const cid = shuffledClusters[idx];
        const members = _shuffle(clusterMap[cid]);
        const edgesShuffled = _shuffle(edgesList);

        for (let e = 0; e < edgesShuffled.length; e++) {
            const [s1, s2] = edgesShuffled[e];
            if (seatSlots[s1] !== null || seatSlots[s2] !== null) continue;

            seatSlots[s1] = members[0];
            seatSlots[s2] = members[1];

            const rest = edgesShuffled.filter((_, i) => i !== e);
            if (placeCluster(idx + 1, rest)) return true;

            seatSlots[s1] = null;
            seatSlots[s2] = null;
        }
        return false;
    }

    if (!placeCluster(0, _shuffle(edgePairs))) return null;

    const usedIds = new Set(seatSlots.filter(Boolean).map(s => s._pid));
    const remaining = _shuffle(flatPersons.filter(p => !usedIds.has(p._pid)));
    const freeSlots = _shuffle(seatSlots.map((s, i) => s === null ? i : null).filter(i => i !== null));

    remaining.forEach((p, i) => { seatSlots[freeSlots[i]] = p; });

    const dummy = getNames('', nameDelimiter, lockedSeatTag);
    return seatSlots.map(s => s ?? { ...dummy });
}

// ============================================
// PUBLIC HANDLER — SEAT CONNECTIONS NORMALIZATION
// ============================================

/**
 * Converts seat connections to normalized 1-based IDs for backtracking algorithm.
 *
 * @param {Array} seats - Array of seat objects
 * @returns {Array} Array of seat ID pairs
 */
export function getNormalizedSeatConnectionSet(seats) {
    const ids = seats.map(s => s.id);
    const sortedIds = [...ids].sort((a, b) => Number(a) - Number(b));
    const idMap = Object.fromEntries(sortedIds.map((id, i) => [id, (i + 1).toString()]));

    return Array.from(state.seatConnectionSet).map(edge => {
        const [a, b] = edge.split('-');
        return [idMap[a], idMap[b]];
    });
}

// ============================================
// PUBLIC HANDLER — COUNTDOWN
// ============================================

/**
 * Displays a countdown overlay before assigning seats.
 *
 * @param {number} time - Countdown seconds
 * @returns {Promise<void>} Resolves when countdown ends
 */
export function showCountdown(time) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.id = 'countdown-overlay';
        overlay.textContent = time;
        document.body.appendChild(overlay);

        let count = time;
        const interval = setInterval(() => {
            count--;
            if (count > 0) {
                overlay.textContent = count;
            } else {
                clearInterval(interval);
                overlay.remove();
                resolve();
            }
        }, 1000);
    });
}