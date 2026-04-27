// ============================================
// File: data/name-assignment.js
// ============================================

/**
 * Handles seat assignment using constraint solving.
 *
 * Responsibilities:
 * - Build and validate seat graph model
 * - Solve seat assignment (with optional shuffling)
 * - Apply results to UI
 */

// ============================================
// IMPORTS
// ============================================

import { setSeatName, toggleClearCreateSeatsButton } from '../canvas/elements/seat.js';
import { state } from '../state.js';
import { showError } from '../ui/modal-template.js';
import { showCountdown } from '../ui/sidebar.js';
import { buildSGModelFromUI, validateSGjson } from './seatplan-model.js';

// ============================================
// FILE-LOCAL CONSTANTS
// ============================================

// No additional constants required for this module

// ============================================
// ENTRY POINT
// ============================================

/**
 * Assigns names to seats and updates UI.
 *
 * @param {boolean} doShuffle - Enables randomized solving
 * @returns {Promise<void>}
 */
export async function assignNames(doShuffle = false) {
    try {
        const sgJSON = await buildSGModelFromUI();
        if (validateSGjson(sgJSON)) {
            const solvedNames = await solveSG(sgJSON, doShuffle);

            if (solvedNames) {
                if (document.getElementById('countdown-checkbox')?.checked) {
                    await showCountdown(5);
                }

                // id (1-based) -> idxArray (0-based)
                const personById = new Map();
                for (const p of sgJSON.persons) {
                    personById.set(p.id, p);
                }

                state.seats.forEach((seat, idx) => {
                    const id = solvedNames[idx];
                    const person = personById.get(id) || { firstname: "", lastname: "" };
                    setSeatName(seat, person.firstname, person.lastname);
                });

                toggleClearCreateSeatsButton(true);
            } else {
                await showError('Es kann keine gültige Besetzung gefunden werden. Beachten Sie vorgegebene Sitznachbarn und als benachbart gekennzeichnete Sitzplätze.');
            }
        }
    } catch (err) {
        await showError(err.message || "Unbekannter Fehler beim Verarbeiten der Eingabe.");
    }
}


// ============================================
// SOLVER CORE
// ============================================

/**
 * Solves the seat graph assignment problem.
 *
 * @param {Object} sg - Seat graph model
 * @param {boolean} doShuffle - Enables randomized solving
 * @returns {Promise<Array<number>|null>} Seat-to-person assignment
 */
export async function solveSG(sg, doShuffle) {
    const n = sg.seats.length;

    // assignment: seatId -> personId
    const assignment = new Array(n).fill(null);

    // reverse: personId -> seatId
    const personToSeat = new Map();

    // domains: personId -> possible seatIds
    const domains = buildInitialDomains(sg);

    // pre-place fixed seats
    if (!applyFixedSeats(sg, assignment, personToSeat, domains)) {
        return null;
    }

    let success
    if (doShuffle) {
        shuffleDomains(domains);
        success = backtrack(sg, assignment, personToSeat, domains);
    } else {
        for (let i = 0; i < n; i++) {
            assignment[i] = i;
        }
        success = true;
    }

    return success ? assignment : null;
}

// ============================================
// DOMAIN INITIALIZATION
// ============================================

/**
 * Builds initial domains for each person.
 *
 * @param {Object} sg - Seat graph model
 * @returns {Map<number, Array<number>>} Domains per person
 */
function buildInitialDomains(sg) {
    const n = sg.seats.length;
    const domains = new Map();

    // default: alle seats
    for (const p of sg.persons) {
        domains.set(p.id, Array.from({ length: n }, (_, i) => i));
    }

    // locked constraints
    for (const c of sg.constraints) {
        if (c.type !== "locked") continue;

        domains.set(c.id, [...c.seats]);
    }

    return domains;
}

/**
 * Applies fixed seat constraints (single-option domains).
 *
 * @param {Object} sg
 * @param {Array} assignment
 * @param {Map} personToSeat
 * @param {Map} domains
 * @returns {boolean} False if conflict detected
 */

function applyFixedSeats(sg, assignment, personToSeat, domains) {
    for (const c of sg.constraints) {
        if (c.type !== "locked") continue;
        if (c.seats?.length === 1) {
            const seat = c.seats[0] - 1;
            const personId = c.id;

            if (assignment[seat] !== null) return false;

            assignment[seat] = personId;
            personToSeat.set(personId, seat);

            // Domain einschränken
            if (domains.has(personId)) {
                domains.set(personId, [seat]);
            }
        }
    }
    return true;
}

// ============================================
// BACKTRACKING SOLVER
// ============================================

/**
 * Recursive backtracking with forward checking.
 *
 * @param {Object} sg
 * @param {Array} assignment
 * @param {Map} personToSeat
 * @param {Map} domains
 * @returns {boolean} True if solution found
 */
function backtrack(sg, assignment, personToSeat, domains) {

    // solved?
    if (personToSeat.size === sg.persons.length) {
        return true;
    }

    // MRV: Person mit kleinster Domain wählen
    const personId = selectNextPerson(domains, personToSeat);

    const possibleSeats = domains.get(personId);

    for (const seat of possibleSeats) {

        if (assignment[seat] !== null) continue;

        if (!isValid(sg, personId, seat, assignment, personToSeat)) {
            continue;
        }

        // assign
        assignment[seat] = personId;
        personToSeat.set(personId, seat);

        const snapshot = saveDomains(domains);

        // forward checking
        if (forwardCheck(sg, personId, seat, domains, assignment, personToSeat)) {
            if (backtrack(sg, assignment, personToSeat, domains)) {
                return true;
            }
        }

        // undo
        restoreDomains(domains, snapshot);
        assignment[seat] = null;
        personToSeat.delete(personId);
    }

    return false;
}

// ============================================
// CONSTRAINT HANDLING
// ============================================

/**
 * Selects next unassigned person using MRV heuristic.
 *
 * @param {Map} domains
 * @param {Map} personToSeat
 * @returns {number} Person ID
 */
function selectNextPerson(domains, personToSeat) {
    let best = null;
    let minSize = Infinity;

    for (const [pid, domain] of domains.entries()) {
        if (personToSeat.has(pid)) continue;

        if (domain.length < minSize) {
            minSize = domain.length;
            best = pid;
        }
    }

    return best;
}

/**
 * Validates a potential assignment against constraints.
 *
 * @param {Object} sg
 * @param {number} personId
 * @param {number} seat
 * @param {Array} assignment
 * @param {Map} personToSeat
 * @returns {boolean} True if valid
 */
function isValid(sg, personId, seat, assignment, personToSeat) {

    for (const c of sg.constraints) {

        if (c.type === "pair" || c.type === "noPair") {

            const other = (c.a === personId) ? c.b :
                (c.b === personId) ? c.a : null;

            if (other === null) continue;

            const otherSeat = personToSeat.get(other);

            if (otherSeat == null) continue;

            const isNeighbor = sg.adjacency[seat][otherSeat];

            if (c.type === "pair" && !isNeighbor) return false;
            if (c.type === "noPair" && isNeighbor) return false;
        }
    }

    return true;
}

/**
 * Performs forward checking by reducing domains.
 *
 * @param {Object} sg
 * @param {number} personId
 * @param {number} seat
 * @param {Map} domains
 * @param {Array} assignment
 * @returns {boolean} False if domain wipeout occurs
 */
function forwardCheck(sg, personId, seat, domains, assignment, personToSeat) {

    for (const [pid, domain] of domains.entries()) {

        if (assignment.includes(pid)) continue;

        const newDomain = domain.filter(s => {
            if (assignment[s] !== null) return false;
            return isValid(sg, pid, s, assignment, personToSeat);
        });

        if (newDomain.length === 0) return false;

        domains.set(pid, newDomain);
    }

    return true;
}

// ============================================
// DOMAIN STATE MANAGEMENT
// ============================================

/**
 * Creates a deep copy of domains.
 *
 * @param {Map} domains
 * @returns {Map} Snapshot copy
 */
function saveDomains(domains) {
    const copy = new Map();
    for (const [k, v] of domains.entries()) {
        copy.set(k, [...v]);
    }
    return copy;
}

/**
 * Restores domains from snapshot.
 *
 * @param {Map} domains
 * @param {Map} snapshot
 */
function restoreDomains(domains, snapshot) {
    domains.clear();
    for (const [k, v] of snapshot.entries()) {
        domains.set(k, v);
    }
}

// ============================================
// SHUFFLING
// ============================================

/**
 * Randomly shuffles an array in place (Fisher-Yates).
 *
 * @param {Array} array
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Shuffles all domains to randomize search order.
 *
 * @param {Map<number, Array<number>>} domains
 */
function shuffleDomains(domains) {
    for (const [pid, domain] of domains.entries()) {
        shuffleArray(domain);
    }
}
