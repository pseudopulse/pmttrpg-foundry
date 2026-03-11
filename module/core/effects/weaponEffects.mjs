import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { Conditional } from "../combat/rollContext.mjs";

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
    simpleStatusEffect("[Type] Fragile", true),
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
            return [null, "Inflict 2 [/status/Bleed] Bleed", "Gain 2 Bleed"];
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
            
        },
        (count) => {
            return "May spend 4 [/status/Charge] Charge to increase range by 1 SQR."
        },
        ["On Use"],
        false,
        1
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
    new Effect(
        `Throwing Weapon`,
        (context, count, trigger) => {
            
        },
        null,
        ["Always Active"],
        false,
        1
    ),
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
    )
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