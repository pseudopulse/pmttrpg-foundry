import { findBoundActors, getActorToken, searchForActor } from "../../pmttrpg.mjs";
import { getActorUser } from "../helpers/netmsg.mjs";
import { roundEnd } from "./hazards.mjs";

export let currentRound = 0;
export let currentTurn = 0;

let alreadyDoneThisRound = [];

export function setRound(round, turn) {
    currentRound = round;
    currentTurn = turn;
}

export async function roundChange(combat, round, turn) {
    //
}

export function getCombatantTokens() {
    let tokens = [];
    if (!game.combat || !game.combat.isActive) {
        return tokens;
    }

    for (let turn of game.combat.turns) {
        if (turn.token != null) {
            let token = canvas.tokens.placeables.find(x => x.actor.system.id == turn.token.actor.system.id);
            
            if (token != null && !tokens.includes(token)) {
                tokens.push(token);

                let results = findBoundActors(token.actor);

                for (let res of results) {
                    let bToken = getActorToken(res);

                    if (!tokens.includes(bToken)) {
                        tokens.push(bToken);
                    }
                }
            }
        }
    }

    return tokens.filter(x => x != null);
}

export function isActorCombatant(actor) {
    return getCombatantTokens().find(x => x.actor.system.id == actor.system.id) != null;
}

export async function turnChange(combat, round, turn) {
    if (combat.round == undefined || combat.round == currentRound) {
        
    } 
    else {
        currentRound = combat.round;

        for (const token of getCombatantTokens()) {
            if (token != null && token.actor != null && game.user.isGM) {
                await token.actor.handleNextRound();
            }
        }

        alreadyDoneThisRound = [];
    }

    currentTurn = turn;

    if (round == 1) return;

    for (const token of getCombatantTokens()) {
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

    if (actor != null && game.user.isActiveGM) {
        await actor.handleCombatStart();
        await actor.handleNextTurn();

        let results = findBoundActors(actor);

        for (let res of results) {
            await res.handleCombatStart();
            await res.handleNextTurn();
        }
    }
}