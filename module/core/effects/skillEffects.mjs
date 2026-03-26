import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";
import { pollUserInputConfirm, pollUserInputOptions } from "../helpers/dialog.mjs";
import { scale } from "../../pmttrpg.mjs";

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
        "Dice Max Up",
        (context, count, trigger) => { 
            let negative = count < 0;
            count = Math.abs(count);

            if (negative) {
                for (let i = 0; i < count; i++) {
                    if (Number(context.diceMax) <= 1) {
                        context.dicePower = Number(context.dicePower) - 1;
                    }
                    else {
                        context.diceMax = Number(context.diceMax) - 1;
                    }
                }
            }
            else {
                context.diceMax = Number(context.diceMax) + Number(count);
            }
        },
        null,
        ["Always Active"]
    ),
    new Effect(
        "Enemy Power Down",
        (context, count, trigger) => {
            context.enemyPowerMod += count;
        },
        (count) => {
            return handleNegativeText(
                "Decrease target's Dice Power by %", 
                "Increase target's Dice Power by %", 
            count);
        },
        ["On Use"],
    ),
    skillVigorEffect("Bind", 1, 0),
    skillBonusEffect("Bind", 0),
    new Effect(
        "Single Strike",
        (context, count, trigger) => {
            if (context.actor && !context.flags.includes("Single Strike")) {
                let reactions = context.actor.system.reactions;
                context.dicePower = Number(context.dicePower) + Math.clamp(reactions, 2, 6);
            }

            context.events.push("On Use", async (context) => {
                await context.actor.update({ "system.reactions": 0 }, { diff: false });
                createEffectsMessage(context.actor.name, `${context.actor.name} burns all of their reactions to empower the attack!`);
            });
        },
        (count) => {
            return `Forfeit all reactions and gain Dice Power equal to spent reactions (min 2, max 6)`;
        },
        ["On Use"],
        false,
        1, false, true
    ),
    new Effect(
        "Overcoming Crisis",
        (context, count, trigger) => { 
            if (context.actor != null && context.actor.system.attributes.health.value < context.actor.system.attributes.health.max * (1 - (0.2 * count))) {
                context.dicePower = Number(context.dicePower) + Number(count);
            }
        },
        (count) => {
            return `Gain ${count} Dice Power if HP is less than ${(1 - (0.2 * count)) * 100}%`;
        },
        ["On Use"],
        false,
        4
    ),
    new Effect(
        "Overcoming Madness",
        (context, count, trigger) => { 
            if (context.actor != null && context.actor.system.attributes.sanity.value < context.actor.system.attributes.sanity.max * (1 - (0.2 * count))) {
                context.dicePower = Number(context.dicePower) + Number(count);
            }
        },
        (count) => {
            return `Gain ${count} Dice Power if SP is less than ${(1 - (0.2 * count)) * 100}%`;
        },
        ["On Use"],
        false,
        4
    ),
    // - overheat
    // - ignore power
    //
    simpleStatusEffect("Fragile", true, true),
    simpleStatusEffect("Stagger Fragile", true, true),
    new Effect(
        "Inflict [Type] Fragile",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let type = await pollUserInputOptions(ctx.actor, "Choose [Type] Fragility to inflict.", [
                    {
                        name: "Slash Fragility",
                        icon: "/status/Slash_Fragility.png"
                    },
                    {
                        name: "Pierce Fragility",
                        icon: "/status/Pierce_Fragility.png"
                    },
                    {
                        name: "Blunt Fragility",
                        icon: "/status/Blunt_Fragility.png"
                    },
                ]);
                data.applyInfliction(type.replace(" ", "_"), 2, true);
            });
        },
        (count) => {
            return `Apply ${count} [Type] Fragility next round, chosen on application.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
    ),
    simpleStatusEffect("Paralysis", true, true),
    simpleStatusEffect("Feeble", true, false),
    simpleStatusEffect("Disarm", true, false),
    markerEffect("Instant Bind", false, 1),
    simpleStatusEffect("Bind", true, false),
    new Effect(
        "Press Advantage",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let bind = ctx.target.getStatusCount("Bind");
                if (bind <= 0) {
                    return;
                }

                let type = await pollUserInputOptions(ctx.actor, "Choose [Type] Fragility to inflict.", [
                    {
                        name: "Slash Fragility",
                        icon: "/status/Slash_Fragility.png"
                    },
                    {
                        name: "Pierce Fragility",
                        icon: "/status/Pierce_Fragility.png"
                    },
                    {
                        name: "Blunt Fragility",
                        icon: "/status/Blunt_Fragility.png"
                    },
                ]);

                data.applyInfliction(type.replace(" ", "_"), Math.max(bind / 2, 1), true);
            });
        },
        (count) => {
            return `Apply [Type] Fragility next round, chosen on application, equal to half the target's [/status/Bind] Bind.`
        },
        ["Clash Win", "Clash Lose"],
        false, 1, false, true
    ),
    new Effect(
        "Suppress",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let bind = ctx.target.system.reactions;
                if (bind > 0) {
                    data.applyInfliction("Bind", bind, true);
                }
            });
        },
        (count) => {
            return `Apply [/status/Bind] Bind next round equal to the target's remaining reactions.`
        },
        ["Clash Win", "Clash Lose"],
        false, 1, false, true
    ),
    simpleStatusEffect("Burn", false, true),
    markerEffect("Burn+", false, 3),
    skillVigorEffect("Burn", 2, 3),
    skillBonusEffect("Burn", 3),
    new Effect(
        "Detonate",
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                await context.target.fireStatusEffect("Burn");
            });
        },
        (count) => {
            return `Trigger [/status/Burn] Burn on target.`;
        },
        ["Clash Win"],
        false,
        1, false, true
    ),
    new Effect(
        "Smokey Detonate",
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                await context.target.fireStatusEffect("Burn");
                let burn = context.target.getStatusCount("Burn");

                if (burn > 0) {
                    let smoke = context.target.getStatusCount("Smoke");
                    await context.target.applyStatus("Smoke", burn);
                    createEffectsMessage(context.target.name, `Gains ${burn} [/status/Smoke] Smoke from Smokey Detonate! (${smoke} -> ${smoke + burn})`);
                }
            });
        },
        (count) => {
            return `Trigger [/status/Burn] Burn on target, then inflict [/status/Smoke] Smoke equal to remaining [/status/Burn] Burn.`;
        },
        ["Clash Win"],
        false,
        1, false, true
    ),
    statusPauseEffect("Renewed Blaze", 1),
    new Effect(
        "Fireball",
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                let burn = context.target.getStatusCount("Burn");

                if (burn > 0) {
                    applyInAoe(context.target, count, async (actor) => {
                        if (actor == context.target) {
                            return;
                        }
                        
                        await actor.takeDamageStatus(burn, "Burn", "HP", `[/status/Burn] Burns for %DMG% HP damage from Fireball! (%PHP% -> %HP%)`);
                    }, null);
                    
                    await context.target.fireStatusEffect("Burn");
                }
            });
        },
        (count) => {
            return `Trigger [/status/Burn] Burn on target and deal damage equal to [/status/Burn] Burn to all characters within ${count} SQR of the target.`;
        },
        ["Clash Win"],
        false,
        5, false, true
    ),
    statusPauseEffect("Dark Flame", 1),
    //
    simpleStatusEffect("Frostbite", false, true),
    markerEffect("Frostbite+", false, 3),
    skillVigorEffect("Frostbite", 2, 1),
    skillBonusEffect("Frostbite", 3),
    statusPauseEffect("Freezer Burn", 1),
    new Effect(
        "Cold Snap",
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                let paused = context.target.getStatusCount("Deep_Chill") > 0;
                await context.target.fireStatusEffect("Frostbite");

                if (!paused) {
                    await context.target.setStatus("Frostbite", 0);
                }
            });
        },
        (count) => {
            return `Trigger [/status/Frostbite] Frostbite on target, then clear all [/status/Frostbite] Frostbite.`;
        },
        ["Clash Win"],
        false,
        1, false, true
    ),
    statusPauseEffect("Deep Chill", 1),
    new Effect(
        "Shatter",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let frostbite = Math.min(ctx.target.getStatusCount("Frostbite"), count * 2);
                
                if (frostbite > 2) {
                    await ctx.target.takeForceDamage(Math.floor(frostbite / 2));
                    await ctx.target.reduceStatus("Frostbite", frostbite);
                }
            });
        },
        (count) => {
            return `Clear up to ${count * 2} [/status/Frostbite] Frostbite from the target, and deal 1d8 Force Damage for every 2 cleared.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        "Chill Out",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let bind = Math.max(Math.floor(ctx.target.getStatusCount("Frostbite") / 2), 1);
                if (ctx.target.getStatusCount("Frostbite") > 3 + count) {
                    data.applyInfliction("Bind", Math.min(bind, count * 3), true);
                }
            });
        },
        (count) => {
            return `If the target has ${3 + count}+ [/status/Frostbite] Frostbite, apply [/status/Bind] Bind next round equal half of the target's [/status/Frostbite] Frostbite, up to ${count * 3}.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    //
    simpleStatusEffect("Bleed", false, true),
    simpleStatusEffect("Bleed", true, true, "Inflict Delayed Bleed"),
    markerEffect("Bleed+", false, 3),
    skillVigorEffect("Bleed", 2, 1),
    skillBonusEffect("Bleed", 2),
    statusPauseEffect("Hemorrhage", 5),
    new Effect(
        "Vampiric Gash",
        (context, count, trigger) => {
            context.flags.push("Vampiric Gash");
            context.events[trigger].push(async (ctx) => {
                let bleed = ctx.target.getStatusCount("Bleed");
                if (bleed > 0) {
                    let php = Number(ctx.actor.system.attributes.health.value);
                    await ctx.actor.heal(bleed, 0, 0);
                    let hp = Number(ctx.actor.system.attributes.health.value);
                    createEffectsMessage(ctx.actor.name, `Heals ${bleed} HP from Vampiric Gash! (${php} -> ${hp})`);
                }
            });
        },
        (count) => {
            return `Heal HP equal to [/status/Bleed] Bleed on target. If the target did not clash, trigger their [/status/Bleed] Bleed.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        "Cauterize",
        (context, count, trigger) => {
            context.events[trigger].push(async (ctx) => {
                let bleed = Math.floor(ctx.target.getStatusCount("Bleed") / 2);
                if (bleed > 0) {
                    await ctx.target.applyStatus("Burn", bleed);
                    createEffectsMessage(ctx.actor.name, `Gains ${bleed} [/status/Burn] Burn from Cauterize!`);
                }
            });
        },
        (count) => {
            return `Inflict [/status/Burn] Burn equal to half of target's [/status/Bleed] Bleed.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    statusPauseEffect("Tendon Slice", 1),
    new Effect(
        "Trading Wounds",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let confirm = await pollUserInputConfirm(ctx.actor, `Apply Trading Wounds? (did you heal ${2 * count} HP?)`);

                if (confirm) {
                    data.applyInfliction("Bleed", count, false);
                }
            });
        },
        (count) => {
            return `If the user healed ${2 * count}+ HP during this action, inflict ${count} [/status/Bleed] Bleed.`
        },
        ["Clash Win"],
        false, 5, false, true
    ),
    //
    new Effect(
        `Gain Poise`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Poise", count, false);
        },
        (count) => {
            return handleNegativeText(
                `Gain % [/status/Poise] Poise`,
                `Inflict % [/status/Poise] Poise`, 
            count);
        },
        ["Clash Win", "Clash Lose"],
    ),
    new Effect(
        `Increase Critical`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Poise", -count, false);
        },
        (count) => {
            return `Gain ${count} [/status/Critical] Critical`;
        },
        ["Clash Win", "Clash Lose"], false
    ),
    markerEffect("Instant Crit", false, 1),
    markerEffect("Precision", 0, 1),
    // -- critical conversion
    new Effect(
        `Poise Pause`,
        (context, count, trigger) => {
            context.events["On Use"].push(async (context) => {
                await context.actor.update({ "system.poisePaused": true }, { diff: false });
            })
        },
        (count) => {
            return "You do not roll for [/status/Critical] Critical Hits until the next round."
        },
        ["On Use"], false, 1, false, true
    ),
    markerEffect("Critical DMG+", false, 5, "On Crit", (count) => {
        return `Deal ${count*3} HP damage.`;
    }),
    new Effect(
        "Haste Crit",
        (context, count, trigger) => {
            context.events["Critical Hit"].push(async (ctx) => {
                await ctx.actor.applyStatus("Haste", count * 2);
                createEffectsMessage(ctx.actor.name, `Gains ${count * 2} [/status/Haste] Haste next round!`);
            });
        },
        (count) => {
            return `Gain ${count * 2} [/status/Haste] Haste next round.`
        },
        ["On Crit"],
        false, 5, false, true
    ),
    // - stance swap
    new Effect(
        "Scattering Dance",
        (context, count, trigger) => {
            context.flags.push("Scattering Dance");
            context.triggers["On Crit"].modify.push(async (ctx, data) => {
                data.applyInfliction("Hemorrhage", Math.min(ctx.critical, 3), false);
            });
        },
        (count) => {
            return `Inflict [/status/Hemorrhage] Hemorrhage equal to [/status/Critical] Critical spent, max 3.`
        },
        ["On Crit"],
        false, 5, false
    ),
    new Effect(
        `Elusive`,
        (context, count, trigger) => {
            context.flags.push("Elusive");
        },
        (count) => {
            return "Do not deal critical damage. Gain extra movement equal to half of the critical roll."
        },
        ["On Crit"], false, 5, false, true
    ),
    new Effect(
        `Bulwark Defense`,
        (context, count, trigger) => {
            context.flags.push("Bulwark Defense");
        },
        (count) => {
            return "Do not deal critical damage. Reduce damage taken by the critical roll."
        },
        ["On Crit"], false, 1, false, true
    ),
    new Effect(
        "Showdown",
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (ctx) => {
                let poise = ctx.target.getStatusCount("Poise");
                if (poise > 0) {
                    await ctx.target.setStatus("Poise", 0);
                    await ctx.actor.applyStatus("Poise", poise);
                    createEffectsMessage(ctx.actor.name, `Steals ${poise} [/status/Poise] Poise from the target!`);
                }
            });
        },
        (count) => {
            return `Steal the target's [/status/Poise] Poise.`
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    //
    simpleStatusEffect("Ruin", false, true),
    simpleStatusEffect("Devastation", false, true, "Increase Devastation"),
    markerEffect("Instant Devastation"),
    markerEffect("Ruination"),
    // - devastation conversion
    new Effect(
        `Ruin Pause`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                await context.target.update({ "system.ruinPaused": true }, { diff: false });
            })
        },
        (count) => {
            return "Target does not roll for [/status/Devastation] Devastating Hits until the next round."
        },
        ["Clash Win"], false, 1, false, true
    ),
    markerEffect("Devastation DMG+", false, 5, "Devastating Hit", (count) => {
        return `Deal ${count*3} HP damage.`;
    }),
    new Effect(
        "Armor Decay",
        (context, count, trigger) => {
            context.triggers["Devastating Hit"].applyInfliction("Disarm", count, false);
            context.triggers["Devastating Hit"].applyInfliction("Fragile", count, false);
            context.triggers["Devastating Hit"].applyInfliction("Stagger_Fragile", count, false);
        },
        (count) => {
            return `Inflict ${count} [/status/Disarm] Disarm, [/status/Fragile] Fragile, and [/status/Stagger_Fraggile] Stagger Fragile.`
        },
        ["Devastating Hit"],
        false, 5, false
    ),
    new Effect(
        "[Type] Deterioration",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let type = await pollUserInputOptions(ctx.actor, "Choose [Type] Fragility to inflict.", [
                    {
                        name: "Slash Fragility",
                        icon: "/status/Slash_Fragility.png"
                    },
                    {
                        name: "Pierce Fragility",
                        icon: "/status/Pierce_Fragility.png"
                    },
                    {
                        name: "Blunt Fragility",
                        icon: "/status/Blunt_Fragility.png"
                    },
                ]);

                data.applyInfliction(type.replace(" ", "_"), 2 * count, true);
            });
        },
        (count) => {
            return `Apply ${count * 2} [Type] Fragility next round, chosen on application.`
        },
        ["Devastating Hit"],
        false, 5, false, true
    ),
    new Effect(
        `Devastating Force`,
        (context, count, trigger) => {
            context.events["Devastating Hit"].push(async (context) => {
                createEffectsMessage(context.target.name, `Is pushed ${Math.min(count, context.devastation)} SQR by Devastating Force!`);
            })
        },
        (count) => {
            return `Push the target a distance equal to [/status/Devastation] Devastation, max ${count}.`
        },
        ["Devastating Hit"], false, 5, false, true
    ),
    new Effect(
        "Devastating Shock",
        (context, count, trigger) => {
            context.triggers["Devastating Hit"].applyInfliction("Bind", count * 2, false);
        },
        (count) => {
            return `Inflict ${count * 2} [/status/Bind] Bind next round.`
        },
        ["Devastating Hit"],
        false, 5, false
    ),
    new Effect(
        "Debilitate",
        (context, count, trigger) => {
            context.triggers["Devastating Hit"].applyInfliction("Feeble", count, true);
            context.triggers["Devastating Hit"].applyInfliction("Disarm", count, true);
            context.triggers["Devastating Hit"].applyInfliction("Bind", count * 2, true);
        },
        (count) => {
            return `Inflict ${count} [/status/Feeble] Feeble, [/status/Disarm] Disarm, and ${count * 2} [/status/Bind] Bind next roun.`
        },
        ["Devastating Hit"],
        false, 5, false
    ),
    markerEffect("Primer", false, 1),
    //
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
    //
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

function simpleStatusEffect(status, nextRound, allowNegative, nameOverride = null) {
    let str = nextRound ? " next round" : "";
    return new Effect(
        nameOverride != null ? nameOverride : `Inflict ${status}`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction(status.replace(" ", "_"), count, nextRound);
        },
        (count) => {
            return handleNegativeText(
                `Inflict % [/status/${status.replace(" ", "_")}] ${status}` + str, 
                `Gain % [/status/${status.replace(" ", "_")}] ${status}` + str, 
            count);
        },
        ["Clash Win", "Clash Lose"],
        allowNegative
    );
}

function statusPauseEffect(status, max = 5) {
    return new Effect(
        `${status}`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction(status.replace(" ", "_"), count, false);
        },
        (count) => {
            return `Inflict ${count} [/status/${status.replace(" ", "_")}] ${status}.`
        },
        ["Clash Win"],
        false, max
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

function markerEffect(name, negative = false, count = 1, trigger = "Always Active", desc = null) {
    return new Effect(
        name,
        (context, count, trigger) => { },
        desc,
        [trigger],
        negative,
        count
    );
}

function skillVigorEffect(status, req, dupReq) {
    return new Effect(
        `${status} Vigor`,
        (context, count, trigger) => {
            if (context.actor != null) {
                let stacks = context.actor.getStatusCount(status);
                req = context.actor.augmentEffectCount(`${status} Vigor`) > 0 ? req + dupReq : req;
                req += count;

                if (stacks >= req) {
                    context.dicePower = Number(context.dicePower) + count;
                }
            }
        },
        (count) => {
            return `Gain ${count} Dice Power if the user has ${req + count} [/status/${status}] ${status}.`
        },
        ["On Use"],
        false,
        5
    );
}

function skillBonusEffect(status, req, max = 5) {
    return new Effect(
        `${status} Bonus`,
        (context, count, trigger) => {
            if (context.target != null && context.target.getStatusCount(status) >= req + count) {
                context.dicePower = Number(context.dicePower) + count;
            }
        },
        (count) => {
            return `If the target has ${(req + count) > 1 ? (req + count) + " " : ""}[/status/${status}] ${status}, gain ${count} Dice Power`
        },
        ["On Use"],
        false,
        max
    );
}