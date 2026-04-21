// ============================================
// File: data/seatplan-model.js
// ============================================

/**
 * Seatplan JSON handling module
 *
 * Responsibilities:
 * - Define JSON schema versions
 * - Provide factory functions (UI + SG)
 * - Parse raw input (string | JSON | prefixed JSON)
 * - Validate + migrate JSON structures
 * - Normalize all inputs into UIjson format
 *
 * Design principle:
 * => Always return a valid UIjson object to the UI layer
 */

// ============================================
// IMPORTS
// ============================================

import { DOM } from '../dom.js';
import { state, SYMBOLS } from '../state.js';
import { showConfirm, showError } from '../ui/modal-template.js';


// ============================================
// CONSTANTS
// ============================================

const UI_JSON_VERSION = 1;
const SG_JSON_VERSION = 1;

export const JSON_PREFIX = "SitzplanGeneratorJSON";

// ============================================
// FACTORY FUNCTIONS (PUBLIC API)
// ============================================

/**
 * Create UI JSON root object
 *
 * @param {Array} entries - UI entries (single | pair)
 * @returns {Object}
 */
export function createUIjson(entries) {
    return {
        entries,
        type: "UIjson",
        version: UI_JSON_VERSION,
    };
}

/**
 * Create SeatGenerator JSON root object
 *
 * @param {Array} persons
 * @param {Array} seats
 * @param {Array} adjacency
 * @param {Array} constraints
 * @returns {Object}
 */
export function createSGjson(persons = [], seats = [], adjacency = [], constraints = []) {
    return {
        persons,
        seats,
        adjacency,
        constraints,
        type: "SGjson",
        version: SG_JSON_VERSION,
    };
}


// ============================================
// SERIALIZATION
// ============================================

/**
 * Serialize JSON into prefixed string format
 *
 * @param {Object} json
 * @param {boolean} linebreak
 * @returns {string}
 */
export function jsonToString(json, linebreak = true) {
    return linebreak
        ? `${JSON_PREFIX} v${json.version}:\n${JSON.stringify(json, null, 2)}`
        : `${JSON_PREFIX} v${json.version}: ${JSON.stringify(json)}`;
}

// ============================================
// IMPORT PIPELINE (CORE LOGIC)
// ============================================

/**
 * Parses arbitrary input into a normalized UIjson object.
 *
 * Supports:
 * - prefixed JSON (SitzplanGeneratorJSON)
 * - raw JSON
 * - legacy string format
 *
 * The function ensures that the returned structure is always a valid UIjson.
 *
 * @param {string} nameStr - Raw input string from UI or storage
 * @returns {Promise<Object>} Normalized UIjson object
 */
export async function inputToUIjson(nameStr) {
    try {

        let jsonStr = "";
        
        // 1. detect input format
        if (nameStr.startsWith(JSON_PREFIX)) {
            jsonStr = await extractJSONstr(nameStr);
        }
        else if (jsonStr.startsWith("{")) {
            jsonStr = nameStr;
        }
        else {
            return namesInputToUIjson(nameStr);
        }

        // 2. parse json
        const parsed = JSON.parse(jsonStr);
        
        // 3. validate root structure
        validateRoot(parsed);

        // 4. version migrate
        const migrated = migrate(parsed);

        // 5. normalize to UIjson output
        return normalizeToUI(migrated);
    } catch (err) {
        await showError("Fehler beim Auslesen des Namen-Feldes: " + err.message);
        return createUIjson([]); // safe fallback
    }
}

/**
 * Builds SGjson model from UI state.
 *
 * Responsibilities:
 * - Extract persons from UIjson
 * - Extract constraints (pairs, locked seats)
 * - Build seat list
 * - Build adjacency matrix
 * - Assign internal IDs for stable references
 *
 * @returns {Promise<Object>} SGjson model
 */
export async function buildSGModelFromUI() {
    const uiJSON = await inputToUIjson(DOM.namesInput.value);

    const persons = [];
    const constraints = [];

    let idCounter = 0;

    for (const entry of uiJSON.entries) {
        if (entry.type === "single") {
            const allowedSeats = entry.lockedSeat ? [idCounter] : null;

            persons.push({
                id: idCounter,
                firstname: entry.firstname,
                lastname: entry.lastname,
                allowedSeats
            });

            idCounter++;
        }

        if (entry.type === "pair") {
            const id1 = idCounter++;
            const id2 = idCounter++;

            persons.push({
                id: id1,
                firstname: entry.members[0].firstname,
                lastname: entry.members[0].lastname,
            });

            persons.push({
                id: id2,
                firstname: entry.members[1].firstname,
                lastname: entry.members[1].lastname,
            });

            constraints.push({
                type: "pair",
                a: id1,
                b: id2,
                mustBeNeighbors: entry.mustBeNeighbors
            });
        }
    }

    const seats = state.seats;
    const normSeatConnect = getNormalizedSeatConnectionSet(seats);
    const adjacency = buildAdjacency(seats.length, normSeatConnect);
    return createSGjson(persons, seats, adjacency, constraints);
}

/**
 * Builds adjacency matrix from normalized seat connections.
 *
 * @param {number} numberOfSeats - Total number of seats
 * @param {Array<Array<number>>} normSeatConnect - List of seat index pairs (1-based)
 * @returns {Array<Array<boolean>>} Symmetric adjacency matrix
 */
export function buildAdjacency(numberOfSeats, normSeatConnect) {
    const adjacency = Array.from({ length: numberOfSeats }, () =>
        Array(numberOfSeats).fill(false)
    );

    normSeatConnect.forEach(conn => {
        const a = conn[0] - 1;
        const b = conn[1] - 1;

        adjacency[a][b] = true;
        adjacency[b][a] = true;
    });

    return adjacency;
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validates the minimal structure of a parsed JSON object.
 *
 * Ensures presence of type and version fields.
 *
 * @param {Object} json - Parsed JSON object
 * @returns {void}
 * @throws {Error} If structure is invalid
 */
function validateRoot(json) {
    if (typeof json !== "object" || json === null) {
        throw new Error("JSON ist kein Objekt");
    }

    if (!json.type) {
        throw new Error("JSON hat keinen Typ");
    }

    if (typeof json.version !== "number") {
        throw new Error("JSON hat keine gültige Version");
    }
}

/**
 * Validates SeatGenerator JSON before solving.
 *
 * Checks:
 * - Presence of persons and seats
 * - Matching number of persons and seats
 * - User confirmation if seats exceed persons
 *
 * @param {Object} sgJSON - SeatGenerator JSON object
 * @returns {Promise<boolean>} True if valid and confirmed
 */
export async function validateSGjson(sgJSON) {
    sgJSON = migrateSG(sgJSON);

    if (!sgJSON.persons[0] || (sgJSON.persons[0].firstname === '' && sgJSON.persons[0].lastname === '') || sgJSON.seats.length === 0) {
        await showError('Keine gültigen Namen oder Sitzplätze zum Zuordnen!');
        return false;
    }

    if (sgJSON.persons.length < sgJSON.seats.length) {
        const confirmed = await showConfirm(`Achtung: Es werden nicht alle Sitzplätze besetzt werden. Es gibt ${sgJSON.seats.length} Sitzplätze, aber nur ${sgJSON.persons.length} Personen. Fortfahren?`, "Zu viele Sitzplätze");    
        if (!confirmed) return false;
    }
    if (sgJSON.persons.length > sgJSON.seats.length) {
        const missingSeats = sgJSON.persons.length - sgJSON.seats.length;
        if (missingSeats === 1){
            await showError("Es fehlt 1 Sitzplatz.");
        }
        else {
            await showError(`Es fehlen ${missingSeats} Sitzplätze.`);
        }
        return false;
    }
    return true;
}

// ============================================
// VERSION MIGRATION
// ============================================

/**
 * Dispatches migration depending on JSON type.
 *
 * @param {Object} json - Parsed JSON object
 * @returns {Object} Migrated JSON object
 */
function migrate(json) {
    switch (json.type) {
        case "UIjson":
            return migrateUI(json);
        case "SGjson":
            return migrateSG(json);
        default:
            throw new Error("Unbekannter JSON-Typ");
    }
}

/**
 * Migrates UIjson to latest supported version.
 *
 * @param {Object} json - UIjson object
 * @returns {Object} Migrated UIjson
 */
function migrateUI(json) {
    if (json.version === 1) return json;

    throw new Error("UIjson Version nicht unterstützt");
}

/**
 * Migrates SGjson to latest supported version.
 *
 * @param {Object} json - SGjson object
 * @returns {Object} Migrated SGjson
 */
function migrateSG(json) {
    if (json.version === 1) return json;

    throw new Error("SGjson Version nicht unterstützt");
}

// ============================================
// NORMALIZATION
// ============================================

/**
 * Converts any supported JSON format into UIjson.
 *
 * - UIjson → returned as-is
 * - SGjson → converted via mapping
 *
 * @param {Object} json - Migrated JSON object
 * @returns {Object} UIjson representation
 */
function normalizeToUI(json) {
    if (json.type === "UIjson") {
        return json;
    }

    if (json.type === "SGjson") {
        return convertSGtoUI(json);
    }

    throw new Error("Kann nicht in UIjson konvertieren");
}

/**
 * Converts normalized seat connection set into adjacency input format.
 *
 * - Maps arbitrary seat IDs to sequential indices
 * - Converts connection strings to numeric pairs
 *
 * @param {Array} seats - Seat objects from state
 * @returns {Array<Array<number>>} Normalized seat connections
 */
function getNormalizedSeatConnectionSet(seats) {
    const ids = seats.map(s => s.id);
    const sortedIds = [...ids].sort((a, b) => Number(a) - Number(b));
    const idMap = Object.fromEntries(sortedIds.map((id, i) => [id, (i + 1).toString()]));

    return Array.from(state.seatConnectionSet).map(edge => {
        const [a, b] = edge.split('-');
        return [idMap[a], idMap[b]];
    });
}

/**
 * Converts a SeatGenerator JSON (SGjson) into a UIjson structure.
 * 
 * NOTE:
 * Currently minimal implementation (persons only)
 * TODO Extend later with constraints -> pairs mapping
 *
 * @param {Object} sg - SGjson object
 * @returns {Object} Converted UIjson object
 */
function convertSGtoUI(sg) {
    const entries = sg.persons.map(p =>
        createSingle(p.firstname, p.lastname, p.lockedSeat)
    );

    return createUIjson(entries);
}

// ============================================
// LEGACY PARSING
// ============================================

/**
 * Parses a legacy string input into UIjson format.
 *
 * Supports:
 * - single persons separated by delimiter
 * - grouped pairs using group symbols
 * - locked seat numbers
 *
 * @param {string} namesInput - Raw legacy input string
 * @returns {Object} UIjson object
 */
function namesInputToUIjson(namesInput) {
    const entries = [];
    let buffer = '';
    let inGroup = false;
    for (const char of namesInput) {
        if (char === SYMBOLS.GROUP_START) {
            inGroup = true;
            buffer = '';
        } else if (char === SYMBOLS.GROUP_END) {
            inGroup = false;
            const groupEntries = buffer
                .split(SYMBOLS.PERSON_DELIMITER)
                .map(n => n.trim())
                .filter(n => n.length > 0)
                .map(n => getNames(n));
            entries.push(
                createPair(
                    [
                        createSingle(groupEntries[0].firstname, groupEntries[0].lastname, groupEntries[0].lockedSeat),
                        createSingle(groupEntries[1].firstname, groupEntries[1].lastname, groupEntries[1].lockedSeat)
                    ],
                    true
                )
            );
            buffer = '';
        } else if (inGroup) {
            buffer += char;
        } else if (char === SYMBOLS.PERSON_DELIMITER) {
            const entry = buffer.trim();
            if (entry) {
                const single = getNames(entry);
                entries.push(
                    createSingle(single.firstname, single.lastname, single.lockedSeat)
                );
            }
            buffer = '';
        } else {
            buffer += char;
        }
    }

    if (buffer.trim()) {
        const single = getNames(buffer.trim());
        entries.push(
            createSingle(single.firstname, single.lastname, single.lockedSeat)
        );
    }

    return createUIjson(entries);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Extract JSON part from prefixed string
 *
 * @param {string} jsonStr
 * @returns {string}
 */
async function extractJSONstr(jsonStr) {
    if (typeof jsonStr !== "string") {
        throw new Error("Input must be a string");
    }

    const jsonStart = jsonStr.indexOf("{");

    if (jsonStart === -1) {
        await showError("Es konnte kein gültiges JSON Format gefunden werden.");
    }

    return jsonStr.slice(jsonStart);
}

/**
 * Splits a fullname string into lastname, firstname, and lockedSeat flag.
 *
 * @param {string} fullname - Input string containing name and optional markers
 * @returns {{firstname: string, lastname: string, lockedSeat: boolean}} Parsed name object
 */
export function getNames(fullname) {
    const [name, lockedSeat] = fullname.endsWith(SYMBOLS.LOCKED_SEAT_TAG)
        ? [fullname.slice(0, -1), true]
        : [fullname, false];
    const [lastname, firstname] = name.includes(SYMBOLS.NAME_DELIMITER)
        ? name.split(SYMBOLS.NAME_DELIMITER).map(n => n.trim())
        : ['', name];
    return { lastname, firstname, lockedSeat };
}

// ============================================
// ENTRY FACTORIES
// ============================================

/**
 * Creates a single person entry.
 *
 * @param {string} firstname
 * @param {string} lastname
 * @param {boolean} seatNrs
 * @returns {{type: "single", firstname: string, lastname: string, lockedSeat: boolean}}
 */
export function createSingle(firstname, lastname, seatNrs) {
    return {
        type: "single",
        firstname,
        lastname,
        lockedSeat: seatNrs
    };
}

/**
 * Creates a pair entry with two members and optional constraint.
 *
 * @param {Array<Object>} members - List of person objects
 * @param {boolean} mustBeNeighbors - Whether members must sit adjacent
 * @returns {Object} Pair entry object
 */
export function createPair(members, mustBeNeighbors) {
    return {
        type: "pair",
        members,
        mustBeNeighbors
    };
}