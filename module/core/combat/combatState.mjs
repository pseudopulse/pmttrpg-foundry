import { findBoundActors, searchForActor } from "../../pmttrpg.mjs";
import { getActorUser } from "../helpers/netmsg.mjs";

export let currentRound = 0;
export let currentTurn = 0;

let alreadyDoneThisRound = [];

export function setRound(round, turn) {
    currentRound = round;
    currentTurn = turn;
}

export async function roundChange(combat, round, turn) {
    currentRound = round;
    alreadyDoneThisRound = [];

    if (round != 1) {
        for (const token of canvas.tokens.placeables) {
            if (token != null && token.actor != null && game.user.isGM) {
                await token.actor.handleNextRound();

                let results = findBoundActors(token.actor);

                for (let res of results) {
                    await res.handleNextRound();
                }
            }
        }
    }
}

export async function turnChange(combat, round, turn) {
    currentTurn = turn;

    if (round == 1) return;

    for (const token of canvas.tokens.placeables) {
        if (token != null && token.id == combat.current.tokenId && game.user.isGM) {
            if (!alreadyDoneThisRound.includes(token.actor)) {
                await token.actor.handleNextTurn();

                let results = findBoundActors(token.actor);

                for (let res of results) {
                    await res.handleNextTurn();
                }

                alreadyDoneThisRound.push(token.actor);
            }
        }
    }
}

export async function updateCombatant(combatant, data, id) {
    let actor = combatant.token.actor;

    if (actor != null && game.user.isGM) {
        await actor.handleCombatStart();
        await actor.handleNextTurn();

        let results = findBoundActors(actor);

        for (let res of results) {
            await res.handleCombatStart();
            await res.handleNextTurn();
        }
    }
}