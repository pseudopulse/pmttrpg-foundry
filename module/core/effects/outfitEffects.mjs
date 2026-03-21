import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";
import { Conditional } from "../combat/rollContext.mjs";
import { createAlertBox, pollUserInputOptions, pollUserInputText } from "../helpers/dialog.mjs";

export const outfitEffects = [
    new Effect(
        "Block Power Up",
        (context, count, trigger) => {
            if (context.damageType == "Block") {
                context.dicePower = Number(context.dicePower) + Number(count);
            }
        },
        null,
        ["Always Active"],
        false
    ),
    new Effect(
        "Evade Power Up",
        (context, count, trigger) => {
            if (context.damageType == "Evade") {
                context.dicePower = Number(context.dicePower) + Number(count);
            }
        },
        null,
        ["Always Active"],
        false
    ),
    new Effect(
        "Block Max Up",
        (context, count, trigger) => {
            if (context.damageType == "Block") {
                context.diceMax = Number(context.diceMax) + Number(count);
            }
        },
        null,
        ["Always Active"],
        false
    ),
    new Effect(
        "Evade Max Up",
        (context, count, trigger) => {
            if (context.damageType == "Evade") {
                context.diceMax = Number(context.diceMax) + Number(count);
            }
        },
        null,
        ["Always Active"],
        false
    ),
    markerEffect("Enemy Power Down", true, 5, (count) => {
        if (count >= 0) {
            return [`Target loses ${count} Dice Power.`, null, null, null, null, null];
        }
        else {
            return [`Target gains ${count} Dice Power.`, null, null, null, null, null];
        }
    }),
    //
    markerEffect("Burn Resistance", true, 5),
    markerEffect("Frostbite Resistance", true, 5),
    markerEffect("Bleed Resistance", true, 5),
    markerEffect("Rupture Resistance", true, 5),
    markerEffect("Tremor Resistance", true, 5),
    markerEffect("Sinking Resistance", true, 5),
    markerEffect("Damage Resistance", true, 3),
    markerEffect("Vital Protections", true, 5),
    markerEffect("Impact Guard", true, 4),
    //
    markerEffect("Additional Reaction", false, 1),
    markerEffect("Additional Block", false, 1),
    //
    simpleStatusEffect("Burn", false),
    simpleStatusEffect("Frostbite", false),
    simpleStatusEffect("Bleed", false),
    simpleStatusEffect("Rupture", true),
    simpleStatusEffect("Tremor", true),
    simpleStatusEffect("Sinking", true),
    simpleStatusEffect("Smoke", false),
    simpleStatusEffect("Paralysis", true),
    simpleStatusEffect("Fragile", true),
    simpleStatusEffect("Stagger Fragile", true),
    new Effect(
        "Inflict [Type] Fragile",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let type = await pollUserInputOptions(ctx.actor, "Choose [Type] Fragility to inflict.", [
                    {
                        name: "Slash Fragility",
                        icon: "/status/Slash_Fragility.png"
                    },
                    {
                        name: "Pierce Fragility",
                        icon: "/status/Pierce_Fragility.png"
                    },
                    {
                        name: "Blunt Fragility",
                        icon: "/status/Blunt_Fragility.png"
                    },
                ]);
                data.applyInfliction(type.replace(" ", "_"), 2, true);
            });
        },
        (count) => {
            return `Apply ${count} [Type] Fragility, chosen on application.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
    ),
    simpleStatusEffect("Ruin", false),
    new Effect(
        `Gain Poise`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Poise", count, false);
        },
        (count) => {
            return handleNegativeText(
                `Gain % [/status/Poise] Poise`,
                `Inflict % [/status/Poise] Poise`,
                count);
        },
        ["Clash Win", "Clash Lose"],
    ),
    //
    new Effect(
        "Padded Clothing",
        (context, count, trigger) => {
            context.events["Combat Start"].push(async (context) => {
                if (count >= 0) {
                    let hp = context.actor.system.attributes.health.temp;
                    await context.actor.healTemp(count * 3);
                    createEffectsMessage(context.actor.name, `Gains ${count * 3} Temporary HP from Padded Clothing! (${hp} -> ${context.actor.system.attributes.health.temp})`);
                }
                else {
                    let hp = context.actor.system.attributes.health.value;
                    await context.actor.takeDamage(0, context, count * 3, 0, 0, true);
                    createEffectsMessage(context.actor.name, `Receives ${count * 3} HP damage from Padded Clothing! (${hp} -> ${context.actor.system.attributes.health.value})`);
                }
            });
        },
        (count) => {
            if (count >= 0) {
                return `Gain ${count * 3} Temp. HP`;
            }
            else {
                return `Take ${count * 3} HP damage.`
            }
        },
        ["Combat Start"],
        true,
        5, false, true
    ),
    new Effect(
        "Shock Absorbant",
        (context, count, trigger) => {
            context.events["Combat Start"].push(async (context) => {
                if (count >= 0) {
                    let hp = context.actor.system.attributes.stagger.temp;
                    await context.actor.healTemp(0, count * 3);
                    createEffectsMessage(context.actor.name, `Gains ${count * 3} Temporary ST from Shock Absorbant! (${hp} -> ${context.actor.system.attributes.stagger.temp})`);
                }
                else {
                    let hp = context.actor.system.attributes.stagger.value;
                    await context.actor.takeDamage(0, context, count * 3, 0, 0, true);
                    createEffectsMessage(context.actor.name, `Receives ${count * 3} ST damage from Shock Absorbant! (${hp} -> ${context.actor.system.attributes.stagger.value})`);
                }
            });
        },
        (count) => {
            if (count >= 0) {
                return `Gain ${count * 3} Temp. ST`;
            }
            else {
                return `Take ${count * 3} ST damage.`
            }
        },
        ["Combat Start"],
        true,
        5, false, true
    ),
    new Effect(
        "Fashionable Threads",
        (context, count, trigger) => {
            context.events["Combat Start"].push(async (context) => {
                let hp = context.actor.system.attributes.sanity.temp;
                await context.actor.healTemp(0, 0, count * 2);
                createEffectsMessage(context.actor.name, `Gains ${count * 2} Temporary SP from Fashionable Threads! (${hp} -> ${context.actor.system.attributes.sanity.temp})`);
            });
        },
        (count) => {
            return `Gain ${count * 2} Temp. SP`;
        },
        ["Combat Start"],
        false,
        5, false, true
    ),
    new markerEffect("Comfy Clothes", true, 5),
    new markerEffect("Insulated Fabric", true, 5),
    new markerEffect("Light Material", true, 5),
    new Effect(
        "Boosters",
        (context, count, trigger) => {
            context.events["Combat Start"].push(async (context) => {
                await context.actor.applyStatus("Haste", count);
                createEffectsMessage(context.actor.name, `Gains ${count} [/status/Haste] Haste from Boosters!`);
            });
        },
        (count) => {
            return `Gain ${count} [/status/Haste] Haste.`;
        },
        ["Combat Start"], false, 5, false, true
    ),
    //
    new Effect(
        "Gain Charge",
        (context, count, trigger) => {
            let c = context.recycled ? Math.floor(count / 2) : count;
            context.triggers[trigger].applyInfliction("Charge", c, false);
        },
        (count) => {
            return `Gain ${count} [/status/Charge]. If this reaction is Recycled, gain ${Math.floor(count / 2)} [/status/Charge] Charge instead.`
        },
        ["On Use"], false, 6
    ),
    markerEffect("Shielded Attire", false, 5),
    new Effect(
        `Power Engine`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Power Engine [C]", `Spend 8 Charge to gain 1 Dice Power.`, (context) => {
                context.dicePower = Number(context.dicePower) + 1;
            }, [{ cost: 8, status: "Charge"}], "Power Engine [O]"));

            context.conditionals.push(new Conditional("Power Engine [O]", `Spend 1 Overcharge to gain 2 Dice Power`, (context) => {
                context.dicePower = Number(context.dicePower) + 2;
            }, [{ cost: 1, status: "Overcharge"}], "Power Engine [C]"));
        },
        (count) => {
            return [null, null, null, "May spend 8 [/status/Charge] Charge to gain 1 Dice Power, or 1 [/status/Overcharge] Overcharge to gain 2 Dice Power.", null];
        },
        ["Always Active"],
        false,
        1, true
    ),
    new Effect(
        `Barrier Ionization`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Barrier Ionization [C]", `Spend 3 Charge to gain 1 Charge Barrier.`, (context) => {
                context.triggers[trigger].applyInfliction("Charge_Barrier", -1, false);
            }, [{ cost: 3, status: "Charge"}], "Barrier Ionization [O]"));

            context.conditionals.push(new Conditional("Barrier Ionization [O]", `Spend 1 Overcharge to gain 3 Charge Barrier`, (context) => {
                context.triggers[trigger].applyInfliction("Charge_Barrier", -3, false);
            }, [{ cost: 1, status: "Overcharge"}], "Barrier Ionization [C]"));
        },
        (count) => {
            return "May spend 3 [/status/Charge] Charge to gain 1 [/status/Charge_Barrier] Charge Barrier or 1 [/status/Overcharge] Overcharge to gain 3 [/status/Charge_Barrier] Charge Barrier.";
        },
        ["Clash Win", "Clash Lose"],
        false,
        1
    ),
    new Effect(
        `Galvanic Pulse`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Galvanic Pulse [C]", `Spend 10 Charge to inflict 1 Feeble or 1 Disarm.`, async (context) => {
                let status = await pollUserInputOptions(context.actor, "Choose Galvanic Pulse status effect!", [
                    {
                        name: "Feeble",
                        icon: "/status/Feeble.png"
                    },
                    {
                        name: "Disarm",
                        icon: "/status/Disarm.png"
                    }
                ]);
                context.triggers[trigger].applyInfliction(status, 1, false);
            }, [{ cost: 10, status: "Charge"}], "Galvanic Pulse [O]"));

            context.conditionals.push(new Conditional("Galvanic Pulse [O]", `Spend 1 Overcharge to inflict 1 Feeble and 1 Disarm.`, (context) => {
                context.triggers[trigger].applyInfliction("Feeble", 1, false);
                context.triggers[trigger].applyInfliction("Disarm", 1, false);
            }, [{ cost: 1, status: "Overcharge"}], "Galvanic Pulse [C]"));
        },
        (count) => {
            return "May spend 10 [/status/Charge] Charge to inflict 1 [/status/Feeble] Feeble or 1 [/status/Disarm] Disarm immediately, or 1 [/status/Overcharge] Overcharge to apply both.";
        },
        ["Clash Win", "Clash Lose"],
        false,
        1
    ),
    markerEffect("Kinetic Inductor", true, 5),
    new Effect(
        "Charged Boost",
        (context, count, trigger) => {
            context.macros.push({
                name: "Charged Boost",
                callback: async (actor) => {
                    let type = await pollUserInputOptions(game.user, "Select [/status/Charge] Charge or [/status/Overcharge] Overcharge to spend for Charged Boost", [
                        {
                            name: "Charge",
                            icon: "/status/Charge.png",
                        },
                        {
                            name: "Overcharge",
                            icon: "/status/Overcharge.png",
                        },
                    ]);
                    
                    let points = count;
                    let scount = actor.getStatusCount(type);

                    if ((type == "Charge" && scount < 3) || (type == "Overcharge" && scount < 1)) {
                        createAlertBox("You can't afford that!");
                        return;
                    }

                    let toSpend = await pollUserInputText(game.user, `Choose how much [/status/${type}] ${type} to spend for Charged Boost!`, `${type} Amount`, "number", type == "Charge" ? Math.min(3 * points, actor.getStatusCount("Charge")) : Math.min(points, actor.getStatusCount("Overcharge")));
                    if (type == "Charge" && toSpend < 3) {
                        toSpend = 3;
                    }

                    let increment = type == "Charge" ? toSpend / 3 : toSpend;

                    await actor.update({ "system.nextRoundMovement": Number(actor.system.nextRoundMovement) + increment }, { diff: false });
                    createEffectsMessage(actor.name, `Spends ${toSpend} [/status/${type}] ${type} to gain ${increment} SQR of movement next round!`);
                    await actor.reduceStatus(type, toSpend);
                },
                img: "icons/Charged_Boost.png"
            });
        },
        null,
        ["Always Active"],
        false, 5, false, false
    ),
    markerEffect("Charged Hull", false, 1),
]

function simpleStatusEffect(status, nextRound) {
    let str = nextRound ? " next round" : "";
    return new Effect(
        `Inflict ${status}`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction(status, count, nextRound);
        },
        (count) => {
            return handleNegativeText(
                `Inflict % [/status/${status}] ${status}` + str,
                `Gain % [/status/${status}] ${status}` + str,
                count);
        },
        ["Clash Win", "Clash Lose"]
    );
}

function markerEffect(name, negative = false, count = 1, desc = null) {
    return new Effect(
        name,
        (context, count, trigger) => { },
        desc,
        ["Always Active"],
        negative,
        count
    );
}