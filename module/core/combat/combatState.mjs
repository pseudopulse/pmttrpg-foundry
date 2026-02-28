export let currentRound = 0;
export let currentTurn = 0;

export function roundChange(combat, round, turn) {
    currentRound = round;
}

export function turnChange(combat, round, turn) {
    currentTurn = turn;
}

export function updateCombatant(combatant, data, id) {

}