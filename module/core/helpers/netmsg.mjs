// import Actor from "@client/documents/actor.mjs";

import { searchByObject } from "../../pmttrpg.mjs";
import { RollContext } from "../combat/rollContext.mjs";
import { pollUserInputConfirm, pollUserInputOptions, pollUserInputText, pollReduceStatus, pollDistributeStatus, pollUserInputBurst } from "./dialog.mjs";

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
            attacker.prepareData();
            await attacker.sendAttackRoll();
        }
    }

    handler["USE_ACTION_SKILL"] = async (data) => {
        const target = searchByObject(data.target);
        const attacker = searchByObject(data.attacker);

        if (game.user.isGM) {
            await attacker.processActionSkill(attacker.items.find(x => x._id == data.item._id), target);
        }
    };

    handler["OVERWRITE_CLASH"] = async (data) => {
        const target = searchByObject(data.target);
        const attacker = searchByObject(data.attacker);

        if (testUserPermission(attacker, game.user)) {
            attacker.updateQueuedRoll(target);
        }
    };
    
    

    CONFIG.queries["pmttrpg.pollUserInputOptions"] = wrapperPollUserInputOptions;
    CONFIG.queries["pmttrpg.pollUserInputText"] = wrapperPollUserInputText;
    CONFIG.queries["pmttrpg.pollUserInputConfirm"] = wrapperPollUserInputConfirm;
    CONFIG.queries["pmttrpg.pollReduceStatus"] = wrapperPollReduceStatus;
    CONFIG.queries["pmttrpg.pollDistributeStatus"] = wrapperPollDistributeStatus;
    CONFIG.queries["pmttrpg.pollUserInputBurst"] = wrapperPollUserInputBurst;
}

export async function wrapperPollUserInputOptions(data) {
    return await pollUserInputOptions(game.user, data.prompt, data.options, data.defaultIndex);
}

export async function wrapperPollUserInputText(data) {
    return await pollUserInputText(game.user, data.prompt, data.placeholder, data.mode, data.max, data.min);
}

export async function wrapperPollUserInputConfirm(data) {
    return await pollUserInputConfirm(game.user, data.prompt);
}

export async function wrapperPollReduceStatus(data) {
    return await pollReduceStatus(game.user, data.source, data.count, data.statusEffects);
}

export async function wrapperPollDistributeStatus(data) {
    return await pollDistributeStatus(game.user, data.team, data.status, data.count);
}

export async function wrapperPollUserInputBurst(data) {
    return await pollUserInputBurst(game.user, data.target);
}


function existsInTokensList(actor) {
    for (let token of canvas.tokens.placeables.filter(x => x.actor && testPermission(x.actor))) {
        if (token.actor._id == actor._id) {
            return true;
        }
    }

    return false;
}

export function findByID(id) {
    for (let token of canvas.tokens.placeables.filter(x => x.actor != null)) {
        if (token.actor._id == id) {
            return token.actor;
        }
    }

    return null;
}

export function getActorUser(actor) {
    for (const user of game.users) {
        if (testUserPermission(actor, user)) {
            return user;
        }
    }

    return null;
}

/**
 * 
 * @param {Actor} actor 
 */
function testUserPermission(actor, user) {
    if (!user.isGM) {
        return actor.testUserPermission(user, "OWNER");
    }

    for (const id in actor.ownership) {
        if (id != user.id && actor.ownership[id] >= 3) {
            return false;
        }
    }

    return true;
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