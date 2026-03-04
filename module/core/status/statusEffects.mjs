import { StatusEffect, Triggers } from "./statusEffect.mjs";

export const statusList = [
    new StatusEffect("Burn", Triggers.END, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Burn"), "Burn", "HP", "[/status/Burn] Burned for %DMG% HP damage! (%PHP% -> %HP%)")
    }, (count) => { return count / 2 }),
    new StatusEffect("Frostbite", Triggers.END, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Frostbite"), "Frostbite", "ST", "[/status/Frostbite] Froze for %DMG% ST damage! (%PST% -> %SP%)")
    }, (count) => { return count / 2 }),
    new StatusEffect("Bleed", Triggers.ACTION, async (actor) => {
        await actor.takeDamageStatus(actor.getStatusCount("Bleed"), "Bleed", "HP", "[/status/Bleed] Bled for %DMG% HP damage! (%PHP% -> %HP%)")
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
        await actor.takeDamageStatus(actor.getStatusCount("Smoke"), "Smoke", "HP", "Took %DMG% extra HP damage from [/status/Smoke] Smoke! (%PSP% -> %SP%)")
    }, (count) => { return count > 10 ? count - 4 : count - 2 }),
    new StatusEffect("Charge", Triggers.NONE, async (actor) => {}, (count) => { return 0; }),
    new StatusEffect("Charge_Barrier", Triggers.END, async (actor) => {
        await actor.applyStatus("Charge", actor.getStatusCount("Charge_Barrier"), 0);
    }, (count) => { return 0; }),
    new StatusEffect("Overcharge", Triggers.END, async (actor) => {
        let charge = actor.getStatusCount("Charge");
        if (charge > 15) {
            await actor.reduceStatus(3 * (Math.floor(charge / 15)));
        }
    }, (count) => { return count; }),
    new StatusEffect("Nails", Triggers.NONE, async (actor) => {

    }, (count) => { return count; })
];

export function findStatusDef(name) {
    return statusList.find(x => x.name == name);
}