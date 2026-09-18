import { StatusEffect, Triggers } from "./statusEffect.mjs";
import { addBloodfeast, getAlliesWithinRadius, getEnemiesWithinRadius } from "../../pmttrpg.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";

export const statusList = [
    new StatusEffect("Burn", Triggers.END, async (actor) => {
        let burn = actor.getStatusCount("Burn");
        await actor.takeDamageStatus(actor.getStatusCount("Burn"), "Burn", "HP", "[/status/Burn] Burned for %DMG% HP damage! (%PHP% -> %HP%)")
        let res = actor.augmentEffectCount("Burn Resistance") + actor.outfitEffectCount("Burn Resistance");
        res = Math.min(res, burn);
        if (res > 0 && actor.augmentEffectCount("Restorative Warmth") > 0) {
            let php = actor.system.attributes.health.value;
            await actor.heal(res, 0, 0, actor);
            let hp = actor.system.attributes.health.value;
            createEffectsMessage(actor.name, `Heals ${res} HP from Restorative Warmth! (${php} -> ${hp})`);
        }

        if ((burn - res) > 0 && actor.augmentEffectCount("Afterburn") > 0) {
            let val = Math.max(Math.floor((burn - res) / 2), 1);
            await actor.applyStatus("Smoke", val);
            createEffectsMessage(actor.name, `Gains ${val} [/status/Smoke] Smoke from Afterburn!`);
        }
    }, (count) => { return count / 2 }, "Take HP damage equal to [/status/Burn] Burn on round end."),
    new StatusEffect("Frostbite", Triggers.END, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Frostbite"), "Frostbite", "ST", "[/status/Frostbite] Froze for %DMG% ST damage! (%PST% -> %ST%)")
        let decay = Math.floor(actor.getStatusCount("Frostbite") / 2);

        if (actor.augmentEffectCount("Sublimation") > 0 && res > 0) {
            await actor.applyStatus("Smoke", res);
            createEffectsMessage(actor.name, `Gains ${res} [/status/Smoke] Smoke from Sublimation!`);
        }
    }, (count) => { return count / 2 }, "Take ST damage equal to [/status/Frostbite] Frostbite on round end."),
    new StatusEffect("Bleed", Triggers.ACTION, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Bleed"), "Bleed", "HP", "[/status/Bleed] Bled for %DMG% HP damage! (%PHP% -> %HP%)")

        await addBloodfeast(actor.getStatusCount("Bleed"));

        let nearby = getEnemiesWithinRadius(actor, 3).concat(getAlliesWithinRadius(actor, 3));
        for (let target of nearby) {
            if (target.augmentEffectCount("Blood Cycler") > 0) {
                let php = target.system.attributes.health.value;
                await target.heal(2, 0, 0, target);
                let hp = target.system.attributes.health.value;
                createEffectsMessage(target.name, `Recovers 2 HP from Blood Cycler! (${php} -> ${hp})`);
            }
        }

        let res = actor.augmentEffectCount("Bleed Resistance") + actor.outfitEffectCount("Bleed Resistance");
        let bleed = actor.getStatusCount("Bleed") - res;
        if (bleed > 0 && actor.augmentEffectCount("Blood is Fuel") > 0) {
            await actor.applyStatus("Charge", Math.max(Math.floor(bleed / 2), 1));
            createEffectsMessage(actor.name, `Gains ${Math.max(Math.floor(bleed / 2), 1)} [/status/Charge] Charge from Blood is Fuel!`);
        }

        if (actor.augmentEffectCount("Blood is Fuel Alt") > 0) {
            await actor.applyStatus("Charge", 2);
            createEffectsMessage(actor.name, `Gains 2 [/status/Charge] Charge from Blood is Fuel!`);
        }
        
    }, (count) => { return count / 2 }, "Take HP damage equal to [/status/Bleed] Bleed when taking actions or reactions."),
    new StatusEffect("Poison", Triggers.ACTION, async (actor) => {
        let dmg = 2 * Math.floor(actor.getStatusCount("Poison") / 10);
        if (dmg > 0) {
            await actor.takeDamageStatus(dmg, "Poison", "HP", "[/status/Poison] Took %DMG% HP damage from Poison! (%PHP% -> %HP%)")

            if (await actor.popEffectTrigger("Lethal Dose")) {
                await actor.takeDamageStatus(Math.floor(actor.getStatusCount("Poison") / 2), "Poison", "HP", "[/status/Poison] Took %DMG% HP damage from Lethal Dose! (%PHP% -> %HP%)")
            }

            if (await actor.popEffectTrigger("Staggering Toxin")) {
                await actor.takeDamageStatus(dmg, "Poison", "ST", "[/status/Poison] Took %DMG% ST damage from Staggering Toxin! (%PST% -> %ST%)")
            }

            if (await actor.popEffectTrigger("Depressing Bane")) {
                await actor.takeDamageStatus(dmg, "Poison", "SP", "[/status/Poison] Took %DMG% SP damage from Depressing Bane! (%PSP% -> %SP%)")
            }

            if (await actor.popEffectTrigger("Centipede Venom")) {
                if (Math.floor(dmg / 2) > 0) {
                    await actor.applyStatus("Disarm", Math.floor(dmg / 2));
                    createEffectsMessage(actor.name, `Receives ${Math.floor(dmg / 2)} [/status/Disarm] Disarm from Centipede Venom.`);
                }
            }
        }
    }, (count) => { 
        let dmg = 2 * Math.floor(count / 10);
        return count - dmg;
    }, "Take 2 HP damage for every 10 [/status/Poison] Poison when taking actions or reactions."),
    new StatusEffect("Rupture", Triggers.BURST, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Rupture"), "Rupture", "HP", "[/status/Rupture] Rupture bursted for %DMG% HP damage! (%PHP% -> %HP%)")
    }, (count) => { return 0 }, "Take HP damage equal to [/status/Rupture] Rupture when this status is burst on you."),
    new StatusEffect("Tremor", Triggers.BURST, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Tremor"), "Tremor", "ST", "[/status/Tremor] Tremor bursted for %DMG% ST damage! (%PST% -> %ST%)");

        if (actor.getStatusCount("Tremor_Reverb") > 0) {
            await actor.takeDamageStatus(actor.getStatusCount("Tremor"), "Tremor", "HP", "[/status/Tremor_Reverb] Tremor bursted for %DMG% HP damage! (%PHP% -> %HP%)");
        }

        if (actor.getStatusCount("Tremor_Everlasting") > 0) {
            let roll = new Roll("1d10");
            let threshold = 5 + actor.getStatusCount("Tremor");
            let evalu = await roll.evaluate();
            let value = evalu.total;

            while (value < threshold) {
                threshold -= 5;
                roll = new Roll("1d10");
                evalu = await roll.evaluate();
                value = evalu.total;
                await actor.takeDamageStatus(actor.getStatusCount("Tremor"), "Tremor", "ST", "[/status/Tremor_Everlasting] Tremor bursted for %DMG% ST damage! (%PST% -> %ST%)");
            }
        }

        let effects = actor.system.statusEffects;

        if (effects != null) {
            for (let eff of effects) {
                if (eff.name.startsWith("Tremor_")) {
                    await actor.setStatus(eff.name, 0);
                }
            }
        }

    }, (count) => { return 0 }, "Take ST damage equal to [/status/Tremor] Tremor when this status is burst on you."),
    new StatusEffect("Sinking", Triggers.BURST, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Sinking"), "Sinking", "SP", "[/status/Sinking] Sinking bursted for %DMG% SP damage! (%PSP% -> %SP%)")
    }, (count) => { return 0 }, "Take SP damage equal to [/status/Sinking] Sinking when this status is burst on you."),
    new StatusEffect("Poise", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "On hit, deal a [/status/Critical] Critical Hit if the value of a rolled d10 is less than your [/status/Poise] Poise"),
    new StatusEffect("Critical", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Adds additional dice to [/status/Critical] Critical Hits"),
    new StatusEffect("Ruin", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "When hit, receive a [/status/Devastation] Devastating Hit if the value of a rolled d10 is less than your [/status/Ruin] Ruin"),
    new StatusEffect("Devastation", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Adds additional dice to [/status/Devastation] Devastating Hits"),
    new StatusEffect("Paralysis", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Actions and reactions have disadvantage"),
    new StatusEffect("Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Reduce incoming HP damage by your [/status/Protection] Protection"),
    new StatusEffect("Stagger_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Reduce incoming ST damage by your [/status/Stagger_Protection] Stagger Protection"),
    new StatusEffect("Slash_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Reduce incoming [/damageTypes/Slash] slash damage by your [/status/Slash_Protection] Slash Protection"),
    new StatusEffect("Pierce_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Reduce incoming [/damageTypes/Pierce] pierce damage by your [/status/Pierce_Protection] Pierce Protection"),
    new StatusEffect("Blunt_Protection", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Reduce incoming [/damageTypes/Blunt] blunt damage by your [/status/Blunt_Protection] Blunt Protection"),
    new StatusEffect("Fragile", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Increase incoming HP damage by your [/status/Fragile] Fragile"),
    new StatusEffect("Stagger_Fragile", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Increase incoming ST damage by your [/status/Stagger_Fragile] Stagger_Fragile"),
    new StatusEffect("Slash_Fragility", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Increase incoming [/damageTypes/Slash] slash damage by your [/status/Slash_Fragility] Slash Fragility"),
    new StatusEffect("Pierce_Fragility", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Increase incoming [/damageTypes/Pierce] pierce damage by your [/status/Pierce_Fragility] Pierce Fragility"),
    new StatusEffect("Blunt_Fragility", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Increase incoming [/damageTypes/Blunt] blunt damage by your [/status/Blunt_Fragility] Blunt Fragility"),
    new StatusEffect("Strength", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Increase offensive dice power by [/status/Strength] Strength"),
    new StatusEffect("Feeble", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Decrease offensive dice power by [/status/Feeble] Feeble"),
    new StatusEffect("Endurance", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Increase defensive dice power by [/status/Endurance] Endurance"),
    new StatusEffect("Disarm", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Decrease defensive dice power by [/status/Disarm] Disarm"),
    new StatusEffect("Haste", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Gain movement equal to [/status/Haste] Haste"),
    new StatusEffect("Bind", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Lose movement equal to [/status/Bind] Bind"),
    new StatusEffect("Smoke", Triggers.HIT, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Smoke") / 2, "Smoke", "HP", "Took %DMG% extra HP damage from [/status/Smoke] Smoke! (%PHP% -> %HP%)")
    }, (count) => { return count > 10 ? count - 4 : count - 2 }, "Increase incoming damage by half of your [/status/Smoke] Smoke. Max stack of 10"),
    new StatusEffect("Charge", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Resource used by effects"),
    new StatusEffect("Charge_Barrier", Triggers.END, async (actor) => {
        await actor.applyStatus("Charge", actor.getStatusCount("Charge_Barrier"), 0);
        createEffectsMessage(actor.name, `Gains ${actor.getStatusCount("Charge_Barrier")} [/status/Charge] Charge from decaying [/status/Charge_Barrier] Charge Barrier!`);
    }, (count) => { return 0; }, "Provides temporary HP equal to triple your [/status/Charge_Barrier] Charge Barrier. Decays into [/status/Charge] Charge at round end"),
    new StatusEffect("Overcharge", Triggers.NONE, async (actor) => {
        let charge = actor.getStatusCount("Charge");
        if (charge > 15) {
            await actor.reduceStatus("Charge", 3 * (Math.floor(charge / 15)));
            createEffectsMessage(actor.name, `Loses ${3 * (Math.floor(charge / 15))} [/status/Charge] Charge from overload!`);
        }
    }, (count) => { return count; }, "Resource used by effects, gained for every 10 [/status/Charge] Charge spent"),
    new StatusEffect("Hemorrhage", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Consumed when [/status/Bleed] Bleed triggers to prevent decay"),
    new StatusEffect("Renewed_Blaze", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Consumed when [/status/Burn] Burn triggers to prevent decay"),
    new StatusEffect("Deep_Chill", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Consumed when [/status/Frostbite] Frostbite triggers to prevent decay"),
    new StatusEffect("Dark_Flame", Triggers.AFTER_DECAY, async (actor) => {
        let burn = actor.getStatusCount("Burn");
        await actor.takeDamageStatus(burn, "Dark_Flame", "SP", "[/status/Dark_Flame] Burned for %DMG% SP damage! (%PSP% -> %SP%)")
    }, (count) => { return 0; }, "Deals SP damage equal to [/status/Burn] Burn at round end and expires"),
    new StatusEffect("Freezer_Burn", Triggers.AFTER_DECAY, async (actor) => {
        let burn = actor.getStatusCount("Frostbite");
        await actor.applyStatus("Burn", burn, 0);
        createEffectsMessage(actor.name, `[/status/Freezer_Burn] Gains ${burn} [/status/Burn] Burn from decaying [/status/Frostbite] Frostbite!`)
    }, (count) => { return 0; }, "Inflicts [/status/Burn] Burn equal to half of [/status/Frostbite] Frostbite at round end and expires"),
    new StatusEffect("Tendon_Slice", Triggers.MOVE, async (actor) => {
        await actor.fireStatusEffect("Bleed");
    }, (count) => { return 0; }, "Triggers [/status/Bleed] Bleed upon moving and expires"),
    new StatusEffect("Consumed_Bloodfeast", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "A resource used by effects. Gained when spending [/status/Bloodfeast] Bloodfeast"),
    new StatusEffect("Heal_Efficiency", Triggers.END, async (actor) => {}, (count) => { return count; }, "When healing, may be consumed to trigger an Effective Heal, increasing healing by your [/status/Heal_Efficiency] Healing Efficiency"),
    new StatusEffect("Heal_Inefficiency", Triggers.NONE, async (actor) => {}, (count) => { return count; }, "When being healed, reduce the healing by your [/status/Heal_Inefficiency] Healing Inefficiency. Negative healing causes HP damage"),
    new StatusEffect("Aggro", Triggers.END, async (actor) => {}, (count) => { return 0; }, "Allows moving out of turn to intercept attacks."),
    new StatusEffect("Nails", Triggers.BURST, async (actor) => {
        let bleed = actor.getStatusCount("Bleed");
        let nails = actor.getStatusCount("Nails");

        if (nails > 0) {
            await actor.applyStatus("Bleed", nails);
            createEffectsMessage(actor.name, `Gains ${nails} [/status/Bleed] Bleed from [/status/Nails] Nails on self! (${bleed} -> ${bleed + nails})`);
        }
    }, (count) => { return count; }, "Inflicts [/status/Bleed] Bleed equal to [/status/Nails] Nails when hit by [/damageTypes/Blunt] blunt damage"),
    new StatusEffect("Unlock", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, 'Gives 1 [/status/Strength] Strength and [/status/Endurance] Endurance every round'),
    new StatusEffect("UnlockCount", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "", true),
    new StatusEffect("Rhythm", Triggers.END, async (actor) => {}, (count) => {
        let next = count + 1;
        if (next > 5) {
            next = 0;
        }

        return next;
    }, "Triggers resonance when clashing targets with the same [/status/Rhythm] Rhythm. Proceeds to the next movement on round end"),
    new StatusEffect("Delusional_Wonderland", Triggers.NONE, async (actor) => {
        let newCount = actor.getStatusCount("Delusional_Wonderland");
        newCount = Number(newCount - 1);

        if (newCount <= 0) {
            await actor.stagger();
        }

        await actor.setStatus("Delusional_Wonderland", newCount);
    }, (count) => { return count; }, "Become staggered when this effect reaches 0"),

    //
    new StatusEffect("Tremor_Fracture", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "The hit that bursts [/status/Tremor] Tremor is treated as if your ST resistance is one tier higher", true),
    new StatusEffect("Tremor_Distribution", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Gain 1 Dice Power for every 5 [/status/Tremor] Tremor across all allies, up to 3", true),
    new StatusEffect("Tremor_Reverb", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Take HP damage equal to [/status/Tremor] Tremor when burst", true),
    new StatusEffect("Tremor_Decay", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "Every 2 [/status/Tremor] Tremor counts as 1 [/status/Fragile] Fragile", true),
    new StatusEffect("Tremor_Everlasting", Triggers.NONE, async (actor) => {}, (count) => { return 0; }, "When burst, roll a 1d10. If the value is less than (5 + [/status/Tremor] Tremor), deal ST damage again. Reduce the threshold by 5 and repeat until failure.", true),
    //
    new StatusEffect("Strider_[Hare]", Triggers.START, async (actor) => {
        await actor.applyStatus("Haste", 3);
    }, (count) => { return count; }, "Gain 3 [/status/Haste] Haste that does not increase movement"),
    new StatusEffect("Strider_[Mao]", Triggers.START, async (actor) => {
        await actor.applyStatus("Haste", 3);
    }, (count) => { return 0; }, "Gain 3 [/status/Haste] Haste"),
    new StatusEffect("Deathrite_[Haste]", Triggers.NONE, async (actor) => {}, (count) => { return count; }, "Prevents [/status/Rupture] Rupture decay when burst by a target with 3+ [/status/Haste] Haste and gets consumed"),
];

export function findStatusDef(name) {
    return statusList.find(x => x.name == name);
}

export function getMovementName(count) {
    switch (Number(count)) {
        case 1:
            return "first";
        case 2:
            return "second";
        case 3:
            return "third";
        case 4:
            return "fourth";
        case 5:
            return "final";
        default:
            return null;
    }
}