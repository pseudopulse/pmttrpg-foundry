import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { Conditional } from "../combat/rollContext.mjs";
import { pollUserInputOptions } from "../helpers/dialog.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";

export const weaponEffects = [
    // Dice Manipulation
    new Effect(
        "Dice Power Up",
        (context, count, trigger) => { context.dicePower = Number(context.dicePower) + Number(count); },
        null,
        ["Always Active"]
    ),
    new Effect(
        "Dice Max Up",
        (context, count, trigger) => { 
            let negative = count < 0;
            count = Math.abs(count);

            if (negative) {
                for (let i = 0; i < count; i++) {
                    if (Number(context.diceMax) <= 1) {
                        context.dicePower = Number(context.dicePower) - 1;
                    }
                    else {
                        context.diceMax = Number(context.diceMax) - 1;
                    }
                }
            }
            else {
                context.diceMax = Number(context.diceMax) + Number(count);
            }
        },
        null,
        ["Always Active"]
    ),
    new Effect(
        "Enemy Power Down",
        (context, count, trigger) => {
            context.enemyPowerMod += count;
        },
        (count) => {
            return handleNegativeText(
                "Decrease target's Dice Power by %", 
                "Increase target's Dice Power by %", 
            count);
        },
        ["On Use"],
    ),
    // Status Effects
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
    // Misc Effects
    new Effect(
        "Multi-hit",
        (context, count, trigger) => { 
            context.conditionals.push(new Conditional("Multi-Hit", `Lose 2 Dice Power. Replace attack with ${count + 1} attacks.`, (context) => {
                context.dicePower = Number(context.dicePower) - 2;
                context.diceCount = Number(context.diceCount) + Number(count);
            }));
        },
        null,
        ["Always Active"],
        false,
        2
    ),
    // Melee Only
    new Effect(
        "Double-Edged",
        (context, count, trigger) => { 
            context.triggers["Clash Win"].applyInfliction("Bleed", 2, true);
            context.triggers["Clash Lose"].applyInfliction("Bleed", -2, true);
        },
        (count) => {
            return [null, "Inflict 2 [/status/Bleed] Bleed", "Gain 2 Bleed", null, null];
        },
        ["Always Active"],
        false,
        1,
        true
    ),
    new Effect(
        `Gain Haste`,
        (context, count, trigger) => {
            if (count < 0) {
                context.triggers[trigger].applyInfliction("Bind", count, true);
            }
            else {
                context.triggers[trigger].applyInfliction("Haste", -count, false);
            }
        },
        (count) => {
            return handleNegativeText(
                `Gain % [/status/Haste] Haste next round`,
                `Gain % [/status/Bind] Bind next round`, 
            count);
        },
        ["Clash Win", "Clash Lose"],
    ),
    new Effect(
        `Increase Range`,
        (context, count, trigger) => {
            context.range += 1;
        },
        null,
        ["Always Active"],
        false,
        1
    ),
    new Effect(
        `Extension Grip`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Extension Grip [C]", `Spend 4 Charge to increase range by 1 SQR.`, (context) => {
            }, [{ cost: 4, status: "Charge"}], "Extension Grip [O]"));

            context.conditionals.push(new Conditional("Extension Grip [O]", `Spend 1 Overcharge to increase range by 2 SQR.`, (context) => {
            }, [{ cost: 1, status: "Overcharge"}], "Extension Grip [C]"));
        },
        (count) => {
            return [null, null, null, "May spend 4 [/status/Charge] Charge to increase range by 1 SQR, or 1 [/status/Overcharge] Overcharge to increase by 2 SQR.", null];
        },
        ["Always Active"],
        false,
        1,
        true
    ),
    new Effect(
        `Extra DMG Type`,
        (context, count, trigger) => {
            
        },
        null,
        ["Always Active"],
        false,
        2
    ),
    new Effect(
        `Inflict Bind`,
        (context, count, trigger) => {
            context.trigger[trigger].applyInfliction("Bind", count, true);
        },
        (count) => {
            return `Inflict ${count} [/status/Bind] Bind next round.`
        },
        ["Clash Win", "Clash Lose"],
        false
    ),
    new Effect(
        `Retracting Cable`,
        (context, count, trigger) => {
            
        },
        null,
        ["Always Active"],
        false,
        1
    ),
    markerEffect("Throwing Weapon", false, 1),
    // Ranged Effects
    new Effect(
        `Extra Range`,
        (context, count, trigger) => {
            
        },
        null,
        ["Always Active"],
        true,
        5
    ),
    // Charge Effects
    new Effect(
        `Gain Charge`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Charge", -count, false);
        },
        (count) => {
            return `Gain ${Math.abs(count)} [/status/Charge] Charge`;
        },
        ["On Use"],
        false,
        6
    ),
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
        `Refractor`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Refractor [C]", `Spend 4 Charge to inflict +1 of all [Status]+ compatible effects.`, (context) => {
                context.flags.push("Refractor-C");
            }, [{ cost: 4, status: "Charge"}], "Refractor [O]"));

            context.conditionals.push(new Conditional("Refractor [O]", `Spend 1 Overcharge to inflict +3 of all [Status]+ compatible effects.`, (context) => {
                context.flags.push("Refractor-O");
            }, [{ cost: 1, status: "Overcharge"}], "Refractor [C]"));
        },
        (count) => {
            return "May spend 4 [/status/Charge] Charge to inflict +1 of all [Status]+ compatible effects, or 1 [/status/Overcharge] Overcharge to inflict +3.";
        },
        ["On Use"],
        false,
        1
    ),
    new Effect(
        `Galvanic Pulse`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Galvanic Pulse [C]", `Spend 10 Charge to inflict 1 Feeble or 1 Disarm.`, async (context) => {
                let status = await pollUserInputOptions("Choose Galvanic Pulse status effect!", [
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
    new Effect(
        `Countercurrent`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Countercurrent [C]", `Spend 4 Charge to inflict 1 Paralysis.`, (context) => {
                context.triggers[trigger].applyInfliction("Paralysis", 1, false);
            }, [{ cost: 4, status: "Charge"}], "Countercurrent [O]"));

            context.conditionals.push(new Conditional("Countercurrent [O]", `Spend 1 Overcharge to inflict 2 Paralysis.`, (context) => {
                context.triggers[trigger].applyInfliction("Paralysis", 2, false);
            }, [{ cost: 1, status: "Overcharge"}], "Countercurrent [C]"));
        },
        (count) => {
            return "May spend 4 [/status/Charge] Charge to inflict 1 [/status/Paralysis] Paralysis immediately, or 1 [/status/Overcharge] Overcharge to inflict 2.";
        },
        ["Clash Win", "Clash Lose"],
        false,
        1
    ),
    new Effect(
        `Magnetic Drive`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Magnetic Drive [C]", `Spend 6 Charge to push the target 1 SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pushed 1 SQR away from ${context.actor.name} by Magnetic Drive!`);
                });
            }, [{ cost: 6, status: "Charge"}], "Magnetic Drive [O]"));

            context.conditionals.push(new Conditional("Magnetic Drive [O]", `Spend 1 Overcharge to push the target 2 SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pushed 2 SQR away from ${context.actor.name} by Magnetic Drive!`);
                });
            }, [{ cost: 1, status: "Overcharge"}], "Magnetic Drive [C]"));
        },
        (count) => {
            return "May spend 6 [/status/Charge] Charge to push the target 1 SQR, or 1 [/status/Overcharge] Overcharge to push them 2.";
        },
        ["Clash Win"],
        false,
        1, false, true
    ),
    markerEffect("Charge Ammo", false, 1),
    new Effect(
        `Loaded Magnet`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Loaded Magnet [C]", `Spend 6 Charge to pull the target ${count} SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pulled ${count} SQR towards ${context.actor.name} by Loaded Magnet!`);
                });
            }, [{ cost: count * 3, status: "Charge"}], "Loaded Magnet [O]"));

            context.conditionals.push(new Conditional("Loaded Magnet [O]", `Spend 1 Overcharge to pull the target ${count * 3} SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pulled ${count * 3} SQR towards ${context.actor.name} by Loaded Magnet!`);
                });
            }, [{ cost: count, status: "Overcharge"}], "Loaded Magnet [C]"));
        },
        (count) => {
            return `May spend ${3 * count} [/status/Charge] Charge to pull the target ${count} SQR, or ${count} [/status/Overcharge] Overcharge to pull them ${count * 3}.`;
        },
        ["On Use"],
        false,
        1, false, true
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

function markerEffect(name, negative = false, count = 1) {
    return new Effect(
        name,
        (context, count, trigger) => { },
        null,
        ["Always Active"],
        negative,
        count
    );
}