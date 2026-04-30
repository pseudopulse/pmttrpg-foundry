import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { Conditional } from "../combat/rollContext.mjs";
import { pollUserInputOptions } from "../helpers/dialog.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";

export const bulletList = [
    new Effect(
        "Standard",
        (context, trigger, count) => {},
        (count) => {},
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Tracer",
        (context, trigger, count) => {
            context.events["Clash Win"].push(async (context) => {
                await context.actor.handleLoadedBranding(context.target);
            });
        },
        (count) => {
            return `Mark the target with a mark of choice.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        "Quake",
        (context, trigger, count) => {
            context.triggers["Clash Win"].applyInfliction("Tremor", 5, true);
        },
        (count) => {
            return `Inflict 5 [/status/Tremor] Tremor next round.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Precision",
        (context, trigger, count) => {
            context.events["Clash Win Instant"].push(async (context) => {
                await context.actor.applyStatus("Critical", 2, false);
                createEffectsMessage(context.actor, `Gains 2 [/status/Critical] Critical from the Precision Round!`)
            });
        },
        (count) => {
            return `Gain 2 [/status/Critical] Critical.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        "Corrosive",
        (context, trigger, count) => {
            context.events["Clash Win Instant"].push(async (context) => {
                await context.target.applyStatus("Devastation", 1, false);
                await context.target.applyStatus("Rupture", 4, true);
                createEffectsMessage(context.actor, `Inflicts 1 [/status/Devastation] Devastation immediately and 4 [/status/Rupture] Rupture next round from the Corrosive Round!`)
            });
        },
        (count) => {
            return `Inflict 1 [/status/Devastation] Devastation immediately and 4 [/status/Rupture] Rupture next round.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        "Tranquilizer",
        (context, trigger, count) => {
            context.triggers["Clash Win"].applyInfliction("Bind", 4, true);
        },
        (count) => {
            return `Inflict 4 [/status/Bind] Bind next round.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Glass",
        (context, trigger, count) => {
            context.triggers["Clash Win"].applyInfliction("Bleed", 5, false);
        },
        (count) => {
            return `Inflict 5 [/status/Bleed] Bleed.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Flame",
        (context, trigger, count) => {
            context.triggers["Clash Win"].applyInfliction("Burn", 5, false);
        },
        (count) => {
            return `Inflict 5 [/status/Burn] Burn.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "AP",
        (context, trigger, count) => {
            context.triggers["Clash Win"].applyInfliction("Fragile", 4, true);
        },
        (count) => {
            return `Inflict 4 [/status/Fragile] Fragile next round.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Impact",
        (context, trigger, count) => {
            
        },
        (count) => {
            return `Push target 3 SQR.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Shock",
        (context, trigger, count) => {
            context.triggers["Clash Win"].applyInfliction("Paralysis", 2, true);
            context.triggers["Clash Win"].applyInfliction("Disarm", 1, true);
        },
        (count) => {
            return `Inflict 2 [/status/Paralysis] Paralysis and 1 [/status/Disarm] Disarm next round.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Destabilizing",
        (context, trigger, count) => {
            context.triggers["Clash Win"].applyInfliction("Frostbite", 3, false);
            context.triggers["Clash Win"].applyInfliction("Feeble", 1, true);
        },
        (count) => {
            return `Inflict 3 [/status/Frostbite] Frostbite immediately and 1 [/status/Feeble] Feeble next round.`
        },
        ["Clash Win"],
        false, 1
    ),
    new Effect(
        "Terror",
        (context, trigger, count) => {
            context.events["Clash Win Instant"].push(async (context) => {
                await context.target.applyStatus("Sinking", 2, false);
                await context.target.applyStatus("Sinking", 3, true);
                createEffectsMessage(context.actor, `Inflicts 2 [/status/Sinking] Sinking immediately and 3 [/status/Sinking] Sinking next round from the Terror Round!`)
            });
        },
        (count) => {
            return `Inflict 2 [/status/Sinking] Sinking immediately and 3 [/status/Sinking] Sinking next round.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        "High Velocity",
        (context, trigger, count) => {
            context.dicePower = Number(context.dicePower) + 2;
            context.nonSkillDicePower = Number(context.nonSkillDicePower) + 2;
        },
        (count) => {
            return `Increase Dice Power by 2. Weapon becomes unusable for a turn.`
        },
        ["On Use"],
        false, 1
    ),
]