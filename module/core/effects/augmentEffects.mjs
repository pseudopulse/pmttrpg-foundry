import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { currentRound } from "../combat/combatState.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";
import { scale } from "../../pmttrpg.mjs";
import { Conditional } from "../combat/rollContext.mjs";
import { pollReduceStatus, pollUserInputText } from "../helpers/dialog.mjs";

export const augmentEffects = [
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
    augmentVigorEffect("Burn", 3),
    augmentVigorEffect("Frostbite", 2),
    augmentVigorEffect("Bleed", 2),
    augmentVigorEffect("Haste", 2),
    // - smoke overflow
    new Effect(
        "Bloodthirst",
        (context, count, trigger) => {
            if (currentRound <= 1 && !context.flags.includes("Bloodthirst")) {
                context.flags.push("Bloodthirst");
                context.dicePower = Number(context.dicePower) + 3;
            }

            context.events["Kill"].push(async (context) => {
                await context.actor.applyStatus("Strength", 0, count);
                createEffectsMessage(context.actor.name, `Gains ${count} Strength next round from Bloodthirst!`);
            });
        },
        (count) => {
            return `Gain ${count} Dice Power during the first round of combat.`;
        },
        ["On Use"],
        false, 3, false, true
    ),
    simpleStatusEffect("Burn", false),
    simpleStatusEffect("Frostbite", false),
    simpleStatusEffect("Smoke", false),
    simpleStatusEffect("Bleed", false),
    simpleStatusEffect("Rupture", true),
    simpleStatusEffect("Tremor", true),
    simpleStatusEffect("Sinking", true),
    simpleStatusEffect("Poise", false, true),
    simpleStatusEffect("Ruin", false),
    markerEffect("Puffy Brume", false, 1),
    markerEffect("Dizzying Smog", false, 1),
    flashEffect("Flash Fire", "Burn", true),
    flashEffect("Flash Freeze", "Frostbite", true),
    flashEffect("Quick Gashes", "Bleed", true),
    flashEffect("Rapid Fumes", "Smoke", false),
    flashEffect("Sudden Downpour", "Sinking", false),
    transferEffect("Pyromaniac", "Burn"),
    transferEffect("Cyromaniac", "Frostbite"),
    transferEffect("Hemomaniac", "Bleed"),
    transferEffect("Siphon Luck", "Poise"),
    transferEffect("Siphon Curse", "Ruin"),
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
    new Effect(
        "Constant Barrier",
        (context, count, trigger) => {
            context.events["Round Start"].push(async (context) => {
                let max = Math.min(count * 3, Number(context.actor.getStatusCount("Charge")));
                let amount = await pollUserInputText(context.actor, "Constant Barrier: Spend intervals of 3 [/status/Charge] Charge to gain [/status/Charge_Barrier] Charge Barrier", "Charge Amount", "number", max);
                amount = Number(amount);
                amount = Math.clamp(amount, 0, max);

                if (amount > 0) {
                    await context.actor.reduceStatus("Charge", Number(amount));
                    let gain = Math.floor(Number(amount) / 3);

                    if (gain > 0) {
                        await context.actor.applyStatus("Charge_Barrier", gain, 0);
                        createEffectsMessage(context.actor.name, `Spent ${amount} [/status/Charge] Charge to gain ${gain} [/status/Charge_Barrier] Charge Barrier`);
                    }
                }
            });
        },
        (count) => {
            return `Spend up to ${Number(count) * 3} [/status/Charge] Charge; Gain 1 [/status/Charge_Barrier] Charge Barrier for every 3 spent`
        },
        ["Round Start"], false, 5, false, true
    ),
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
    new Effect(
        "Lone Fighter",
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Lone Fighter", `Increase Dice Power by ${count} if the target has not had action taken against them by an ally in 2 rounds.`, (context) => {
                context.dicePower = Number(context.dicePower) + count;
            }, [], null));
        },
        null,
        ["Always Active"],
        false,
        3
    ),
    markerEffect("Overcharged Drive [S]"),
    markerEffect("Overcharged Drive [E]"),
    new Effect(
        "Remembrance [S]",
        (context, count, trigger) => {
            context.events["Round Start"].push(async (context) => {
                let dispo = canvas.tokens.placeables.find(x => x.actor == context.actor).document.disposition;
                let anyDead = false;
                for (const token of canvas.tokens.placeables.filter(x => (x.actor != context.actor) && x.document.disposition == dispo)) {
                    if (token.actor.system.attributes.health.value <= 0) {
                        anyDead = true;
                    }
                }

                if (anyDead) {
                    if (count < 0) {
                        await context.actor.applyStatus("Feeble", 2, 0);
                        createEffectsMessage(context.actor.name, "Gains 2 [/status/Feeble] Feeble from Remembrance!");
                    }
                    else {
                        await context.actor.applyStatus("Strength", 2, 0);
                        createEffectsMessage(context.actor.name, "Gains 2 [/status/Strength] Strength from Remembrance!");
                    }
                }
            });
        },
        (count) => {
            if (count < 0) {
                return "Gain 2 [/status/Feeble] if any allies are defeated."
            }

            return "Gain 2 [/status/Strength] if any allies are defeated."
        }, ["Round Start"], true, 1, false, true
    ),
    new Effect(
        "Remembrance [E]",
        (context, count, trigger) => {
            context.events["Round Start"].push(async (context) => {
                let dispo = canvas.tokens.placeables.find(x => x.actor == context.actor).document.disposition;
                let anyDead = false;
                for (const token of canvas.tokens.placeables.filter(x => (x.actor != context.actor) && x.document.disposition == dispo)) {
                    if (token.actor.system.attributes.health.value <= 0) {
                        anyDead = true;
                    }
                }

                if (anyDead) {
                    if (count < 0) {
                        await context.actor.applyStatus("Feeble", 2, 0);
                        createEffectsMessage(context.actor.name, "Gains 2 [/status/Feeble] Feeble from Remembrance!");
                    }
                    else {
                        await context.actor.applyStatus("Endurance", 2, 0);
                        createEffectsMessage(context.actor.name, "Gains 2 [/status/Endurance] Endurance from Remembrance!");
                    }
                }
            });
        },
        (count) => {
            if (count < 0) {
                return "Gain 2 [/status/Feeble] if any allies are defeated."
            }

            return "Gain 2 [/status/Endurance] if any allies are defeated."
        }, ["Round Start"], true, 1, false, true
    ),
    new Effect(
        "Momentum",
        (context, count, trigger) => {
            if (context.attackType == "Melee") {
                context.conditionals.push(new Conditional("Momentum", "Deal HP damage equal to SQRs moved before melee attack.", async (context) => { }, [], null));

                context.events["Clash Win"].push(async (context) => {
                    if (!context.activeConditionals.includes("Momentum")) return;

                    let sqr = await pollUserInputText(context.actor, "Momentum: Deal HP damage based on SQRs moved in a straight line.", "SQRs moved", "number");
                    sqr = Number(sqr);

                    if (sqr > 3) {
                        sqr = sqr - 3;
                        let prev = context.target.system.attributes.health.value;
                        await context.target.takeDamage(0, context, Math.min(sqr, 20), 0, 0, true);
                        let hp = context.target.system.attributes.health.value;
                        createEffectsMessage(context.target.name, `Received ${Math.min(sqr, 20)} HP damage from Momentum! (${prev} -> ${hp})`);
                    }
                });
            }
        },
        null,
        ["Always Active"],
        false,
        1, false, true
    ),
    new Effect(
        "Cavalry Charge",
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Cavalry Charge", "When moving 3+ SQR before attack, enemy clash has disadvantage.", (context) => {
                context.enemyAdvState = -1;
                context.enemyModifierText.push("Rolled with [/status/Paralysis] Disadvantage from Cavalry Charge!");
            }, [], null));
        },
        null,
        ["Always Active"],
        false,
        1
    ),
    markerEffect("Kinetic Storage", false, 1),
    new Effect(
        "Status Barrier",
        (context, trigger, count) => {
            context.events["Round Start"].push(async (context) => {
                let barrier = context.actor.getStatusCount("Charge_Barrier");

                if (barrier > 0) {
                    await context.actor.performReduceStatus("Status Barrier", barrier * 2);
                }
            });
        },
        (count) => {
            return "If you have [/status/Charge_Barrier] Charge Barrier, perform Reduce Status up to [/status/Charge_Barrier] Charge Barrier * 2 stacks."
        },
        ["Round Start"], false, 1, false, true
    ),
    markerEffect("Split Second", false, 1),
    markerEffect("Burn Resistance", true, 5),
    markerEffect("Frostbite Resistance", true, 5),
    markerEffect("Bleed Resistance", true, 5),
    markerEffect("Rupture Resistance", true, 5),
    markerEffect("Tremor Resistance", true, 5),
    markerEffect("Sinking Resistance", true, 5),
    markerEffect("Damage Resistance", true, 3),
    markerEffect("Additional Reaction", true, 1),
    markerEffect("Throwing Master", false, 1),
    markerEffect("Concentrated Overcharge", false, 1),
    // - desperate struggle
    new Effect(
        "Terrorize",
        (context, count, trigger) => {
            context.events["Kill"].push(async (context) => {
                applyInAoe(context.target, 1, async (actor) => {
                    if (actor != context.target) {
                        await actor.takeDamage(0, context, 0, 0, 5, true);
                        createEffectsMessage(actor.name, "[/status/Panic] Took 5 SP damage from Terrorize!");
                    }
                }, context.actor);
            });
        },
        null,
        ["Always Active"],
        false, 1, false, true
    ),
    new Effect(
        "Regen HP",
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                let hp = context.actor.system.attributes.health.value;
                if (hp <= 0) return;

                if (count >= 0) {
                    await context.actor.heal(count, 0, 0);
                    createEffectsMessage(context.actor.name, `Recovered ${Math.abs(count)} HP! (${hp} -> ${context.actor.system.attributes.health.value})`);
                }
                else {
                    await context.actor.takeDamage(0, context, Math.abs(count), 0, 0, true);
                    createEffectsMessage(context.actor.name, `Took ${Math.abs(count)} HP damage! (${hp} -> ${context.actor.system.attributes.health.value})`);
                }
            });
        },
        (count) => {
            if (count >= 0) {
                return `Recover ${count} HP`;
            }
            else {
                return `Lose ${count} HP`
            }
        },
        ["Clash Win", "Clash Lose"],
        true, 5, false, true
    ),
    new Effect(
        "Regen ST",
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                let hp = context.actor.system.attributes.stagger.value;
                if (hp <= 0) return;

                if (count >= 0) {
                    await context.actor.heal(0, count, 0);
                    createEffectsMessage(context.actor.name, `Recovered ${Math.abs(count)} ST! (${hp} -> ${context.actor.system.attributes.stagger.value})`);
                }
                else {
                    await context.actor.takeDamage(0, context, 0, Math.abs(count), 0, true);
                    createEffectsMessage(context.actor.name, `Took ${Math.abs(count)} ST damage! (${hp} -> ${context.actor.system.attributes.stagger.value})`);
                }
            });
        },
        (count) => {
            if (count >= 0) {
                return `Recover ${count} ST`;
            }
            else {
                return `Lose ${count} ST`
            }
        },
        ["Clash Win", "Clash Lose"],
        true, 5, false, true
    ),
    markerEffect("Regeneration Versatility", false, 1),
    markerEffect("Regeneration Storage", false, 1),
    new Effect(
        "Passive Lucidity",
        (context, trigger, count) => {
            context.events["Round Start"].push(async (context) => {
                let sp = context.actor.system.attributes.sanity.value;

                if (sp > 0) {
                    await context.actor.heal(0, 0, 2);
                    createEffectsMessage(context.actor.name, `Recovered 2 SP from Passive Lucidity! (${sp} -> ${context.actor.system.attributes.sanity.value})`);
                }
            });
        },
        (count) => {
            return "Recover 2 SP"
        },
        ["Round Start"], false, 1, false, true
    ),
    // absorb
    markerEffect("Indomitable", false, 1),
    // unstoppable
    markerEffect("Redundant Systems", false, 1),
    markerEffect("Turbulence", false, 1),
    // - mark shit
    markerEffect("Striker Stance", false, 1),
    markerEffect("Slayer Stance", false, 1),
    markerEffect("Slasher Stance", false, 1),
    markerEffect("Impassioned", true, 1),
    markerEffect("Multifaceted", false, 1),
    new Effect(
        `Fervor`,
        (context, count, trigger) => {
            if (context.actor != null) {
                context.dicePower = Number(context.dicePower) + Math.min(Number(context.actor.system.emotionLevelUsed), 3);
            }
        },
        (count) => {
            return `Gain 1 Dice Power for every time Emotion Level has been used this combat (max 3)`
        },
        ["On Use"],
        false,
        1
    ),
    markerEffect("Meditation", false, 1),
    //
    markerEffect("Cursed", false, 5),
    markerEffect("Paranoid", false, 1),
    new Effect(
        "Squeamish",
        (context, trigger, count) => {
            context.events["Kill"].push(async (context) => {
                await context.actor.applyStatus("Feeble", 0, count);
                createEffectsMessage(context.actor.name, `Gains ${count} Feeble next round from Squeamish!`);
            });
        },
        null,
        ["Always Active"],
        false, 3, false, true
    ),
    new Effect(
        "Slow Start",
        (context, trigger, count) => {
            if (currentRound <= 1) {
                context.dicePower = Number(context.dicePower) - count;
            }
        },
        (count) => {
            return `Lose ${count} Dice Power during the first round of combat.`
        },
        ["On Use"],
        false, 5, false, false
    ),
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

function transferEffect(name, status) {
    return new Effect(
        name,
        (context, count, trigger) => {
            if (context.attackType == "Melee" || context.attackType == "Ranged") {
                context.events["Clash Win"].push(async (context) => {
                    let stacks = await pollUserInputText(context.actor, `${name}: Transfer up to ${count} [/status/${status}] ${status} from self to target or target to self (negative to transfer to self, positive to target)`, "Stacks Transfered", "number", count, count * -1);
                    stacks = Number(stacks);

                    if (stacks < 0) {
                        stacks = Math.min(context.target.getStatusCount(status), Math.abs(stacks));
                        await context.target.reduceStatus(status, stacks);
                        await context.actor.applyStatus(status, stacks);
                        createEffectsMessage(context.actor.name, `Transfers ${stacks} [/status/${status}] ${status} from target to self!`);
                    }
                    else if (stacks > 0) {
                        stacks = Math.min(context.actor.getStatusCount(status), Math.abs(stacks));
                        await context.actor.reduceStatus(status, stacks);
                        await context.target.applyStatus(status, stacks);
                        createEffectsMessage(context.actor.name, `Transfers ${stacks} [/status/${status}] ${status} from self to target!`);
                    }
                });
            }
        },
        (count) => {
            return `Transfer up to ${count} [/status/${status}] ${status} from self to target or target to self.`;
        },
        ["Clash Win"],
        false,
        5, false, true
    );
}