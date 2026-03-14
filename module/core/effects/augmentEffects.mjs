import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";

export const augmentEffects = [
    new Effect(
        "Inflict Burn",
        (context, count, trigger) => { 

        },
        null,
        ["Always Active"]
    ),
]