import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { Conditional } from "../combat/rollContext.mjs";
import { pollUserInputOptions } from "../helpers/dialog.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";

export const techniqueList = [
    new Effect(
        "Shove",
        (context, count, trigger) => {},
        (count) => {
            return `Push the target ${Number(count)} SQR.`
        },
        ["Clash Win"],
        false, 5, false, false, 2
    ),
    new Effect(
        "Sweep",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                await ctx.target.addMovementPenalty(count);
            });
        },
        (count) => {
            return `Remove ${Number(count)} SQR from the target's movement next round.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true, 2
    ),
    new Effect(
        "Vital Strike",
        (context, count, trigger) => {
            if (context.isReaction) {
                context.triggers["Clash Win"].hpDamage += 6 * count;
            } else {
                context.triggers["Clash Win"].hpDamage += 3 * count;
            }
        },
        (count) => {
            return `Deal ${3 * count} HP damage. If this is a reaction, deal ${6 * count} HP damage instead.`
        },
        ["Clash Win"],
        false, 5, false, false, 4
    ),
    new Effect(
        "Knockout Strike",
        (context, count, trigger) => {
            if (context.isReaction) {
                context.triggers["Clash Win"].stDamage += 2 * count;
            } else {
                context.triggers["Clash Win"].stDamage += 1 * count;
            }
        },
        (count) => {
            return `Deal ${Number(count)} ST damage. If this is a reaction, deal ${2 * count} ST damage instead.`
        },
        ["Clash Win"],
        false, 5, false, false, 2
    ),
    new Effect(
        "Knockout Strike",
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Protection", -count, true);
            context.triggers[trigger].applyInfliction("Stagger_Protection", -count, true);
        },
        (count) => {
            return `Gain ${Number(count)} [/status/Protection] Protection and [/status/Stagger_Protection] Stagger_Protection next round.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, false, 2
    ),
    new Effect(
        "Overextension",
        (context, count, trigger) => {},
        (count) => {
            return `Increase attack range by 1 SQR for this attack.`
        },
        ["On Use"],
        false, 1, false, false, 3
    ),
    new Effect(
        "Quick Step",
        (context, count, trigger) => {},
        (count) => {
            return `Move ${Number(count)} SQR without provoking Opportunity Attacks.`
        },
        ["Clash Win"],
        false, 5, false, false, 2
    ),
    new Effect(
        "Sleight of Hand",
        (context, count, trigger) => {},
        (count) => {
            return `Sheathe a weapon and pull a new one.`
        },
        ["Clash Win", "Clash Lose"],
        false, 1, false, false, 4
    ),
    new Effect(
        "Adaptability",
        (context, count, trigger) => {},
        (count) => {
            return `Stow an outfit and equip a new one.`
        },
        ["Clash Win", "Clash Lose"],
        false, 1, false, false, 4
    ),
    new Effect(
        "Shrug Off",
        (context, count, trigger) => {
            context.events[trigger].push(async (ctx) => {
                await ctx.actor.performReduceStatus("Reduce Status", ctx.actor.getReduceStatusCount());
            });
        },
        (count) => {
            return `Trigger Reduce Status on self.`
        },
        ["Clash Win"],
        false, 1, false, true, 4
    ),
    new Effect(
        "Headlock",
        (context, count, trigger) => {},
        (count) => {
            return `Initiate a Grapple check against the target.`
        },
        ["Clash Win"],
        false, 1, false, false, 5
    ),
    new Effect(
        "Full Reversal",
        (context, count, trigger) => {
            if (context.defFollowup) {
                context.dicePower = Number(context.dicePower) + (count * 2);
                context.nonSkillDicePower = Number(context.nonSkillDicePower) + (count * 2);
            }
            else {
                context.dicePower = Number(context.dicePower) + (count);
                context.nonSkillDicePower = Number(context.nonSkillDicePower) + (count);
            }
        },
        (count) => {
            return `Gain ${Number(count)} Dice Power. If you previously Defensive Clash Won against this target in the turn, gain an additional ${Number(count)}.`
        },
        ["On Use"],
        false, 3, false, false, 2
    ),
    new Effect(
        "Toughen Up",
        (context, count, trigger) => {},
        (count) => {
            return `Trigger the Protect action.`
        },
        ["Clash Win"],
        false, 1, false, false, 4
    ),
    new Effect(
        "Emotion Level",
        (context, count, trigger) => {
            context.events[trigger].push(async (ctx) => {
                await ctx.actor.triggerEmotionLevel();
            });
        },
        (count) => {
            return `Gain 1 Light.`
        },
        ["Clash Win"],
        false, 1, false, true, 4
    ),
    new Effect(
        "Mood Swing",
        (context, count, trigger) => {},
        (count) => {
            return `Change your Disposition.`
        },
        ["Clash Win"],
        false, 1, false, false, 4
    ),
    new Effect(
        "Upheaval",
        (context, count, trigger) => {},
        (count) => {
            return `Create ${Number(count) * 2} SQR of difficult terrain nearby.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, false, 1
    ),
    new Effect(
        "Create Barrier",
        (context, count, trigger) => {},
        (count) => {
            return `Create ${Number(count)} SQR of half cover nearby.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, false, 2
    ),
    new Effect(
        "Versatility",
        (context, count, trigger) => {},
        (count) => {
            return `Change this attack to a damage type of the user's choice.`
        },
        ["On Use"],
        false, 1, false, false, 2
    ),
]