import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";
import { pollDistributeStatus, pollUserInputConfirm, pollUserInputOptions, pollUserInputText } from "../helpers/dialog.mjs";
import { getActorTeam, scale } from "../../pmttrpg.mjs";
import { Conditional } from "../combat/rollContext.mjs";
import { findByID } from "../helpers/netmsg.mjs";

export const skillEffects = [
    new Effect(
        "Dice Power Up",
        (context, count, trigger) => { 
            context.dicePower = Number(context.dicePower) + Number(count);
            context.skillDicePower = Number(context.skillDicePower) + Number(count);
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
                        context.skillDicePower = Number(context.skillDicePower) - 1;
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
                context.skillDicePower = Number(context.skillDicePower) + Math.clamp(reactions, 2, 6);
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
                context.skillDicePower = Number(context.skillDicePower) + Number(count);
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
                context.skillDicePower = Number(context.skillDicePower) + Number(count);
            }
        },
        (count) => {
            return `Gain ${count} Dice Power if SP is less than ${(1 - (0.2 * count)) * 100}%`;
        },
        ["On Use"],
        false,
        4
    ),
    new Effect(
        "Overheat",
        (context, count, trigger) => { 
            context.dicePower = Number(context.dicePower) + 2;
            context.skillDicePower = Number(context.skillDicePower) + 2;
        },
        (count) => {
            return `Increase Dice Power by 2. Weapon becomes unusable until the end of next round.`
        },
        ["On Use"], false, 1
    ),
    markerEffect("Ignore Power", false, 1, "On Use", count => `Negate Dice Power changes on self and target, except from this skill`),
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
    simpleStatusEffect("Rupture", true, true),
    markerEffect("Rupture+", false, 3),
    skillVigorEffect("Rupture", 2, 0, 2),
    skillBonusEffect("Rupture", 2, 0, 5, 2),
    markerEffect("Instant Rupture", false, 1),
    new Effect(
        `Rupture Reversal`,
        (context, count, trigger) => {
            context.events["Rupture Burst"].push(async (context) => {
                let rupture = await context.target.getStatusCount("Rupture");
                if (rupture <= 0) return;
                rupture = Math.max(rupture, 16);
                
                let php = context.actor.system.attributes.health.value;
                await context.actor.heal(rupture, 0, 0);
                let hp = context.actor.system.attributes.health.value;
                createEffectsMessage(context.actor.name, `Healed ${rupture} HP from Rupture Reversal! (${php} -> ${hp})`);
            })
        },
        (count) => {
            return "Heal equal to [/status/Rupture] Rupture on target at time of burst (max 16)."
        },
        ["Rupture Burst"], false, 1, false, true
    ),
    new Effect(
        `Rupture Boost`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                context.forcedBurst.push("Rupture");
                let rupture = await context.target.getStatusCount("Rupture");
                if (rupture <= 3) return;

                await context.actor.takeDamageStatus(Math.floor(rupture / 2), "none", "HP", "Takes %DMG% HP damage from Rupture Boost! (%PHP% -> %HP%)");
                await context.target.takeDamageStatus(Math.floor(rupture / 2), "none", "HP", "Takes %DMG% HP damage from Rupture Boost! (%PHP% -> %HP%)");
            })
        },
        (count) => {
            return "Burst [/status/Rupture] Rupture. If the target has 4+ [/status/Rupture] Rupture, deal half of it as HP damage to target and self."
        },
        ["Clash Win"], false, 1, false, true
    ),
    new Effect(
        `Rupture Pause`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                context.forcedExcludeBurst.push("Rupture");
                let rupture = await context.target.getStatusCount("Rupture");
                if (rupture <= 0) return;

                await context.target.setStatus("Rupture", 0);
                await context.target.applyStatus("Rupture", 0, rupture);
                createEffectsMessage(context.target.name, `${rupture} active [/status/Rupture] Rupture moved to next round!`);
            })
        },
        (count) => {
            return "All [/status/Rupture] Rupture on target is moved to apply next round."
        },
        ["Clash Win"], false, 1, false, true
    ),
    new Effect(
        `Rupture Jag`,
        (context, count, trigger) => {
            context.triggers["Rupture Burst"].modify.push(async (context, data) => {
                let rupture = await context.target.getStatusCount("Rupture");
                if (rupture <= 0) return;
                rupture = Math.max(Math.floor(rupture / 2), count * 3);
                
                data.applyInfliction("Fragile", rupture, true);
            })
        },
        (count) => {
            return `Inflict [/status/Fragile] Fragile next round equal to half of burst [/status/Rupture] Rupture, max ${count * 3}.`
        }, 
        ["Rupture Burst"], false, 5, false, true
    ),
    new Effect(
        `Rupture Wounds`,
        (context, count, trigger) => {
            context.triggers["Rupture Burst"].applyInfliction("Bleed", 4, false);
        },
        (count) => {
            return `Inflict 4 [/status/Bleed] Bleed.`
        }, 
        ["Rupture Burst"], false, 1, false, false
    ),
    markerEffect("Rupture Shred", false, 1),
    new Effect(
        `Ruptured Omen`,
        (context, count, trigger) => {
            context.triggers["Rupture Burst"].modify.push(async (context, data) => {
                let rupture = await context.target.getStatusCount("Rupture");
                if (rupture <= 3) return;
                data.applyInfliction("Ruin", 1, false);
                data.applyInfliction("Devastation", 3, false);
            })
        },
        (count) => {
            return `If the target had 4+ [/status/Rupture] Rupture, inflict 1 [/status/Ruin] Ruin and 3 [/status/Devastation] Devastation.`
        }, 
        ["Rupture Burst"], false, 1, false, true
    ),
    //
    simpleStatusEffect("Tremor", true, true),
    markerEffect("Tremor+", false, 3),
    skillVigorEffect("Tremor", 3, 0, 1),
    skillBonusEffect("Tremor", 3, 5, 1),
    markerEffect("Instant Tremor", false, 1),
    new Effect(
        `Tremor Reversal`,
        (context, count, trigger) => {
            context.events["Tremor Burst"].push(async (context) => {
                let tremor = await context.target.getStatusCount("Tremor");
                if (tremor <= 0) return;
                tremor = Math.max(tremor, 10);
                
                let pst = context.actor.system.attributes.stagger.value;
                await context.actor.heal(0, tremor, 0);
                let st = context.actor.system.attributes.stagger.value;
                createEffectsMessage(context.actor.name, `Healed ${tremor} ST from Tremor Reversal! (${pst} -> ${st})`);
            })
        },
        (count) => {
            return "Heal ST equal to [/status/Tremor] Tremor on target at time of burst (max 10)."
        },
        ["Tremor Burst"], false, 1, false, true
    ),
    new Effect(
        `Tremor Boost`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                context.forcedBurst.push("Tremor");
                let tremor = await context.target.getStatusCount("Tremor");
                if (tremor <= 3) return;

                await context.actor.takeDamageStatus(Math.floor(tremor / 2), "none", "ST", "Takes %DMG% ST damage from Tremor Boost! (%PST% -> %ST%)");
                await context.target.takeDamageStatus(Math.floor(tremor / 2), "none", "ST", "Takes %DMG% ST damage from Tremor Boost! (%PST% -> %ST%)");
            })
        },
        (count) => {
            return "Burst [/status/Tremor] Tremor. If the target has 4+ [/status/Tremor] Tremor, deal half of it as ST damage to target and self."
        },
        ["Clash Win"], false, 1, false, true
    ),
    new Effect(
        `Tremor Pause`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                context.forcedExcludeBurst.push("Tremor");
                let tremor = await context.target.getStatusCount("Tremor");
                if (tremor <= 0) return;

                await context.target.setStatus("Tremor", 0);
                await context.target.applyStatus("Tremor", 0, tremor);
                createEffectsMessage(context.target.name, `${tremor} active [/status/Tremor] Tremor moved to next round!`);
            })
        },
        (count) => {
            return "All [/status/Tremor] Tremor on target is moved to apply next round."
        },
        ["Clash Win"], false, 1, false, true
    ),
    new Effect(
        `Tremor Break`,
        (context, count, trigger) => {
            context.triggers["Tremor Burst"].modify.push(async (context, data) => {
                let tremor = await context.target.getStatusCount("Tremor");
                if (tremor <= 0) return;
                tremor = Math.max(Math.floor(tremor / 2), count * 3);
                
                data.applyInfliction("Stagger_Fragile", tremor, true);
            })
        },
        (count) => {
            return `Inflict [/status/Stagger_Fragile] Stagger Fragile next round equal to half of burst [/status/Tremor] Tremor, max ${count * 3}.`
        }, 
        ["Tremor Burst"], false, 5, false, true
    ),
    new Effect(
        `Tremor Shock`,
        (context, count, trigger) => {
            context.triggers["Tremor Burst"].modify.push(async (context, data) => {
                data.applyInfliction("Bind", 3, true);
            })
        },
        (count) => {
            return `Inflict 3 [/status/Bind] Bind next round.`
        }, 
        ["Tremor Burst"], false, 1, false, true
    ),
    new Effect(
        `Tremoring Nerves`,
        (context, count, trigger) => {
            context.triggers["Tremor Burst"].modify.push(async (context, data) => {
                data.applyInfliction("Feeble", 2, true);
                data.applyInfliction("Disarm", 2, true);
            })
        },
        (count) => {
            return `Target takes no ST damage from burst. Inflict 2 [/status/Feeble] Feeble and [/status/Disarm] Disarm next round.`
        }, 
        ["Tremor Burst"], false, 1, false, true
    ),
    new Effect(
        "Tremor Slam",
        (context, count, trigger) => {
            context.events["Tremor Burst"].push(async (ctx) => {
                let tremor = Math.min(ctx.target.getStatusCount("Tremor"), count * 2);
                
                if (tremor > 2) {
                    await createEffectsMessage(ctx.target.name, `Is pushed ${Math.floor(tremor / 2)} SQR away by Tremor Slam!`);
                }
            });
        },
        (count) => {
            return `Push the target 1 SQR for every 2 [/status/Tremor] Tremor bursted, max ${count}.`
        },
        ["Tremor Burst"],
        false, 5, false, true
    ),
    // earthquake
    //
    simpleStatusEffect("Sinking", true, true),
    markerEffect("Sinking+", false, 3),
    skillVigorEffect("Sinking", 3, 0, 1),
    skillBonusEffect("Sinking", 3, 5, 1),
    markerEffect("Instant Sinking", false, 1),
    new Effect(
        `Sinking Pause`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                context.forcedExcludeBurst.push("Sinking");
                let sinking = await context.target.getStatusCount("Sinking");
                if (sinking <= 0) return;

                await context.target.setStatus("Sinking", 0);
                await context.target.applyStatus("Sinking", 0, sinking);
                createEffectsMessage(context.target.name, `${sinking} active [/status/Sinking] Sinking moved to next round!`);
            })
        },
        (count) => {
            return "All [/status/Sinking] Sinking on target is moved to apply next round."
        },
        ["Clash Win"], false, 1, false, true
    ),
    new Effect(
        `Sinking Deluge`,
        (context, count, trigger) => {
            context.events["Sinking Burst"].push(async (context) => {
                let sinking = await context.target.getStatusCount("Sinking");
                if (sinking <= 0) return;

                await context.target.takeDamageStatus(Math.floor(context.target.system.staggered || context.target.system.attributes.sanity.value <= 0 ? sinking * 2 : sinking * 1.5),
                "none", "HP", "Takes %DMG% HP damage from [/status/Sinking] Sinking Deluge! (%PHP% -> %HP)");
            })
        },
        (count) => {
            return "Deal HP damage equal to 1.5x burst [/status/Sinking] Sinking. If the target is staggered or in panic, deal 2x instead."
        },
        ["Sinking Burst"], false, 1, false, true
    ),
    new Effect(
        `Broken Heart`,
        (context, count, trigger) => {
            context.triggers["Sinking Burst"].modify.push(async (context, data) => {
                let sinking = await context.target.getStatusCount("Sinking");
                if (sinking < 2) return;

                data.applyInfliction("Paralysis", Math.min(Math.floor(sinking / 2), count), true);
            })
        },
        (count) => {
            return `Inflict [/status/Paralysis] Paralysis next round equal to half of burst [/status/Sinking] Sinking, max ${count}`
        },
        ["Sinking Burst"], false, 5, false, true
    ),
    new Effect(
        `Suffocated Will`,
        (context, count, trigger) => {
            context.triggers["Sinking Burst"].modify.push(async (context, data) => {
                let sinking = await context.target.getStatusCount("Sinking");
                if (sinking <= 0) return;

                data.applyInfliction("Smoke", Math.min(sinking, count * 2), false);
            })
        },
        (count) => {
            return `Inflict [/status/Smoke] Smoke next round equal to burst [/status/Sinking] Sinking, max ${count * 2}`
        },
        ["Sinking Burst"], false, 5, false, true
    ),
    new Effect(
        `Spine Chill`,
        (context, count, trigger) => {
            context.triggers["Sinking Burst"].modify.push(async (context, data) => {
                let sinking = await context.target.getStatusCount("Sinking");
                if (sinking <= 0) return;

                data.applyInfliction("Frostbite", Math.min(sinking, count * 2), false);
            })
        },
        (count) => {
            return `Inflict [/status/Frostbite] Frostbite next round equal to burst [/status/Sinking] Sinking, max ${count * 2}`
        },
        ["Sinking Burst"], false, 5, false, true
    ),
    new Effect(
        `Absorb Sinking`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                let sinking = await context.target.getStatusCount("Sinking");
                if (sinking <= 0) return;

                let gain = Math.min(Math.floor(sinking / 2), count);

                if (gain > 0) {
                    await context.actor.applyStatus("Strength", 0, gain);
                    await context.actor.applyStatus("Endurance", 0, gain);
                }

                await context.target.setStatus("Sinking", 0);
                await context.actor.setStatusNext("Sinking", sinking);

                createEffectsMessage(context.actor.name, `Absorbs ${sinking} [/status/Sinking] Sinking from target${gain > 0 ? ` gaining ${gain} [/status/Strength] Strength and [/status/Endurance] Endurance` : ""}!`);
            })
        },
        (count) => {
            return `Transfer all [/status/Sinking] Sinking from target to self. Gain 1 [/status/Strength] Strength and [/status/Endurance] Endurance next round for every 2 absorbed, max ${count}.`
        },
        ["Clash Win"], false, 5, false, true
    ),
    new Effect(
        `Transfer Sinking`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                let sinking = Math.min(await context.actor.getStatusCount("Sinking"), count);
                if (sinking <= 0) return;

                await context.actor.reduceStatus("Sinking", sinking);
                await context.target.applyStatus("Sinking", 0, sinking);

                createEffectsMessage(context.actor.name, `Transfers ${sinking} [/status/Sinking] Sinking to the target!`);
            })
        },
        (count) => {
            return `Transfer up to ${count} [/status/Sinking] Sinking from self to target, applying next round.`
        },
        ["Clash Win"], false, 5, false, true
    ),
    markerEffect("Lowered Guard", false, 5, "Clash Lose", (count) => {
        return `When at ${count}+ [/status/Sinking] Sinking, gain ${count * 2} [/status/Protection] Protection and [/status/Stagger_Protection] Stagger Protection before taking damage.`
    }),
    //
    simpleStatusEffect("Smoke", false, true),
    new Effect(
        `Smoke Overflow`,
        (context, count, trigger) => {
            if (context.actor != null) {
                let stacks = context.actor.getStatusCount("Smoke");
                let req = (2 * count) + (2 * context.actor.augmentEffectCount(`Smoke Overflow`));

                if (stacks >= req) {
                    context.dicePower = Number(context.dicePower) + count;
                    context.skillDicePower = Number(context.skillDicePower) + count;
                }
            }
        },
        (count) => {
            return `Gain ${count} Dice Power if the user has ${2 * count}+ [/status/Smoke] Smoke. Increase requirement by 2 for every count of Smoke Overflow on augment..`
        },
        ["On Use"],
        false,
        5
    ),
    skillBonusEffect("Smoke", 3, 5, 1),
    markerEffect("Fumigate", false, 1, "Clash Win", (count) => {
        return "Consume all [/status/Smoke] Smoke to deal HP damage equal to [/status/Smoke] Smoke consumed."
    }),
    new Effect(
        `Inhale Smoke`,
        (context, count, trigger) => {
            context.events[`${trigger} Instant`].push(async (context) => {
                let smoke = await context.target.getStatusCount("Smoke");
                if (smoke <= 0) return;

                await context.target.setStatus("Smoke", 0);
                await context.actor.setStatusNext("Smoke", smoke);

                createEffectsMessage(context.actor.name, `Absorbs ${smoke} [/status/Smoke] Smoke from target!`);
            })
        },
        (count) => {
            return `Transfer all [/status/Smoke] Smoke from target to self.`
        },
        ["Clash Win", "Clash Lose"], false, 1, false, true
    ),
    new Effect(
        `Exhale Smoke`,
        (context, count, trigger) => {
            context.events[`${trigger} Instant`].push(async (context) => {
                let smoke = Math.min(await context.actor.getStatusCount("Smoke"), count);
                if (smoke <= 0) return;

                await context.actor.reduceStatus("Smoke", smoke);
                await context.target.applyStatus("Smoke", 0, smoke);

                createEffectsMessage(context.actor.name, `Transfers ${smoke} [/status/Smoke] Smoke to the target!`);
            })
        },
        (count) => {
            return `Transfer all [/status/Smoke] Smoke from self to target.`
        },
        ["Clash Win", "Clash Lose"], false, 1, false, true
    ),
    markerEffect("Smoke Stack", false, 1),
    new Effect(
        `Evaporate`,
        (context, count, trigger) => {
            context.events[`${trigger}`].push(async (context) => {
                let count = await context.actor.performReduceStatus("Evaporate", context.actor.getReduceStatusCount());

                if (count >= 2) {
                    let smoke = Math.floor(count / 2);
                    smoke = Math.min(smoke, 3 * count);

                    await context.actor.applyStatus("Smoke", smoke, 0);
                    createEffectsMessage(context.actor.name, `Gained ${smoke} [/status/Smoke] Smoke from Evaporate!`)
                }
            })
        },
        (count) => {
            return `Perform Reduce Status and gain half of what is reduced as [/status/Smoke] Smoke, max ${3 * count}.`
        },
        ["Clash Win", "Clash Lose"], false, 1, false, true
    ),
    smokeStatusEffect("Burn", 2, false, 1),
    smokeStatusEffect("Bleed", 2, false, 1),
    smokeStatusEffect("Frostbite", 2, false, 1),
    smokeStatusEffectSelf("Poise", 2, false, 1),
    smokeStatusEffect("Ruin", 2, false, 1),
    smokeStatusEffect("Paralysis", 1, true, 1),
    smokeStatusEffectSelf("Strength", 1, true, 3),
    smokeStatusEffectSelf("Endurance", 1, true, 3),
    smokeStatusEffect("Feeble", 1, true, 3),
    smokeStatusEffect("Disarm", 1, true, 3),
    //
    markerEffect("Instant Haste"),
    new Effect(
        `Circle Throw`,
        (context, count, trigger) => {
            context.events["Clash Win"].push(async (context) => {
                if (context.actor.getStatusCount("Haste") >= count) {
                    createEffectsMessage(context.target.name, `Is pushed ${count} SQR by Circle Throw!`);
                }
            })
        },
        (count) => {
            return `If at or above ${count} [/status/Haste] Haste, push the target ${count} SQR in any direction.`
        },
        ["Clash Win"], false, 5, false, true
    ),
    new Effect(
        `Follow Through`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional(
                "Follow Through", `When moving ${count * 2} SQR before the attack, deal ${count}d8 Force Damage`,
                (context) => {
                    context.flags.push("Follow Through");
                },
                [], null
            ));

            context.events["Clash Win"].push(async (context) => {
                if (context.actor.getStatusCount("Haste") >= count * 2 && context.flags.includes("Follow Through")) {
                    await context.target.takeForceDamage(count, context);
                }
            });
        },
        (count) => {
            return `If at or above ${count} [/status/Haste] Haste and moved ${count * 2} SQR towards the target, deal ${count}d8 Force Damage.`
        },
        ["Clash Win"], false, 5, false, true
    ),
    new Effect(
        `Blitz`,
        (context, count, trigger) => {
            if (context.actor.getStatusCount("Haste") >= count * 2) {
                context.dicePower = Number(context.dicePower) - 2;
                context.skillDicePower = Number(context.skillDicePower) - 2;
            }
        },
        (count) => {
            return `If at or above ${count * 2} [/status/Haste] Haste, replace attack with ${count} attacks with -2 Dice Power.`
        },
        ["On Use"], false, 2, false, false
    ),
    new Effect(
        `Overspeed`,
        (context, count, trigger) => {
            if (context.actor.getStatusCount("Haste") >= count * 2) {
                context.dicePower = Number(context.dicePower) - 2;
                context.skillDicePower = Number(context.skillDicePower) - 2;
            }
        },
        (count) => {
            return `Attack becomes a piercing line up to [/status/Haste] Haste SQR, with -2 Dice Power.`
        },
        ["On Use"], false, 1, false, false
    ),
    //
    healEffect(2, "HP"),
    healEffect(1, "ST"),
    healEffect(1, "SP"),
    simpleStatusEffectSelf("Strength", 1),
    simpleStatusEffectSelf("Endurance", 1),
    simpleStatusEffectSelf("Haste", 1),
    simpleStatusEffectSelf("Protection", 1),
    simpleStatusEffectSelf("Stagger Protection", 1),
    allyStatusEffect("Protection", 2, true),
    allyStatusEffect("Stagger Protection", 2, true),
    allyStatusEffect("[Type] Protection", 2, true),
    allyStatusEffect("Strength", 1, true),
    allyStatusEffect("Endurance", 1, true),
    allyStatusEffect("Haste", 1, true),
    allyStatusEffect("Poise", 1, true),
    allyStatusEffect("Critical", 1, true),
    new Effect(
        "[Type] Protection",
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let type = await pollUserInputOptions(ctx.actor, "Choose [Type] Protection to gain.", [
                    {
                        name: "Slash Protection",
                        icon: "/status/Slash_Protection.png"
                    },
                    {
                        name: "Pierce Protection",
                        icon: "/status/Pierce_Protection.png"
                    },
                    {
                        name: "Blunt Protection",
                        icon: "/status/Blunt_Protection.png"
                    },
                ]);
                data.applyInfliction(type.replace(" ", "_"), -count, true);
            });
        },
        (count) => {
            return `Gain ${count} [Type] Protection next round, chosen on application.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
    ),
    //
    markEffect("Tire them Out",
        (data, count) => {
            data.applyInfliction("Stagger_Fragile", 3 * count, true);
        },
        count => `apply ${count * 3} [/status/Stagger_Fragile] Stagger Fragile next round`,
    ),
    markEffect("Finish them Off",
        (data, count) => {
            data.applyInfliction("Fragile", 3 * count, true);
        },
        count => `apply ${count * 3} [/status/Fragile] Fragile next round`,
    ),
    markEffect("Ignite the Wound",
        (data, count) => {
            data.applyInfliction("Burn", count, false);
            data.applyInfliction("Bleed", count, false);
        },
        count => `apply ${count} [/status/Burn] Burn and [/status/Bleed] Bleed`,
    ),
    markEffect("Hammer the Gap",
        (data, count) => {
            data.applyInfliction("Rupture", count * 2, true);
            data.applyInfliction("Tremor", count, true);
        },
        count => `apply ${count * 2} [/status/Rupture] Rupture and ${count} [/status/Tremor] Tremornext round`,
    ),
    markEffect("Make them Cry",
        (data, count) => {
            data.applyInfliction("Sinking", count, false);
            data.applyInfliction("Smoke", count, false);
        },
        count => `apply ${count} [/status/Sinking] Sinking and [/status/Smoke] Smoke`,
    ),
    markEffect("Freeze in Place",
        (data, count) => {
            data.applyInfliction("Frostbite", count, false);
            data.applyInfliction("Bind", count, true);
        },
        count => `apply ${count} [/status/Frostbite] Frostbite and [/status/Bind] Bind`,
    ),
    markEffect("Sense their Weakness",
        (data, count) => {
            data.applyInfliction("Ruin", count, false);
            data.applyInfliction("Poise", -count, false);
        },
        count => `apply ${count} [/status/Ruin] Ruin and gain ${count} [/status/Poise] Poise`,
    ),
    markEffect("Exploit the Opportunity",
        (data, count) => {
            data.applyInfliction("Devastation", count, false);
            data.applyInfliction("Critical", -count, false);
        },
        count => `apply ${count} [/status/Devastation] Devastation and gain ${count} [/status/Critical] Critical`,
    ),
    markEffect("Weaken your Quarry",
        (data, count) => {
            data.applyInfliction("Feeble", count, true);
            data.applyInfliction("Disarm", count, true);
        },
        count => `apply ${count} [/status/Feeble] Feeble and [/status/Disarm] Disarm next round`,
    ),
    markEffect("Capture Them",
        (data, count) => {
            data.applyInfliction("Bind", count * 2, true);
            data.applyInfliction("Paralysis", count, true);
        },
        count => `apply ${count * 2} [/status/Bind] Bind and ${count} [/status/Paralysis] Paralysis next round`,
    ),
    //
    new Effect(
        "Ignore Infliction",
        (context, count, trigger) => {
            context.events[`${trigger} Instant`].push(async (context) => {
                context.flags.push("IgnoreInfliction");
            });
        },
        (count) => {
            return `Ignore target's status inflictions.`
        },
        ["Clash Win", "Clash Lose"], false, 1, false, true
    ),
    new Effect(
        `Shooting Star`,
        (context, count, trigger) => {
            context.dicePower = Number(context.dicePower) - 1;
            context.skillDicePower = Number(context.skillDicePower) - 1;
        },
        (count) => {
            return `Replace attack with a piercing line attack with -1 Dice Power.`
        },
        ["On Use"], false, 1, false, false
    ),
    new Effect(
        `Multi-Hit`,
        (context, count, trigger) => {
            context.dicePower = Number(context.dicePower) - 2;
            context.skillDicePower = Number(context.skillDicePower) - 2;
        },
        (count) => {
            return `Replace attack with ${1 + count} attacks with -2 Dice Power each.`
        },
        ["On Use"], false, 2, false, false
    ),
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
    chargeEffect("Charge - Dice Power Up", 6,
        (context, count, trigger) => {
            context.dicePower = Number(context.dicePower) + count;
            context.skillDicePower = Number(context.skillDicePower) + count;
        },
        count => `increase Dice Power by ${count}`
    ),
    chargeEffect("Charge - Dice Max Up", 3,
        (context, count, trigger) => {
            context.diceMax = Number(context.diceMax) + count;
        },
        count => `increase Dice Max by ${count}`
    ),
    chargeEffect("Charge - Regen HP", 2,
        (context, count, trigger) => {
            context.triggers[trigger].hpHeal = Number(context.triggers[trigger].hpHeal) + (count * 3);
        },
        count => `recover ${count * 3} HP`
    ),
    chargeEffect("Charge - Regen ST", 2,
        (context, count, trigger) => {
            context.triggers[trigger].stHeal = Number(context.triggers[trigger].stHeal) + (count * 2);
        },
        count => `recover ${count * 2} ST`
    ),
    chargeEffect("Charge - Regen SP", 2,
        (context, count, trigger) => {
            context.triggers[trigger].spHeal = Number(context.triggers[trigger].spHeal) + (count * 2);
        },
        count => `recover ${count * 2} SP`
    ),
    //
    chargeInflictStatus("Burn", 2),
    chargeInflictStatus("Frostbite", 2),
    chargeInflictStatus("Bleed", 2),
    chargeInflictStatus("Smoke", 2),
    chargeInflictStatus("Rupture", 1, true),
    chargeInflictStatus("Tremor", 2, true),
    chargeInflictStatus("Sinking", 3, true),
    chargeInflictStatus("Ruin", 2),
    chargeInflictStatus("Paralysis", 4, true),
    chargeInflictStatus("Feeble", 6, true),
    chargeInflictStatus("Bind", 3, true),
    chargeInflictStatus("Disarm", 6, true),
    chargeInflictStatus("Fragile", 3, true),
    chargeInflictStatus("Stagger_Fragile", 4, true),
    //
    chargeAllyStatusEffect("Poise", 2, 1, false),
    chargeAllyStatusEffect("Strength", 6, 1, true),
    chargeAllyStatusEffect("Endurance", 6, 1, true),
    chargeAllyStatusEffect("Haste", 3, 1, true),
    chargeAllyStatusEffect("Protection", 2, 2, true),
    chargeAllyStatusEffect("Stagger Protection", 2, 2, true),
    chargeAllyStatusEffect("[Type] Protection", 2, 2, true),
    chargeAllyStatusEffect("Charge Barrier", 2, 1, true),
    //
    chargeEffect("Charge - Multihit", 6,
        (context, count, trigger) => {
            context.dicePower = Number(context.dicePower) - 2;
            context.skillDicePower = Number(context.skillDicePower) - 2;
        },
        count => `replace attack with ${count} attacks with -2 Dice Power each`
    , ["On Use"], 2),
    chargeEffect("Charge - Shooting Star", 6,
        (context, count, trigger) => {
            context.dicePower = Number(context.dicePower) - 1;
            context.skillDicePower = Number(context.skillDicePower) - 1;
        },
        count => `replace attack with a piercing line with -1 Dice Power`
    , ["On Use"], 1),
    //
    new Effect(
        "Charge - Maintained Barrier",
        (context, count, trigger) => {
            context.events[`${trigger}`].push(async (context) => {
                await context.actor.setMaintainedBarrier(true);
            });
        },
        (count) => {
            return `[/status/Charge_Barrier] Charge Barrier only decays by half at end of round.`
        },
        ["Clash Win"], false, 1, false, true
    ),
    new Effect(
        "Charge - Repellent Barrier",
        (context, count, trigger) => {
            context.events[`${trigger}`].push(async (context) => {
                let barrier = await context.getStatusCount("Charge_Barrier");

                if (barrier > 0) {
                    createEffectsMessage(context.actor.name, `Pushes the target ${Math.min(barrier, count)} SQR from Repellent Barrier!`);
                }
            });
        },
        (count) => {
            return `Push the target a distance equal to [/status/Charge_Barrier] Charge Barrier on self, max ${count} SQR.`
        },
        ["Clash Win", "Clash Lose"], false, 5, false, true
    ),
    new Effect(
        `Charge - Seismic Generator`,
        (context, count, trigger) => {
            context.triggers["Tremor Burst"].modify.push(async (context, data) => {
                let tremor = await context.target.getStatusCount("Tremor");
                if (tremor <= 0) return;
                tremor = Math.max(tremor, 12);
                
                data.applyInfliction("Charge", -tremor, true);
            })
        },
        (count) => {
            return `Gain [/status/Charge] Charge equal to burst [/status/Tremor] Tremor, max 12`
        }, 
        ["Tremor Burst"], false, 1, false, true
    ),
    new Effect(
        `Charge - Rupturing Generator`,
        (context, count, trigger) => {
            context.triggers["Rupture Burst"].modify.push(async (context, data) => {
                let rupture = await context.target.getStatusCount("Rupture");
                if (rupture <= 0) return;
                rupture = Math.max(rupture, 12);
                
                data.applyInfliction("Charge", -rupture, true);
            })
        },
        (count) => {
            return `Gain [/status/Charge] Charge equal to burst [/status/Rupture] Rupture, max 12`
        }, 
        ["Rupture Burst"], false, 1, false, true
    ),
    //
    overchargeEffectEvent("Overcharge - Refraction Strike", 1,
        (context, count, trigger) => {
            if (context.actor && !context.flags.includes("Refraction Strike")) {
                let reactions = context.actor.system.reactions;
                context.dicePower = Number(context.dicePower) + Math.clamp(reactions, 1, 6);
                context.skillDicePower = Number(context.skillDicePower) + Math.clamp(reactions, 1, 6);
            }

            context.events["On Use"].push(async (context) => {
                await context.actor.update({ "system.reactions": 0 }, { diff: false });
                createEffectsMessage(context.actor.name, `${context.actor.name} burns all of their reactions to empower the attack!`);
            });
        },
        count => `forfeit all reactions and increase Dice Power by the amount forfeit, max 6`,
        ["On Use"], 1
    ),
    overchargeEffectEvent("Overcharge - Charge Release", 1,
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                await context.actor.takeForceDamage(count, context);
            });
        },
        count => `deal ${count}d8 Force Damage and push target up to ${count * 2} SQR`,
        ["Clash Win"], 3, false
    ),
    overchargeEffectEvent("Overcharge - Loaded Branding", 2,
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                await context.actor.handleLoadedBranding(context.target);
            });
        },
        count => `mark the target with ANY mark type.`,
        ["Clash Win", "Clash Lose"], 1, false
    ),
    overchargeEffectEvent("Overcharge - Reflective Barrier", 3,
        (context, count, trigger) => {
            context.events[`${trigger} Instant`].push(async (context) => {
                context.flags.push("Reflective Barrier");
            });
        },
        count => `reflect the target's status inflictions back to them`,
        ["Clash Win", "Clash Lose"], 1, false
    ),
    overchargeEffectEvent("Overcharge - Charge Byproducts", 1,
        (context, count, trigger) => {
            
        },
        count => `create up to ${count * 2} hazards in adjacent tiles`,
        ["Clash Win", "Clash Lose"], 5, true
    ),
    overchargeEffect("Overcharge - Adaptive Shot", 2,
        (context, count, trigger) => {
            context.dicePower = Number(context.dicePower) - 1;
            context.skillDicePower = Number(context.skillDicePower) - 1;
        },
        count => `replace attack with a piercing line with -1 Dice Power. The line may redirect up to two times when hitting a target.`,
        ["On Use"], 1, false
    ),
    overchargeEffect("Overcharge - Rip Space", 4,
        (context, count, trigger) => {
            context.flags.push("Rip Space");
        },
        count => `cause all damage dealt by this attack to strike Weak (1.5x), unless the target is already Fatal (2x).`,
        ["On Use"], 1, false
    ),
    overchargeEffectEvent("Overcharge - Replicating Shell", 1,
        (context, count, trigger) => {
            context.events[`${trigger}`].push(async (context) => {
                let total = 0;
                applyInAoe(context.actor, 3, async (actor) => {
                    total++;
                    if (total <= count) {
                        await actor.applyStatus("Charge_Barrier", 0, 5);
                    }
                }, context.actor);
            });
        },
        count => `apply 5 [/status/Charge_Barrier] Charge Barrier next round to up to ${count} allies within 3 SQR`,
        ["Clash Win", "Clash Lose"], 5, true
    ),
    overchargeEffectEvent("Overcharge - Vulnerability", 4,
        (context, count, trigger) => {
            context.events[`${trigger} Instant`].push(async (context) => {
                context.flags.push("OC Vuln");
            });
        },
        count => `double all status inflictions.`,
        ["Clash Win"], 1, false
    ),
    new Effect(
        `Overcharge - Reenergize`,
        (context, count, trigger) => {
            context.events[`${trigger}`].push(async (context) => {
                let count = await pollUserInputText(context.actor, "Choose [/status/Overcharge] Overcharge count to spend.", 0, "number", context.actor.getStatusCount("Overcharge"), 0);

                if (count > 0) {
                    await context.actor.reduceStatus("Overcharge", count);
                    await context.actor.applyStatus("Charge", count * 8);
                    createEffectsMessage(context.actor.name, `Spends ${count} [/status/Overcharge] Overcharge to gain ${count * 8} [/status/Charge] Charge!`)
                }
            })
        },
        (count) => {
            return `Convert any amount of [/status/Overcharge] Overcharge into 8x as much [/status/Charge] Charge.`
        },
        ["On Use"], false, 1, false, true
    ),
]

function healEffect(val, cat) {
    return new Effect(
        `Regen ${cat}`,
        (context, count, trigger) => {
            if (count < 0) {
                data.events[trigger].push(async (context) => {
                    await context.actor.takeDamageStatus(val, "none", cat, `Takes %DMG% ${cat} damage! (%P${cat}% -> %${cat}%)`);
                });
            }
            else if (count > 0 && !context.flags.includes(`performed${cat}Regen`)) {
                context.flags.push(`performed${cat}Regen`);
                switch (cat) {
                    case "HP":
                        context.triggers[trigger].hpHeal = Number(context.triggers[trigger].hpHeal) + (count * val);
                        break;
                    case "ST":
                        context.triggers[trigger].stHeal = Number(context.triggers[trigger].stHeal) + (count * val);
                        break;
                    case "SP":
                        context.triggers[trigger].spHeal = Number(context.triggers[trigger].spHeal) + (count * val);
                        break;
                }
            }
        },
        (count) => {
            return count < 0 ? `Take ${count * val} ${cat} damage` : `Recover ${count * val} ${cat}`;
        },
        ["Clash Win", "Clash Lose"],
        true, 5, false, true
    );
}

function chargeInflictStatus(name, cost, nextRound = false) {
    return chargeEffect(`Charge - ${name}`, cost,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction(name.replace(" ", "_"), count, nextRound);
        },
        count => `inflict ${count} [/status/${name.replace(" ", "_")}] ${name}${nextRound ? " next round" : ""}`
    );
}

function overchargeEffectEvent(name, cost, func, desc, triggers = ["Clash Win", "Clash Lose"], maxCount = 5, scale = false) {
    return new Effect(
        name,
        (context, count, trigger) => {
            if (!context.flags.includes(name)) {
                context.costs.push({
                    cost: scale ? cost * count : cost,
                    status: "Overcharge",
                })
                context.flags.push(name);
            }

            func(context, count, trigger);
        },
        (count) => {
            return `Consume ${scale ? cost * count : cost} [/status/Overcharge] Overcharge to ` + desc(count);
        },
        triggers,
        false, maxCount, false, true
    );
}

function overchargeEffect(name, cost, func, desc, triggers = ["Clash Win", "Clash Lose"], maxCount = 5, scale = false) {
    return new Effect(
        name,
        (context, count, trigger) => {
            context.costs.push({
                cost: scale ? cost * count : cost,
                status: "Overcharge",
            })

            func(context, count, trigger);
        },
        (count) => {
            return `Consume ${scale ? cost * count : cost} [/status/Overcharge] Overcharge to ` + desc(count);
        },
        triggers,
        false, maxCount
    );
}

function chargeEffect(name, cost, func, desc, triggers = ["Clash Win", "Clash Lose"], maxCount = 5) {
    return new Effect(
        name,
        (context, count, trigger) => {
            context.costs.push({
                cost: cost * count,
                status: "Charge",
            })

            func(context, count, trigger);
        },
        (count) => {
            return `Consume ${cost * count} [/status/Charge] Charge to ` + desc(count);
        },
        triggers,
        false, maxCount
    );
}

function chargeEffectEvent(name, cost, func, desc, triggers = ["Clash Win", "Clash Lose"], maxCount = 5) {
    return new Effect(
        name,
        (context, count, trigger) => {
            if (!context.flags.includes(name)) {
                context.costs.push({
                    cost: cost * count,
                    status: "Charge",
                })

                context.flags.push(name);
            }

            func(context, count, trigger);
        },
        (count) => {
            return `Consume ${cost * count} [/status/Charge] Charge to ` + desc(count);
        },
        triggers,
        false, maxCount, false, true
    );
}

function markEffect(name, func, desc) {
    return new Effect(
        name,
        (context, count, trigger) => {
            if (context.actor.isMarkedTarget(context.target)) {
                func(context.triggers[trigger], count);
            }
        },
        (count) => {
            return `Against marked target, ` + desc(count);
        },
        ["Clash Win", "Clash Lose"],
        false, 5
    );
}

function simpleStatusEffectSelf(status, amount) {
    return new Effect(
        `${status}`,
        (context, count, trigger) => {
            data.applyInfliction(status.replace(" ", "_"), amount, true);
        },
        (count) => {
            return `Gain ${count} [/status/${status.replace(" ", "_")}] ${status} next round.`;
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, false
    );
}

function smokeStatusEffectSelf(status, amount, nextRound, smokeReq) {
    return new Effect(
        `Smoke - ${status}`,
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let req = smokeReq * count;
                if (ctx.target.getStatusCount("Smoke") >= req) {
                    await ctx.target.reduceStatus("Smoke", req);
                }
                
                data.applyInfliction(status.replace(" ", "_"), -(count * amount), nextRound);
            });
        },
        (count) => {
            return `Spend ${smokeReq * count} [/status/Smoke] to gain ${amount * count} [/status/${status.replace(" ", "_")}] ${status}${nextRound ? " next round." : "."}`;
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
    );
}

function smokeStatusEffect(status, amount, nextRound, smokeReq) {
    return new Effect(
        `Smoke - ${status}`,
        (context, count, trigger) => {
            context.triggers[trigger].modify.push(async (ctx, data) => {
                let req = smokeReq * count;
                if (ctx.target.getStatusCount("Smoke") >= req) {
                    await ctx.target.reduceStatus("Smoke", req);
                }

                data.applyInfliction(status.replace(" ", "_"), count * amount, nextRound);
            });
        },
        (count) => {
            return `Spend ${smokeReq * count} [/status/Smoke] to inflict ${amount * count} [/status/${status.replace(" ", "_")}] ${status}${nextRound ? " next round." : "."}`;
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
    );
}

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

function chargeAllyStatusEffect(status, cost, mult, nextRound) {
    let str = nextRound ? " next round" : "";
    return new Effect(
        `Charge - ${status}`,
        (context, count, trigger) => {
            context.costs.push({
                cost: cost * count,
                status: "Charge",
            })

            context.events[trigger].push(async (context) => {
                if (status == "[Type] Protection") {
                    let status = await pollUserInputOptions(ctx.actor, "Choose [Type] Protection to apply.", [
                        {
                            name: "Slash Protection",
                            icon: "/status/Slash_Protection.png"
                        },
                        {
                            name: "Pierce Protection",
                            icon: "/status/Pierce_Protection.png"
                        },
                        {
                            name: "Blunt Protection",
                            icon: "/status/Blunt_Protection.png"
                        },
                    ]);
                }

                let results = await pollDistributeStatus(context.actor, getActorTeam(context.actor), status, count * mult);
                let text = "";
                for (let res of results) {
                    let actor = findByID(res.id);
                    await actor.applyStatus(status.replace(" ", "_"), nextRound ? 0 : res.allocated, nextRound ? res.allocated : 0);
                    await context.actor.handleMarkAid(actor);
                    text = text + `${res.name} receives ${res.allocated} [/status/${status.replace(" ", "_")}] ${status}${nextRound ? " next round" : ""}!` + "\n";
                }

                createEffectsMessage(context.actor.name, text);
            });
        },
        (count) => {
            return `Distribute ${count * mult} [/status/${status.replace(" ", "_")}] ${status} ${nextRound ? "next round " : ""}amongst allies.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
    );
}

function allyStatusEffect(status, mult, nextRound) {
    let str = nextRound ? " next round" : "";
    return new Effect(
        `Give ${status}`,
        (context, count, trigger) => {
            context.events[trigger].push(async (context) => {
                if (status == "[Type] Protection") {
                    let status = await pollUserInputOptions(ctx.actor, "Choose [Type] Protection to apply.", [
                        {
                            name: "Slash Protection",
                            icon: "/status/Slash_Protection.png"
                        },
                        {
                            name: "Pierce Protection",
                            icon: "/status/Pierce_Protection.png"
                        },
                        {
                            name: "Blunt Protection",
                            icon: "/status/Blunt_Protection.png"
                        },
                    ]);
                }

                let results = await pollDistributeStatus(context.actor, getActorTeam(context.actor), status, count * mult);
                let text = "";
                for (let res of results) {
                    let actor = findByID(res.id);
                    await actor.applyStatus(status.replace(" ", "_"), nextRound ? 0 : res.allocated, nextRound ? res.allocated : 0);
                    await context.actor.handleMarkAid(actor);
                    text = text + `${res.name} receives ${res.allocated} [/status/${status.replace(" ", "_")}] ${status}${nextRound ? " next round" : ""}!` + "\n";
                }

                createEffectsMessage(context.actor.name, text);
            });
        },
        (count) => {
            return `Distribute ${count * mult} [/status/${status.replace(" ", "_")}] ${status} ${nextRound ? "next round " : ""}amongst allies.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
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

function skillVigorEffect(status, req, dupReq, multReq = 1) {
    return new Effect(
        `${status} Vigor`,
        (context, count, trigger) => {
            if (context.actor != null) {
                let stacks = context.actor.getStatusCount(status);
                req = context.actor.augmentEffectCount(`${status} Vigor`) > 0 ? req + dupReq + (count * multReq) : req;

                if (stacks >= req) {
                    context.dicePower = Number(context.dicePower) + count;
                    context.skillDicePower = Number(context.skillDicePower) + count;
                }
            }
        },
        (count) => {
            return `Gain ${count} Dice Power if the user has ${req + (count * multReq)} [/status/${status}] ${status}.`
        },
        ["On Use"],
        false,
        5
    );
}

function skillBonusEffect(status, req, max = 5, multReq = 1) {
    return new Effect(
        `${status} Bonus`,
        (context, count, trigger) => {
            if (context.target != null && context.target.getStatusCount(status) >= req + (count * multReq)) {
                context.dicePower = Number(context.dicePower) + count;
                context.skillDicePower = Number(context.skillDicePower) + count;
            }
        },
        (count) => {
            return `If the target has ${(req + (count * multReq)) > 1 ? (req + (count * multReq)) + " " : ""}[/status/${status}] ${status}, gain ${count} Dice Power`
        },
        ["On Use"],
        false,
        max
    );
}