import { RollContext } from "../combat/rollContext.mjs";
import { enrichClashData } from "../helpers/clash.mjs";
import { sendNetworkMessage } from "./netmsg.mjs";

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
                        console.log(action);

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
                            console.log(input);
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
                        data.activeConditionals.push(context.conditionals.find(x => x.name == itemId));

                        html.find('input').each((x, input) => {
                            console.log(input);
                            if (input.classList.contains('conditional-toggle') && input != event.currentTarget) {
                                if (context.conditionals.find(x => x.name == itemId).exclusiveWith == input.closest('.item').dataset.itemId) {
                                    input.checked = false;
                                }
                            }
                        });
                    }
                    else {
                        const itemId = event.currentTarget.closest('.item').dataset.itemId;
                        data.activeConditionals = data.activeConditionals.filter(x => x.name != itemId);
                    }
                })

                html.on('click', '.amw-tab-button', (event) => {
                    const element = event.currentTarget;
                    console.log(element);
        
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

/**
    * @param {RollContext} context 
    */
export async function createClashResponse(actor, context) {
    const desc = context.getDescription();
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-response.hbs", {
        weapons: actor.items.filter(x => x.type == "weapon"),
        outfits: actor.items.filter(x => x.type == "outfit"),
        rollContext: context,
        enrichedClashData: enrichClashData(desc),
        actor: actor
    });

    let allowClose = false;
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
            }
        },
        close: () => {
            if (!allowClose) {
                throw new Error();
            }
        },
        render: async (html) => {
            $("#crw-outfits").hide();
            html.on('click', '.rollable', async (event) => {
                const element = event.currentTarget;
                const dataset = element.dataset;

                const itemId = element.closest('.item').dataset.itemId;
                const item = actor.items.get(itemId);
                item.roll(false).then(() => {
                    allowClose = true;

                    console.log("resolving clash now !!");

                    sendNetworkMessage("RESOLVE_CLASH", {
                        target: context.target,
                        attacker: context.actor
                    });
                    
                    dialog.close();
                })
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
        height: 600,
    }).render(true);
}
