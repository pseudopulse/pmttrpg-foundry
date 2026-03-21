import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";

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
                let type = await pollUserInputOptions("Choose [Type] Fragility to inflict.", [
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