import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";

export const weaponEffects = [
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
                `Gain % Poise`,
                `Inflict % Poise`, 
            count);
        },
        ["Clash Win", "Clash Lose"],
    ),
    new Effect(
        "Multi-hit",
        (context, count, trigger) => { 
            context.dicePower = Number(context.dicePower) - 2;
            context.diceCount = Number(context.diceCount) + Number(count);
        },
        null,
        ["Always Active"],
        false,
        2
    ),
    new Effect(
        "Double-Edged",
        (context, count, trigger) => { 
            context.triggers["Clash Win"].applyInfliction("Bleed", 2, true);
            context.triggers["Clash Lose"].applyInfliction("Bleed", -2, true);
        },
        (count) => {
            return [null, "Inflict 2 Bleed", "Gain 2 Bleed"];
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
                `Gain % Haste next round`,
                `Gain % Bind next round`, 
            count);
        },
        ["Clash Win", "Clash Lose"],
    ),
    new Effect(
        `Gain Charge`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Charge", -count, false);
        },
        (count) => {
            return `Gain ${Math.abs(count)} Charge`;
        },
        ["On Use"],
        false,
        6
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
            return "May spend 4 Charge to increase range by 1 SQR."
        },
        ["On Use"],
        false,
        1
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
                `Inflict % ${status}` + str, 
                `Gain % ${status}` + str, 
            count);
        },
        ["Clash Win", "Clash Lose"]
    );
}