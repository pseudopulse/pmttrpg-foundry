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
    //
    markerEffect("Burn Resistance", true, 5),
    markerEffect("Frostbite Resistance", true, 5),
    markerEffect("Bleed Resistance", true, 5),
    markerEffect("Rupture Resistance", true, 5),
    markerEffect("Tremor Resistance", true, 5),
    markerEffect("Sinking Resistance", true, 5),
    markerEffect("Damage Resistance", true, 3),
]

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