// import Actor from "@client/documents/actor.mjs";

import { searchByObject } from "../../pmttrpg.mjs";
import { RollContext } from "../combat/rollContext.mjs";

export function sendNetworkMessage(type, data) {
    ChatMessage.create({
        user: game.user._id,
        content: JSON.stringify(data),
        title: "NETMSGFLAG",
        flavor: type,
        blind: true,
        speaker: ChatMessage.getSpeaker(),
    });
}

export const handler = {};

export function registerMessages() {
    handler["PENDING_CLASH"] = async (data) => {
        const target = searchByObject(data.target);
        const attacker = searchByObject(data.attacker);
        
        if (existsInTokensList(target)) {
            const context = new RollContext();
            context.attackerTokenId = data.attackerTokenId;
            context.actor = attacker;
            context.target = target;
            Object.assign(context, data.context);
            context.fix();

            await target.handlePendingClash(context);
        }
    };

    handler["RESOLVE_CLASH"] = async (data) => {
        const target = searchByObject(data.target);
        const attacker = searchByObject(data.attacker);

        if (game.user.isGM) {
            console.log("we are gm");
            attacker.prepareData();
            console.log(attacker);
            await attacker.sendAttackRoll();
        }
    }
}

function existsInTokensList(actor) {
    for (let token of canvas.tokens.placeables.filter(x => x.actor && testPermission(x.actor))) {
        if (token.actor._id == actor._id) {
            return true;
        }
    }

    return false;
}

/**
 * 
 * @param {Actor} actor 
 */
function testPermission(actor) {
    if (!game.user.isGM) {
        return actor.testUserPermission(game.user, "OWNER");
    }

    for (const id in actor.ownership) {
        if (id != game.user.id && actor.ownership[id] >= 3) {
            return false;
        }
    }

    return true;
}