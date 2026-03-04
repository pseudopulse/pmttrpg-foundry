import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";

export const skillEffects = [
    new Effect(
        "Dice Power Up",
        (context, count, trigger) => { 
            context.dicePower = Number(context.dicePower) + Number(count);
        },
        (count) => {
            return [count < 0 ? `Reduce Dice Power by ${Math.abs(count)}` : `Increase Dice Power by ${count}`, null, null]
        },
        ["Always Active"],
        true,
        5,
        true
    ),
    new Effect(
        "Gain Charge",
        (context, count, trigger) => {
            if (count < 0) {
                context.costs.push({
                    cost: Math.abs(count),
                    status: "Charge"
                })
            }
            else {
                context.triggers["On Use"].applyInfliction("Charge", -count);
            }
        },
        (count) => {
            return count < 0 ? `Spend ${Math.abs(count)} [/status/Charge] Charge` : `Gain ${count} [/status/Charge] Charge`;
        },
        ["On Use"],
        true,
        6
    ),
    new Effect(
        "Adaptive Shot",
        (context, count, trigger) => {
            context.costs.push({
                cost: 2,
                status: "Overcharge"
            });
            
            context.dicePower = Number(context.dicePower) - 1;
        },
        (count) => {
            return "Spend 2 [/status/Overcharge] Overcharge. Shot is replaced with a piercing up to 2x weapon range that may redirect on hit up to two times. -1 Dice Power to all attacks and Clash Effects only apply to the first target."
        },
        ["On Use"],
        true,
        1
    )
]