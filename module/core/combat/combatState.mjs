import { searchForActor } from "../../pmttrpg.mjs";

export let currentRound = 0;
export let currentTurn = 0;

export async function roundChange(combat, round, turn) {
    currentRound = round;

    console.log(currentRound);

    if (round != 1) {
        for (const token of canvas.tokens.placeables) {
            if (token != null && token.actor != null) {
                await token.actor.handleNextRound();
            }
        }
    }
}

export async function turnChange(combat, round, turn) {
    currentTurn = turn;
}

export async function updateCombatant(combatant, data, id) {
    let actor = searchForActor(combatant.actorId);

    if (actor != null) {
        await actor.handleCombatStart();
    }
}