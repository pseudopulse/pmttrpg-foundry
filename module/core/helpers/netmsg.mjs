// import Actor from "@client/documents/actor.mjs";

import { getActorToken, searchByObject } from "../../pmttrpg.mjs";
import { RollContext } from "../combat/rollContext.mjs";
import { createEffectsMessage } from "./clash.mjs";
import { pollUserInputConfirm, pollUserInputOptions, pollUserInputText, pollReduceStatus, pollDistributeStatus, pollUserInputBurst } from "./dialog.mjs";
import { addHazardInternal, roundEndInternal } from "../combat/hazards.mjs";
import { pollUserGetGridSpace } from "../combat/movement.mjs";

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
    handler["CREATE_HAZARD"] = async (data) => {
        await addHazardInternal(data.type, data.rounds, data.source, data.affectedTiles);
    }

    handler["ROUND_END_HAZARD"] = async (data) => {
        roundEndInternal();
    }

    handler["PENDING_CLASH"] = async (data) => {
        const target = findByID(data.target);
        const attacker = findByID(data.attacker);

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
        const target = findByID(data.target);
        const attacker = findByID(data.attacker);

        if (game.user.isActiveGM) {
            await attacker.sendAttackRoll();
        }
    }

    handler["USE_ACTION_SKILL"] = async (data) => {
        const target = findByID(data.target);
        const attacker = findByID(data.attacker);

        if (game.user.isActiveGM) {
            await attacker.processActionSkill(attacker.items.find(x => x._id == data.item._id), target);
        }
    };

    handler["APPLY_MARK"] = async (data) => {
        const target = findByID(data.target);
        const attacker = findByID(data.attacker);

        if (game.user.isActiveGM) {
            await target.applyMark(attacker, data.mark);
        }
    };

    handler["REMOVE_MARK"] = async (data) => {
        const target = findByID(data.target);
        const source = findByID(data.source);

        if (game.user.isActiveGM) {
            await target.removeMark(source, data.mark);
        }
    };

    handler["OVERWRITE_CLASH"] = async (data) => {
        const target = findByID(data.target);
        const attacker = findByID(data.attacker);

        if (testUserPermission(attacker, game.user)) {
            attacker.updateQueuedRoll(target);
        }
    };

    handler["UPDATE_MOUNT"] = async (data) => {
        const target = findByID(data.target);
        const char = findByID(data.char);

        if (game.user.isActiveGM) {
            await target.update({ "system.mountedCharacter": char.system.id }, { diff: false, render: true });
        }
    };

    handler["CLEAR_MOUNT"] = async (data) => {
        const target = findByID(data.target);

        if (game.user.isActiveGM) {
            await target.update({ "system.mountedCharacter": null }, { diff: false, render: true });
        }
    };

    handler["EDIT_SCALE"] = async (data) => {
        const target = findByID(data.target);

        if (game.user.isActiveGM) {
            await target.modifyScale(data.scale);
        }
    };

    handler["HANDLE_TAIL_HEAL"] = async (data) => {
        const source = findByID(data.source);

        if (game.user.isActiveGM) {
            let targets = [];

            for (let target of data.targets) {
                let actor = findByID(target);

                if (actor != null) {
                    targets.push(actor);
                }
            }

            let formula = `${10 - ((targets.length - 1) * 2)}d5`;
            let text = "";

            for (let target of targets) {
                let roll = new Roll(formula);
                let res = await roll.evaluate();
                let heal = res.total;

                let php = target.system.attributes.health.value;
                await target.heal(heal, 0, 0, source);
                let hp = target.system.attributes.health.value;
                text = text + `${target.name} is healed for ${heal}! (${php} -> ${hp})\n`;
            }

            createEffectsMessage(source.name, text, true);
        }
    };
    

    CONFIG.queries["pmttrpg.pollUserInputOptions"] = wrapperPollUserInputOptions;
    CONFIG.queries["pmttrpg.pollUserInputText"] = wrapperPollUserInputText;
    CONFIG.queries["pmttrpg.pollUserInputConfirm"] = wrapperPollUserInputConfirm;
    CONFIG.queries["pmttrpg.pollReduceStatus"] = wrapperPollReduceStatus;
    CONFIG.queries["pmttrpg.pollDistributeStatus"] = wrapperPollDistributeStatus;
    CONFIG.queries["pmttrpg.pollUserInputBurst"] = wrapperPollUserInputBurst;
    CONFIG.queries["pmttrpg.pollUserGetGridSpace"] = wrapperPollUserGetGridSpace;
}

export async function wrapperPollUserGetGridSpace(data) {
    return await pollUserGetGridSpace(game.user, data.target, data.origin, data.range);
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
        if (token.actor == null) continue;
        if (token.actor.system.id == actor.system.id) {
            return true;
        }
    }

    return false;
}

export function findByID(id) {
    for (let token of canvas.tokens.placeables.filter(x => x.actor != null)) {
        if (token.actor.system.id == id) {
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