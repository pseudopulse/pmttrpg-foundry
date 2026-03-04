import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";

export const outfitEffects = [
    new Effect(
        "Block Power Up",
        (context, count, trigger) => { if (context.damageType == "Block") {
            context.dicePower = Number(context.dicePower) + Number(count);
        } },
        null,
        ["Always Active"]
    ),
]