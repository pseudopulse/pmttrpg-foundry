import { findActorsOfTeam, searchByObject } from "../../pmttrpg.mjs";
import { RollContext } from "../combat/rollContext.mjs";
import { createClashMessage, enrichClashData } from "../helpers/clash.mjs";
import { findByID, getActorUser, sendNetworkMessage } from "./netmsg.mjs";

export function createAlertBox(alert) {
    const dialog = new Dialog({
        title: "",
        content: alert,
        buttons: {
            button1: {
                label: "OK",
                icon: `<i class="fas fa-check"></i>`
            }
        }
    }).render(true);
}

function matchesType(context, type) {
    switch (context.damageType) {
        case "Slash":
        case "Pierce":
        case "Blunt":
            return type == "Attack";
        case "Block":
            return type == "Block";
        case "Evade":
            return type == "Evade";
        default:
            return false;
    }
}

/**
    * @param {RollContext} context 
    */
export async function getActionModifiers(actor, context) {
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/action-modifiers.hbs", {
        skills: actor.items.filter(x => x.type == "skill" && matchesType(context, x.system.type)),
        tools: actor.items.filter(x => x.type == "tools" && matchesType(context, x.system.type)),
        conditionals: context.conditionals,
        rollContext: context,
        actor: actor
    });

    return new Promise((resolve, reject) => {
        const data = {
            activeConditionals: [],
            item: null,
            forcedAdvState: 0,
            ignoreClashEffects: false
        };
        let allowClose = false;
        const dialog = new Dialog({
            title: "",
            content: content,
            buttons: {
                submit: {
                    label: "Continue",
                    callback: () => {
                        allowClose = true;
                        resolve(data);
                    }
                }
            },
            close: () => {
                if (!allowClose) {
                    throw new Error();
                }
            },
            render: (html) => {
                $("#amw-tools").hide();
                $("#amw-conditionals").hide();

                html.on('click', '.misc-toggle', (event) => {
                    if (event.currentTarget.checked) {
                        const action = event.currentTarget.dataset.id;

                        switch (action) {
                            case "IgnoreCWL":
                                data.ignoreClashEffects = true;
                                break;
                            case "Adv":
                                data.forcedAdvState = 1;
                                html.find('input').each((x, input) => {
                                    if (input.dataset.id == "Disadv") {
                                        input.checked = false;
                                    }
                                });
                                break;
                            case "Disadv":
                                data.forcedAdvState = -1;
                                html.find('input').each((x, input) => {
                                    if (input.dataset.id == "Adv") {
                                        input.checked = false;
                                    }
                                });
                            default:
                                break;
                        }
                    }
                    else {
                        const action = event.currentTarget.dataset.id;

                        switch (action) {
                            case "IgnoreCWL":
                                data.ignoreClashEffects = false;
                                break;
                            case "Adv":
                            case "Disadv":
                                data.forcedAdvState = 0;
                            default:
                                break;
                        }
                    }
                });

                html.on('click', '.skill-toggle', (event) => {
                    if (event.currentTarget.checked) {
                        const itemId = event.currentTarget.closest('.item').dataset.itemId;
                        const item = actor.items.get(itemId);
                        data.item = item;

                        html.find('input').each((x, input) => {
                            if ((input.classList.contains('skill-toggle') || input.classList.contains('tool-toggle')) && input != event.currentTarget) {
                                input.checked = false;
                            }
                        });
                    }
                    else {
                        data.item = null;
                    }
                })

                html.on('click', '.conditional-toggle', (event) => {
                    if (event.currentTarget.checked) {
                        const itemId = event.currentTarget.closest('.item').dataset.itemId;
                        data.activeConditionals.push(itemId);

                        html.find('input').each((x, input) => {
                            if (input.classList.contains('conditional-toggle') && input != event.currentTarget) {
                                if (context.conditionals.find(x => x.name == itemId).exclusiveWith == input.closest('.item').dataset.itemId) {
                                    input.checked = false;
                                }
                            }
                        });
                    }
                    else {
                        const itemId = event.currentTarget.closest('.item').dataset.itemId;
                        data.activeConditionals = data.activeConditionals.filter(x => x != itemId);
                    }
                })

                html.on('click', '.amw-tab-button', (event) => {
                    const element = event.currentTarget;
        
                    if (element.textContent == "Skills") {
                        $("#amw-skills").show();
                        $("#amw-tools").hide();
                        $("#amw-conditionals").hide();
                    }

                    if (element.textContent == "Tools") {
                        $("#amw-tools").show();
                        $("#amw-skills").hide();
                        $("#amw-conditionals").hide();
                    }

                    if (element.textContent == "Conditionals") {
                        $("#amw-conditionals").show();
                        $("#amw-tools").hide();
                        $("#amw-skills").hide();
                    }
                });
            },
        }, {
            width: 600,
            height: 450
        }).render(true);
    });
}

export async function pollUserInputOptions(user, prompt, options, defaultIndex = 0) {
    for (let option of options) {
        if (option.icon == null) {
            option.icon = "null";
        }
    }

    if (user != game.user) {
        return await getActorUser(user).query("pmttrpg.pollUserInputOptions", {
            prompt: prompt,
            options: options,
            defaultIndex: defaultIndex
        });
    }

    for (let option1 of options) {
        if (option1.displayName == null) {
            option1.displayName = option1.name;
        }
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/input-dropdown.hbs", {
        prompt: enrichClashData(prompt.replace("\n", "<br>")),
        options: options
    });
    let allowClose = true;
    let value = "";

    return new Promise((resolve, reject) => {
        let option = options[defaultIndex];

        const dialog = new Dialog({
            title: "",
            content: content,
            buttons: {
                submit: {
                    label: "Confirm",
                    callback: () => {
                        if (allowClose) {
                            dialog.close();
                        }
                    }
                }
            },
            close: () => {
                if (!allowClose) {
                    throw new Error();
                }
                else {
                    resolve(option.name);
                }
            },
            render: (html) => {
                let setOption = (option) => {
                    if (option.icon == "null") {
                        $("#idrp-button").find(".id-drp-img").hide();
                    }
                    else {
                        $("#idrp-button").find(".id-drp-img").show();
                        document.getElementById("idrp-button").querySelector("img").src = `systems/pmttrpg/assets/${option.icon}`;
                    }

                    $("#idrp-button").find(".id-drp-option").text(option.displayName);
                };

                setOption(option);

                html.on('click', '.id-drp-selection', (ev) => {
                    let text = ev.currentTarget.querySelector(".id-drp-option").textContent;

                    option = options.find(x => x.displayName == text);
                    setOption(option);
                });

                html.on('submit', '.it-text-field', (ev) => {
                    if (allowClose) {
                        dialog.close();
                    }
                });
            },
            default: "submit"
        }, {
            width: 500,
            height: 320
        }).render(true);
    });
}

export async function pollUserInputBurst(user, target) {
    target = searchByObject(target);

    if (await target.getStatusCount("Sinking") <= 0 && await target.getStatusCount("Rupture") <= 0 && await target.getStatusCount("Tremor") <= 0) {
        return {
            sinkingBurst: false,
            tremorBurst: false,
            ruptureBurst: false,
        };
    }

    if (user != game.user) {
        return await getActorUser(user).query("pmttrpg.pollUserInputBurst", {
            target: target,
        });
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/burst-options.hbs", {
        sinkingAvailable: await target.getStatusCount("Sinking") > 0,
        ruptureAvailable: await target.getStatusCount("Rupture") > 0,
        tremorAvailable: await target.getStatusCount("Tremor") > 0
    });

    return new Promise((resolve, reject) => {
        let data = {
            sinkingBurst: false,
            tremorBurst: false,
            ruptureBurst: false,
        };

        const dialog = new Dialog({
            title: "",
            content: content,
            buttons: {
                submit: {
                    label: "Confirm",
                    callback: () => {
                        dialog.close();
                    }
                },
            },
            close: () => {
                resolve(data);
            },
            render: (html) => {
                html.on('click', '.burst-input', (ev) => {
                    let type = ev.currentTarget.dataset.id;

                    switch (type) {
                        case "Sinking":
                            data.sinkingBurst = ev.currentTarget.checked;
                            break;
                        case "Tremor":
                            data.tremorBurst = ev.currentTarget.checked;
                            break;
                        case "Rupture":
                            data.ruptureBurst = ev.currentTarget.checked;
                            break;
                    }
                });
            },
            default: "Confirm"
        }, {
            width: 500,
            height: 320
        }).render(true);
    });
}

export async function pollUserInputConfirm(user, prompt) {
    if (user != game.user) {
        return await getActorUser(user).query("pmttrpg.pollUserInputConfirm", {
            prompt: prompt,
        });
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/input-confirm.hbs", {
        prompt: enrichClashData(prompt.replace("\n", "<br>")),
    });

    return new Promise((resolve, reject) => {
        let resolved = false;
        const dialog = new Dialog({
            title: "",
            content: content,
            buttons: {
                submit: {
                    label: "Yes",
                    callback: () => {
                        resolve(true);
                        resolved = true;
                        dialog.close();
                    }
                },
                dont: {
                    label: "No",
                    callback: () => {
                        resolve(false);
                        resolved = true;
                        dialog.close();
                    }
                }
            },
            close: () => {
                if (!resolved) {
                    resolve(false);
                }
            },
            default: "yes"
        }, {
            width: 500,
            height: 320
        }).render(true);
    });
}

export async function pollReduceStatus(user, source, maxStacks, statusEffects) {
    if (user != game.user) {
        return await getActorUser(user).query("pmttrpg.pollReduceStatus", {
            source: source,
            count: maxStacks,
            statusEffects: statusEffects
        });
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/reduce-status.hbs", {
        source: source,
        count: maxStacks
    });

    let reduction = {
        "Burn": 0,
        "Bleed": 0,
        "Frostbite": 0,
        "Smoke": 0,
        "Deep_Chill": 0,
        "Renewed_Blaze": 0,
        "Hemorrhage": 0
    };

    let checkNoStandard = () => {
        return reduction["Bleed"] <= 0 && reduction["Burn"] <= 0 && reduction["Frostbite"] <= 0 && reduction["Smoke"] <= 0;
    }

    let checkNoPause = () => {
        return reduction["Hemorrhage"] <= 0 && reduction["Renewed_Blaze"] <= 0 && reduction["Deep_Chill"] <= 0;
    }

    let tallyAll = () => {
        return (reduction["Bleed"] + reduction["Burn"] + reduction["Frostbite"] + reduction["Smoke"]) + 
        ((reduction["Hemorrhage"] + reduction["Renewed_Blaze"] + reduction["Deep_Chill"]) * 2);
    }

    let update = (html) => {
        html.find('.rs-statusInput').each((x, input) => {
            let status = statusEffects.find(x => x.name == input.closest('.rs-statusInputHolder').dataset.status);
            input.min = 0;
            input.max = Number(input.value) + (Math.max(maxStacks - tallyAll(), 0));
            if (status != null) {
                input.max = Math.min(Number(input.max), Number(status.count));
            }
        });

        if (!checkNoStandard()) {
            $("#rs-pauseStatus").addClass("rs-nop");
            $("#rs-pauseStatusBox").show();
        }
        else {
            $("#rs-pauseStatus").removeClass("rs-nop");
            $("#rs-pauseStatusBox").hide();
        }

        if (!checkNoPause()) {
            $("#rs-standardStatus").addClass("rs-nop");
            $("#rs-standardStatusBox").show();
        }
        else {
            $("#rs-standardStatus").removeClass("rs-nop");
            $("#rs-standardStatusBox").hide();
        }
    } 
    
    return new Promise((resolve, reject) => {
        const dialog = new Dialog({
            title: "",
            content: content,
            buttons: {
                submit: {
                    label: "Confirm",
                    callback: () => {
                        dialog.close();
                    }
                }
            },
            close: () => {
                resolve(reduction);
            },
            render: (html) => {
                update(html);

                html.on('input', '.rs-statusInput', (ev) => {
                    let val = Number(ev.currentTarget.value);
                    let status = ev.currentTarget.closest('.rs-statusInputHolder').dataset.status;
                    reduction[status] = val;

                    update(html);
                });

                html.on('submit', '.it-text-field', (ev) => {
                    if (allowClose) {
                        dialog.close();
                    }
                });
            },
            default: "submit"
        }, {
            width: 600,
            height: 400
        }).render(true);
    });
}

export async function pollDistributeStatus(user, team, status, count) {
    if (user != game.user) {
        return await getActorUser(user).query("pmttrpg.pollDistributeStatus", {
            status: status,
            count: count,
            team: team
        });
    }

    let allies = [];

    for (let token of canvas.tokens.placeables.filter(x => x.document.disposition == team)) {
        allies.push({
            name: token.actor.name,
            allocated: 0,
            id: token.actor._id
        })
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/ally-status.hbs", {
        prompt: enrichClashData(`Choose how to spread ${count} [/status/${status}] ${status} between allies!`),
        allies: allies
    });

    let tallyAll = () => {
        let count = 0;
        for (let ally of allies) {
            count += ally.allocated;
        }

        return count;
    }

    let update = (html) => {
        html.find('.als-numInput').each((x, input) => {
            let ally = allies.find(x => x.id == input.closest('.als-allyCard').dataset.id);
            input.min = 0;
            input.max = Number(input.value) + (Math.max(count - tallyAll(), 0));
        });
    } 
    
    return new Promise((resolve, reject) => {
        const dialog = new Dialog({
            title: "",
            content: content,
            buttons: {
                submit: {
                    label: "Confirm",
                    callback: () => {
                        dialog.close();
                    }
                }
            },
            close: () => {
                resolve(allies);
            },
            render: (html) => {
                update(html);

                html.on('input', '.als-numInput', (ev) => {
                    let val = Number(ev.currentTarget.value);
                    let ally = allies.find(x => x.id == ev.currentTarget.closest('.als-allyCard').dataset.id);
                    ally.allocated = val;

                    update(html);
                });
            },
            default: "submit"
        }, {
            width: 600,
            height: 400
        }).render(true);
    });
}

export async function pollUserInputText(user, prompt, placeholder, mode = "latin", max = 999, min = 0) {
    if (user != game.user) {
        return await getActorUser(user).query("pmttrpg.pollUserInputText", {
            prompt: prompt,
            placeholder: placeholder,
            mode: mode,
            max: max,
            min: min
        });
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/input-text.hbs", {
        prompt: enrichClashData(prompt.replace("\n", "<br>")),
        placeholder: placeholder,
        mode: mode,
        max: max,
        min: min
    });
    let allowClose = false;
    let value = "";

    if (mode == "number") {
        value = 0;
        allowClose = true;
    };

    return new Promise((resolve, reject) => {
        const dialog = new Dialog({
            title: "",
            content: content,
            buttons: {
                submit: {
                    label: "Confirm",
                    callback: () => {
                        if (allowClose) {
                            dialog.close();
                        }
                    }
                }
            },
            close: () => {
                if (!allowClose) {
                    throw new Error();
                }
                else {
                    resolve(value);
                }
            },
            render: (html) => {
                html.on('change', '.it-text-field', (ev) => {
                    if (ev.currentTarget.value == "") {
                        allowClose = false;
                    }
                    else {
                        allowClose = true;
                    }

                    value = ev.currentTarget.value;
                });

                html.on('submit', '.it-text-field', (ev) => {
                    if (allowClose) {
                        dialog.close();
                    }
                });
            },
            default: "submit"
        }, {
            width: 500,
            height: 320
        }).render(true);
    });
}

/**
    * @param {RollContext} context 
    */
export async function getSkillOptions(actor) {
    if (actor.items.filter(x => x.type == "skill" && x.system.type == "Action").length == 0) {
        ui.notifications.info("You dont have any action skills!");
        return;
    }


    let targetList = [];
    for (let token of canvas.tokens.placeables.filter(x => x.actor && x.actor != actor)) {
        targetList.push({
            name: token.actor.name,
            id: token.actor._id,
            token: token
        });
    }

    let target = game.user.targets.first();
    if (target == null || target.actor == actor) {
        target = targetList.length > 0 ? targetList[0] : null;

        if (target == null) {
            return;
        }
        else {
            target.token.setTarget(true, { releaseOthers: true });
        }
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/skill-options.hbs", {
        skills: actor.items.filter(x => x.type == "skill" && x.system.type == "Action"),
        actor: actor,
        targets: targetList,
        target: target.name
    });
    

    const dialog = new Dialog({
        title: "",
        content: content,
        buttons: {
            skip: {
                label: "Cancel",
                callback: () => {
                    dialog.close();
                }
            }
        },
        close: () => {
            
        },
        render: async (html) => {
            $("#sto-targetButton").text(target.name);

            html.on('click', '.rollable', async (event) => {
                const element = event.currentTarget;
                const dataset = element.dataset;

                const itemId = element.closest('.item').dataset.itemId;
            
                const item = actor.items.get(itemId);
                await actor.sendTriggerActionSkill(item, target.token.actor);
                await dialog.close();
            });

            html.on('click', '.sto-target-entry', async (event) => {
                let id = event.currentTarget.dataset.id;
                let token = canvas.tokens.placeables.find(x => x.actor._id == id);
                token.setTarget(true, { releaseOthers: true });
                $("#sto-targetButton").text(token.actor.name);
            });
        }
    }, {
        width: 500,
        height: 425,
    }).render(true);
}

/**
    * @param {RollContext} context 
    */
export async function getAttackOptions(actor) {
    let targetList = [];
    for (let token of canvas.tokens.placeables.filter(x => x.actor && x.actor != actor)) {
        targetList.push({
            name: token.actor.name,
            id: token.actor._id,
            token: token
        });
    }

    let target = game.user.targets.first();
    if (target == null || target.actor == actor) {
        target = targetList.length > 0 ? targetList[0] : null;

        if (target == null) {
            return;
        }
        else {
            target.token.setTarget(true, { releaseOthers: true });
        }
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/attack-options.hbs", {
        weapons: actor.items.filter(x => x.type == "weapon" && actor.getCanUseItem(x)),
        useExtraRoll: actor.system.recycleAction != null && actor.system.recycleAction.type == "Attack",
        extraRoll: actor.system.recycleAction != null ? actor.system.recycleAction.context : null,
        actor: actor,
        targets: targetList
    });
    

    const dialog = new Dialog({
        title: "",
        content: content,
        buttons: {
            skip: {
                label: "Cancel",
                callback: () => {
                    dialog.close();
                }
            }
        },
        close: () => {
            
        },
        render: async (html) => {
            $("#at-targetButton").text(target.name);

            html.on('click', '.rollable', async (event) => {
                const element = event.currentTarget;
                const dataset = element.dataset;

                const itemId = element.closest('.item').dataset.itemId;
                if (itemId == "recycle") {
                    let ctx = new RollContext();
                    Object.assign(ctx, actor.system.recycleAction.context);
                    ctx.mustDeserialize = false;
                    ctx.actor = actor;
                    ctx.target = game.user.targets.first().actor;
                    ctx.ignoreClashEffects = !(await pollUserInputConfirm(actor, "Apply clash effects for this recycled attack?"));
                    if (ctx.modifiers != null) {
                        ctx.modifiers.ignoreClashEffects = ctx.ignoreClashEffects;
                    }
                    ctx.fix();
                    createClashMessage(actor, ctx);
                    await actor.queueRoll(ctx, false);
                    sendNetworkMessage("PENDING_CLASH", {
                        attacker: actor,
                        target: game.user.targets.first().actor,
                        context: ctx,
                    })
                    await dialog.close();
                    return;
                }

                const item = actor.items.get(itemId);
                await item.roll(true);
                await dialog.close();
            });

            html.on('click', '.at-target-entry', async (event) => {
                let id = event.currentTarget.dataset.id;
                let token = canvas.tokens.placeables.find(x => x.actor._id == id);
                token.setTarget(true, { releaseOthers: true });
                $("#at-targetButton").text(token.actor.name);
            });
        }
    }, {
        width: 500,
        height: 425,
    }).render(true);
}

/**
    * @param {RollContext} context 
    */
export async function createClashResponse(actor, context) {
    const desc = context.getDescription();
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-response.hbs", {
        weapons: actor.items.filter(x => x.type == "weapon" && actor.getCanUseItem(x)),
        outfits: actor.items.filter(x => x.type == "outfit"),
        rollContext: context,
        enrichedClashData: enrichClashData(desc),
        actor: actor,
        hasForceField: actor.system.forceFields > 0
    });

    let allowClose = false;
    let dontSendMessage = false;
    const dialog = new Dialog({
        title: "",
        content: content,
        buttons: {
            skip: {
                label: "Take Unopposed",
                callback: () => {
                    sendNetworkMessage("RESOLVE_CLASH", {
                        target: context.target,
                        attacker: context.actor
                    });
                    allowClose = true;
                    dialog.close();
                }
            },
            redirect: {
                label: "Redirect",
                callback: () => {
                    allowClose = true;
                    dontSendMessage = true;
                    let options = [];
                    let actors = findActorsOfTeam(actor);
                    for (let actor of actors) {
                        options.push({
                            displayName: actor.name,
                            name: actor.id
                        });
                    }
                    let res = pollUserInputOptions(actor, "Select ally to redirect to.", options).then((target) => {
                        target = findByID(target);
                        sendNetworkMessage("PENDING_CLASH", {
                            target: target,
                            attacker: context.actor,
                            context: context
                        });
                        sendNetworkMessage("OVERWRITE_CLASH", {
                            target: target,
                            attacker: context.actor
                        });
                        dialog.close();
                    })
                }
            }
        },
        close: () => {
            if (!allowClose && !dontSendMessage) {
                console.log("closing statement");
                sendNetworkMessage("RESOLVE_CLASH", {
                    target: context.target,
                    attacker: context.actor
                });
            }
            else if (allowClose) {

            }
            else {
                throw new Error();
            }
        },
        render: async (html) => {
            $("#crw-outfits").hide();

            if (actor.system.reactions <= 0 || actor.system.staggered) {
                $("#cr-mainBlock").hide();
                $("#cr-altBlock").show();
            }
            else {
                $("#cr-altBlock").hide();
            }

            html.on('click', '.rollable', async (event) => {
                const element = event.currentTarget;
                const dataset = element.dataset;

                const itemId = element.closest('.item').dataset.itemId;
                if (itemId == "FORCE_FIELD") {
                    const ctx = new RollContext();
                    ctx.target = context.target;
                    ctx.actor = actor;
                    ctx.type = "Block";
                    ctx.attackType = "Block";
                    ctx.name = "Force Field";
                    ctx.damageType = "Block";
                    ctx.diceMax = 10;
                    ctx.dicePower = actor.system.abilities.Temperance.value;
                    let roll = new Roll(`1d10+${actor.system.abilities.Temperance.value}`);
                    roll.evaluate().then((x) => {
                        ctx.result = x.total;

                        actor.queueRoll(ctx).then(() => {
                            allowClose = true;

                            sendNetworkMessage("RESOLVE_CLASH", {
                                target: context.target,
                                attacker: context.actor
                            });
                            
                            dialog.close();

                            createClashMessage(actor, ctx);
                        });
                    });
                }
                else {
                    const item = actor.items.get(itemId);
                    item.roll(false, null, context).then(() => {
                        allowClose = true;

                        sendNetworkMessage("RESOLVE_CLASH", {
                            target: context.target,
                            attacker: context.actor
                        });
                        
                        dialog.close();
                    })
                }
            });

            html.on('click', '.crw-tab-button', (event) => {
                const element = event.currentTarget;
        
                if (element.textContent == "Weapons") {
                    $("#crw-outfits").hide();
                    $("#crw-weapons").show();
                }

                if (element.textContent == "Outfits") {
                    $("#crw-outfits").show();
                    $("#crw-weapons").hide();
                }
            });
        }
    }, {
        width: 500,
        height: (actor.system.reactions <= 0 || actor.system.staggered) ? 370 : 600,
    }).render(true);
}
