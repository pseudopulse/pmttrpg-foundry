import { searchForActor } from "../../pmttrpg.mjs";
import { getActorUser } from "../helpers/netmsg.mjs";

export let currentRound = 0;
export let currentTurn = 0;

export function setRound(round, turn) {
    currentRound = round;
    currentTurn = turn;
}

export async function roundChange(combat, round, turn) {
    currentRound = round;

    if (round != 1) {
        for (const token of canvas.tokens.placeables) {
            if (token != null && token.actor != null && getActorUser(token.actor) == game.user) {
                await token.actor.handleNextRound();
            }
        }
    }
}

export async function turnChange(combat, round, turn) {
    currentTurn = turn;

    if (round == 1) return;

    for (const token of canvas.tokens.placeables) {
        if (token != null && token.id == combat.current.tokenId && getActorUser(token.actor) == game.user) {
            await token.actor.handleNextTurn();
        }
    }
}

export async function updateCombatant(combatant, data, id) {
    let actor = searchForActor(combatant.actorId);

    if (actor != null) {
        await actor.handleCombatStart();
        await actor.handleNextTurn();
    }
}