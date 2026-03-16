import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { currentRound } from "../combat/combatState.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";
import { scale } from "../../pmttrpg.mjs";

export const augmentEffects = [
    // augment bonus effects
    augmentBonusEffect("Burn", 2),
    augmentBonusEffect("Frostbite", 2),
    augmentBonusEffect("Bleed", 1),
    augmentBonusEffect("Smoke", 3),
    augmentBonusEffect("Rupture", 1),
    augmentBonusEffect("Tremor", 1),
    augmentBonusEffect("Sinking", 1),
    augmentBonusEffect("Bind", 1),
    augmentBonusEffect("Poise", 4, true),
    augmentBonusEffect("Ruin", 4),
    // augment vigor effects
    augmentVigorEffect("Burn", 3),
    augmentVigorEffect("Frostbite", 2),
    augmentVigorEffect("Bleed", 2),
    augmentVigorEffect("Haste", 2),
    // - smoke overflow
    // - bloodthirst
    // status augment effects
    simpleStatusEffect("Burn", false),
    simpleStatusEffect("Frostbite", false),
    simpleStatusEffect("Smoke", false),
    simpleStatusEffect("Bleed", false),
    simpleStatusEffect("Rupture", true),
    simpleStatusEffect("Tremor", true),
    simpleStatusEffect("Sinking", true),
    simpleStatusEffect("Poise", false, true),
    simpleStatusEffect("Ruin", false),
    // - puffy brume
    // - dizzying smog
    flashEffect("Flash Fire", "Burn", true),
    flashEffect("Flash Freeze", "Frostbite", true),
    flashEffect("Quick Gashes", "Bleed", true),
    flashEffect("Rapid Fumes", "Smoke", false),
    flashEffect("Sudden Downpour", "Sinking", false),
    // - pyromaniac
    // - cryomaniac
    // - hemomaniac
    // - siphon luck
    // - siphon curse
    new Effect(
        "Systems Online",
        (context, count, trigger) => {
            context.events["Combat Start"].push(async (context) => {
                await context.actor.applyStatus("Charge", 3 * count);
                await createEffectsMessage(context.actor.name, `Systems Online: Gain ${count * 3} [/status/Charge] Charge.`);
            });
        },
        (count) => {
            return `Gain ${count * 3} [/status/Charge] Charge.`
        },
        ["Combat Start"],
        false,
        5, false, true
    ),
    // - constant barrier
    markerEffect("Blood Cycler"),
    new Effect(
        "Wasting Curse",
        (context, count, trigger) => {
            context.events["Devastating Hit"].push(async (context) => {
                applyInAoe(context.target, 1, async (actor) => {
                    await actor.applyStatus("Feeble", 0, 1);
                    createEffectsMessage(actor.name, "Gains 1 [/status/Feeble] Feeble next round from Wasting Curse!");
                }, context.actor);
            });
        },
        null, ["Always Active"], false, 1, false, true
    ),
    new Effect(
        "Slowing Curse",
        (context, count, trigger) => {
            context.events["Devastating Hit"].push(async (context) => {
                applyInAoe(context.target, 1, async (actor) => {
                    await actor.applyStatus("Bind", 0, 2);
                    createEffectsMessage(actor.name, "Gains 2 [/status/Bind] Bind next round from Slowing Curse!");
                }, context.actor);
            });
        },
        null, ["Always Active"], false, 1, false, true
    ),
    new Effect(
        "Exposing Curse",
        (context, count, trigger) => {
            context.events["Devastating Hit"].push(async (context) => {
                applyInAoe(context.target, 1, async (actor) => {
                    await actor.applyStatus("Fragile", 0, 1);
                    await actor.applyStatus("Stagger_Fragile", 0, 1);
                    createEffectsMessage(actor.name, "Gains 1 [/status/Fragile] Fragile and [/status/Stagger_Fragile] Stagger Fragile next round from Exposing Curse!");
                }, context.actor);
            });
        },
        null, ["Always Active"], false, 1, false, true
    ),
    new Effect(
        "Spreading Curse",
        (context, count, trigger) => {
            context.events["Devastating Hit"].push(async (context) => {
                applyInAoe(context.target, 1, async (actor) => {
                    await actor.applyStatus("Ruin", 0, 3);
                    createEffectsMessage(actor.name, "Gains 3 [/status/Ruin] Ruin next round from Spreading Curse!");
                }, context.actor);
            });
        },
        null, ["Always Active"], false, 1, false, true
    ),
    //
    augmentThresholdEffect("Activate Strength", "HP", 1, ["Strength"], ["Feeble"]),
    augmentThresholdEffect("Activate Endurance", "HP", 1, ["Endurance"]),
    augmentThresholdEffect("Activate Haste", "HP", 1, ["Haste"], ["Feeble"]),
    augmentThresholdEffect("Activate Protection", "HP", 1, ["Protection", "Stagger_Protection"], ["Fragile", "Stagger_Fragile"]),
    augmentThresholdEffect("Activate Charge", "HP", 2, ["Charge"]),
    augmentThresholdEffect("Caged Strength", "SP", 1, ["Strength"], ["Feeble"]),
    augmentThresholdEffect("Caged Endurance", "SP", 1, ["Endurance"]),
    augmentThresholdEffect("Caged Haste", "SP", 1, ["Haste"], ["Feeble"]),
    augmentThresholdEffect("Caged Protection", "SP", 1, ["Protection", "Stagger_Protection"], ["Fragile", "Stagger_Fragile"]),
    //
]

function augmentThresholdEffect(name, bar, mult, status, negativeStatus = []) {
    return new Effect(
        name,
        (context, count, trigger) => {
            context.events["Round Start"].push(async (context) => {
                let stat = 0;
                let max = 0;
                switch (bar) {
                    case "HP":
                        stat = context.actor.system.attributes.health.value;
                        max = context.actor.system.attributes.health.max;
                        break;
                    case "SP":
                        stat = context.actor.system.attributes.sanity.value;
                        max = context.actor.system.attributes.sanity.max;
                        break;
                }

                let thresholds = Math.floor((max - stat) / (max * 0.25));
                if (thresholds > 3) { 
                    thresholds = 3 
                }

                if (count >= 0) {
                    for (let effect in status) {
                        await context.actor.applyStatus(effect, thresholds * mult, 0);
                    }

                    createEffectsMessage(context.actor.name, `Gained ${thresholds * mult} [/status/${status[0]}] ${status[0].replace("_", " ")}${status.length > 1 ? ` and [/status/${status[1]}] ${status[1].replace("_", " ")}` : ""} from ${name}!`);
                }
                else {
                    for (let effect in negativeStatus) {
                        await context.actor.applyStatus(effect, thresholds * mult, 0);
                    }

                    createEffectsMessage(context.actor.name, `Gained ${thresholds * mult} [/status/${negativeStatus[0]}] ${negativeStatus[0].replace("_", " ")}${negativeStatus.length > 1 ? ` and [/status/${negativeStatus[1]}] ${negativeStatus[1].replace("_", " ")}` : ""} from ${name}!`);
                }
            });
        },
        (count) => {
            if (count >= 0) {
                return `Gain ${mult} [/status/${status[0]}] ${status[0].replace("_", " ")}${status.length > 1 ? ` and [/status/${status[1]}] ${status[1].replace("_", " ")}` : ""} for every 25% max ${bar} lost.`
            }
            else {
                return `Gain ${mult} [/status/${negativeStatus[0]}] ${negativeStatus[0].replace("_", " ")}${negativeStatus.length > 1 ? ` and [/status/${negativeStatus[1]}] ${negativeStatus[1].replace("_", " ")}` : ""} for every 25% max ${bar} lost.`
            }
        },
        ["Round Start"],
        negativeStatus.length != 0, 5, false, true
    );
}

async function applyInAoe(origin, distance, callback, user) {
    let source = canvas.tokens.placeables.find(x => x.actor == origin);
    let dispo = 0;
    if (user != null) {
        dispo = canvas.tokens.placeables.find(x => x.actor == user).document.disposition;
    }

    for (let token of canvas.tokens.placeables.filter(x => user == null ? true : x.document.disposition != dispo)) {
        if (scale(canvas.grid.measureDistance(source, token)) <= distance) {
            await callback(token.actor);
        }
    }
}

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

function augmentVigorEffect(status, req) {
    return new Effect(
        `${status} Vigor`,
        (context, count, trigger) => {
            if (context.actor != null) {
                context.dicePower = Number(context.dicePower) + (Math.clamp(context.actor.getStatusCount(status) / req, 0, 3));
            }
        },
        (count) => {
            return `Gain 1 Dice Power for every ${req} [/status/${status}] ${status} on self, max 3.`
        },
        ["On Use"],
        false,
        1
    );
}

function augmentBonusEffect(status, req, invert = false) {
    return new Effect(
        `${status} Bonus`,
        (context, count, trigger) => {
            if (invert) {
                if (context.actor != null && context.actor.getStatusCount(status) >= req) {
                    context.dicePower = Number(context.dicePower) + 1;
                }
            }
            else {
                if (context.target != null && context.target.getStatusCount(status) >= req) {
                    context.dicePower = Number(context.dicePower) + 1;
                }
            }
        },
        (count) => {
            return `If the ${invert ? "user" : "target"} has ${req > 1 ? req + " " : ""}[/status/${status}] ${status}, gain 1 Dice Power`
        },
        ["On Use"],
        false,
        1
    );
}

function simpleStatusEffect(status, nextRound, invert = false) {
    let str = nextRound ? " next round" : "";
    return new Effect(
        `${invert ? "Gain" : "Inflict"} ${status}`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction(status, invert ? -count : count, nextRound);
        },
        (count) => {
            return `${invert ? "Gain" : "Inflict"} ${count} [/status/${status}] ${status}` + str;
        },
        ["Clash Win", "Clash Lose"],
        false
    );
}

function flashEffect(name, status, allowNegative) {
    return new Effect(
        name,
        (context, count, trigger) => {
            if (currentRound <= 1) {
                context.triggers["Clash Win"].applyInfliction(status, count, false);
            }
        },
        (count) => {
            return `${count < 0 ? "Gain" : "Inflict"} ${Math.abs(count)} [/status/${status}] ${status} during the first round of combat.`;
        },
        ["Clash Win"],
        allowNegative
    );
}