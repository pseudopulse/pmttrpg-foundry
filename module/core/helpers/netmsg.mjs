// import Actor from "@client/documents/actor.mjs";

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
    handler["PENDING_CLASH"] = (data) => {
        const target = game.actors.get(data.target._id);
        const attacker = game.actors.get(data.attacker._id);
        
        if (existsInTokensList(target)) {
            const context = new RollContext();
            context.attackerTokenId = data.attackerTokenId;
            context.actor = attacker;
            context.target = target;
            Object.assign(context, data.context);
            context.fix();

            target.handlePendingClash(context);
        }
    };
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