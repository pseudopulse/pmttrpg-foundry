import { createEffectsMessage } from "../helpers/clash.mjs";
import { StatusEffect, Triggers } from "./statusEffect.mjs";

export const statusList = [
    new StatusEffect("Burn", Triggers.END, async (actor) => {
        let burn = actor.getStatusCount("Burn");
        await actor.takeDamageStatus(actor.getStatusCount("Burn"), "Burn", "HP", "[/status/Burn] Burned for %DMG% HP damage! (%PHP% -> %HP%)")
        let res = actor.augmentEffectCount("Burn Resistance") + actor.outfitEffectCount("Burn Resistance");
        res = Math.min(res, burn);
        if (res > 0 && actor.augmentEffectCount("Restorative Warmth") > 0) {
            let php = actor.system.attributes.health.value;
            await actor.heal(res, 0, 0);
            let hp = actor.system.attributes.health.value;
            createEffectsMessage(actor.name, `Heals ${res} HP from Restorative Warmth! (${php} -> ${hp})`);
        }

        if ((burn - res) > 0 && actor.augmentEffectCount("Afterburn") > 0) {
            let val = Math.max(Math.floor((burn - res) / 2), 1);
            await actor.applyStatus("Smoke", val);
            createEffectsMessage(actor.name, `Gains ${val} [/status/Smoke] Smoke from Afterburn!`);
        }
    }, (count) => { return count / 2 }),
    new StatusEffect("Frostbite", Triggers.END, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Frostbite"), "Frostbite", "ST", "[/status/Frostbite] Froze for %DMG% ST damage! (%PST% -> %ST%)")
        let decay = Math.floor(actor.getStatusCount("Frostbite") / 2);

        if (actor.augmentEffectCount("Sublimation") > 0 && res > 0) {
            await actor.applyStatus("Smoke", res);
            createEffectsMessage(actor.name, `Gains ${res} [/status/Smoke] Smoke from Sublimation!`);
        }
    }, (count) => { return count / 2 }),
    new StatusEffect("Bleed", Triggers.ACTION, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Bleed"), "Bleed", "HP", "[/status/Bleed] Bled for %DMG% HP damage! (%PHP% -> %HP%)")

        let res = actor.augmentEffectCount("Bleed Resistance") + actor.outfitEffectCount("Bleed Resistance");
        let bleed = actor.getStatusCount("Bleed") - res;
        if (res > 0 && actor.augmentEffectCount("Blood is Fuel") > 0) {
            await actor.applyStatus("Charge", Math.max(Math.floor(bleed / 2), 1));
            createEffectsMessage(actor.name, `Gains ${Math.max(Math.floor(bleed / 2), 1)} [/status/Charge] Charge from Blood is Fuel!`);
        }

        if (actor.augmentEffectCount("Blood is Fuel Alt") > 0) {
            await actor.applyStatus("Charge", 2);
            createEffectsMessage(actor.name, `Gains 2 [/status/Charge] Charge from Blood is Fuel!`);
        }
        
    }, (count) => { return count / 2 }),
    new StatusEffect("Rupture", Triggers.BURST, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Rupture"), "Rupture", "HP", "[/status/Rupture] Rupture bursted for %DMG% HP damage! (%PHP% -> %HP%)")
    }, (count) => { return 0 }),
    new StatusEffect("Tremor", Triggers.BURST, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Tremor"), "Tremor", "ST", "[/status/Tremor] Tremor bursted for %DMG% ST damage! (%PST% -> %ST%)")
    }, (count) => { return 0 }),
    new StatusEffect("Sinking", Triggers.BURST, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Sinking"), "Sinking", "SP", "[/status/Sinking] Sinking bursted for %DMG% SP damage! (%PSP% -> %SP%)")
    }, (count) => { return 0 }),
    new StatusEffect("Poise", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Critical", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Ruin", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Devastation", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Paralysis", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Stagger_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Slash_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Pierce_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Blunt_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Fragile", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Stagger_Fragile", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Pierce_Fragility", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Pierce_Fragility", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Blunt_Fragility", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Strength", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Feeble", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Endurance", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Disarm", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Haste", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Bind", Triggers.END, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Smoke", Triggers.HIT, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Smoke") / 2, "Smoke", "HP", "Took %DMG% extra HP damage from [/status/Smoke] Smoke! (%PSP% -> %SP%)")
    }, (count) => { return count > 10 ? count - 4 : count - 2 }),
    new StatusEffect("Charge", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Charge_Barrier", Triggers.END, async (actor) => {
        await actor.applyStatus("Charge", actor.getStatusCount("Charge_Barrier"), 0);
        createEffectsMessage(actor.name, `Gains ${actor.getStatusCount("Charge_Barrier")} [/status/Charge] Charge from decaying [/status/Charge_Barrier] Charge Barrier!`);
    }, (count) => { return 0; }),
    new StatusEffect("Overcharge", Triggers.END, async (actor) => {
        let charge = actor.getStatusCount("Charge");
        if (charge > 15) {
            await actor.reduceStatus("Charge", 3 * (Math.floor(charge / 15)));
            createEffectsMessage(actor.name, `Loses ${3 * (Math.floor(charge / 15))} [/status/Charge] Charge from overload!`);
        }
    }, (count) => { return count; }),
    new StatusEffect("Nails", Triggers.NONE, async (actor) => {
        
    }, (count) => { return count; }),
    new StatusEffect("Hemorrhage", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Renewed_Blaze", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Deep_Chill", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Dark_Flame", Triggers.AFTER_DECAY, async (actor) => {
        let burn = actor.getStatusCount("Burn");
        await actor.takeDamageStatus(burn, "Dark_Flame", "SP", "[/status/Dark_Flame] Burned for %DMG% SP damage! (%PSP% -> %SP%)")
    }, (count) => { return 0; }),
    new StatusEffect("Freezer_Burn", Triggers.AFTER_DECAY, async (actor) => {
        let burn = actor.getStatusCount("Frostbite");
        await actor.applyStatus("Burn", burn, 0);
        createEffectsMessage(actor.name, `[/status/Freezer_Burn] Gains ${burn} [/status/Burn] Burn from decaying [/status/Frostbite] Frostbite!`)
    }, (count) => { return 0; }),
    new StatusEffect("Tendon_Slice", Triggers.MOVE, async (actor) => {
        await actor.fireStatusEffect("Bleed");
    }, (count) => { return 0; }),
];

export function findStatusDef(name) {
    return statusList.find(x => x.name == name);
}