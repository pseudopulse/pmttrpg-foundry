import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { Conditional, RollContext } from "../combat/rollContext.mjs";
import { pollUserInputOptions } from "../helpers/dialog.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";
import { getAlliesWithinRadius, getAlliesWithinRadiusOfTarget } from "../../pmttrpg.mjs";

export const weaponEffects = [
    // Dice Manipulation
    new Effect(
        "Dice Power Up",
        (context, count, trigger) => { context.dicePower = Number(context.dicePower) + Number(count); },
        null,
        ["Always Active"]
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
    // Status Effects
    simpleStatusEffect("Burn", false),
    simpleStatusEffect("Frostbite", false),
    simpleStatusEffect("Bleed", false),
    simpleStatusEffect("Rupture", true),
    simpleStatusEffect("Tremor", true),
    simpleStatusEffect("Sinking", true),
    simpleStatusEffect("Smoke", false),
    simpleStatusEffect("Paralysis", true),
    simpleStatusEffect("Fragile", true),
    simpleStatusEffect("Stagger Fragile", true),
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
            return `Apply ${Number(count)} [Type] Fragility, chosen on application.`
        },
        ["Clash Win", "Clash Lose"],
        false, 5, false, true
    ),
    simpleStatusEffect("Ruin", false),
    new Effect(
        `Gain Poise`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Poise", -count, false);
        },
        (count) => {
            return handleNegativeText(
                `Gain % [/status/Poise] Poise`,
                `Inflict % [/status/Poise] Poise`, 
            count);
        },
        ["Clash Win", "Clash Lose"],
    ),
    // Misc Effects
    new Effect(
        "Multi-hit",
        (context, count, trigger) => { 
            context.conditionals.push(new Conditional("Multi-Hit", `Lose 2 Dice Power. Replace attack with ${Number(count) + 1} attacks.`, (context) => {
                context.dicePower = Number(context.dicePower) - 2;
                context.diceCount = Math.min(Number(context.diceCount) + count, 3);
            }));
        },
        null,
        ["Always Active"],
        false,
        2
    ),
    // Melee Only
    new Effect(
        "Double-Edged",
        (context, count, trigger) => { 
            context.triggers["Clash Win"].applyInfliction("Bleed", 2, false);
            context.triggers["Clash Lose"].applyInfliction("Bleed", -2, false);
        },
        (count) => {
            return [null, "Inflict 2 [/status/Bleed] Bleed", "Gain 2 [/status/Bleed] Bleed", null, null];
        },
        ["Always Active"],
        false, 1, true
    ),
    new Effect(
        "Chilling",
        (context, count, trigger) => { 
            context.triggers["Clash Win"].applyInfliction("Frostbite", 2, false);
            context.triggers["Clash Lose"].applyInfliction("Frostbite", -2, false);
        },
        (count) => {
            return [null, "Inflict 2 [/status/Frostbite] Frostbite", "Gain 2 [/status/Frostbite] Frostbite", null, null];
        },
        ["Always Active"],
        false, 1, true
    ),
    new Effect(
        `Gain Haste`,
        (context, count, trigger) => {
            if (count < 0) {
                context.triggers[trigger].applyInfliction("Bind", count, true);
            }
            else {
                context.triggers[trigger].applyInfliction("Haste", -count, false);
            }
        },
        (count) => {
            return handleNegativeText(
                `Gain % [/status/Haste] Haste next round`,
                `Gain % [/status/Bind] Bind next round`, 
            count);
        },
        ["Clash Win", "Clash Lose"], true, 5
    ),
    new Effect(
        `Increase Range`,
        (context, count, trigger) => {
            context.range += 1;
        },
        null,
        ["Always Active"],
        false,
        1
    ),
    new Effect(
        `Extension Grip`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Extension Grip [C]", `Spend 4 Charge to increase range by 1 SQR.`, (context) => {
            }, [{ cost: 4, status: "Charge"}], "Extension Grip [O]"));

            context.conditionals.push(new Conditional("Extension Grip [O]", `Spend 1 Overcharge to increase range by 2 SQR.`, (context) => {
            }, [{ cost: 1, status: "Overcharge"}], "Extension Grip [C]"));
        },
        (count) => {
            return [null, null, null, "May spend 4 [/status/Charge] Charge to increase range by 1 SQR, or 1 [/status/Overcharge] Overcharge to increase by 2 SQR.", null];
        },
        ["Always Active"],
        false,
        1,
        true
    ),
    new Effect(
        `Extra DMG Type`,
        (context, count, trigger) => {
            
        },
        null,
        ["Always Active"],
        false,
        2
    ),
    new Effect(
        `Inflict Bind`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Bind", count, true);
        },
        (count) => {
            return `Inflict ${Number(count)} [/status/Bind] Bind next round.`
        },
        ["Clash Win", "Clash Lose"],
        false
    ),
    new Effect(
        `Retracting Cable`,
        (context, count, trigger) => {
            
        },
        null,
        ["Always Active"],
        false,
        1
    ),
    markerEffect("Throwing Weapon", false, 1),
    // Ranged Effects
    new Effect(
        `Extra Range`,
        (context, count, trigger) => {
            
        },
        null,
        ["Always Active"],
        true,
        5
    ),
    // Charge Effects
    new Effect(
        `Gain Charge`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction("Charge", -count, false);
        },
        (count) => {
            return `Gain ${Math.abs(count)} [/status/Charge] Charge`;
        },
        ["On Use"],
        false,
        6
    ),
    new Effect(
        `Power Engine`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Power Engine [C]", `Spend 8 Charge to gain 1 Dice Power.`, (context) => {
                context.dicePower = Number(context.dicePower) + 1;
            }, [{ cost: 8, status: "Charge"}], "Power Engine [O]"));

            context.conditionals.push(new Conditional("Power Engine [O]", `Spend 1 Overcharge to gain 2 Dice Power`, (context) => {
                context.dicePower = Number(context.dicePower) + 2;
            }, [{ cost: 1, status: "Overcharge"}], "Power Engine [C]"));
        },
        (count) => {
            return [null, null, null, "May spend 8 [/status/Charge] Charge to gain 1 Dice Power, or 1 [/status/Overcharge] Overcharge to gain 2 Dice Power.", null];
        },
        ["Always Active"],
        false,
        1, true
    ),
    new Effect(
        `Barrier Ionization`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Barrier Ionization [C]", `Spend 3 Charge to gain 1 Charge Barrier.`, (context) => {
                context.triggers[trigger].applyInfliction("Charge_Barrier", -1, false);
            }, [{ cost: 3, status: "Charge"}], "Barrier Ionization [O]"));

            context.conditionals.push(new Conditional("Barrier Ionization [O]", `Spend 1 Overcharge to gain 3 Charge Barrier`, (context) => {
                context.triggers[trigger].applyInfliction("Charge_Barrier", -3, false);
            }, [{ cost: 1, status: "Overcharge"}], "Barrier Ionization [C]"));
        },
        (count) => {
            return "May spend 3 [/status/Charge] Charge to gain 1 [/status/Charge_Barrier] Charge Barrier or 1 [/status/Overcharge] Overcharge to gain 3 [/status/Charge_Barrier] Charge Barrier.";
        },
        ["Clash Win", "Clash Lose"],
        false,
        1
    ),
    new Effect(
        `Refractor`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Refractor [C]", `Spend 4 Charge to inflict +1 of all [Status]+ compatible effects.`, (context) => {
                context.flags.push("Refractor-C");
            }, [{ cost: 4, status: "Charge"}], "Refractor [O]"));

            context.conditionals.push(new Conditional("Refractor [O]", `Spend 1 Overcharge to inflict +3 of all [Status]+ compatible effects.`, (context) => {
                context.flags.push("Refractor-O");
            }, [{ cost: 1, status: "Overcharge"}], "Refractor [C]"));
        },
        (count) => {
            return "May spend 4 [/status/Charge] Charge to inflict +1 of all [Status]+ compatible effects, or 1 [/status/Overcharge] Overcharge to inflict +3.";
        },
        ["On Use"],
        false,
        1
    ),
    new Effect(
        `Galvanic Pulse`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Galvanic Pulse [C]", `Spend 10 Charge to inflict 1 Feeble or 1 Disarm.`, async (context) => {
                let status = await pollUserInputOptions(context.actor, "Choose Galvanic Pulse status effect!", [
                    {
                        name: "Feeble",
                        icon: "/status/Feeble.png"
                    },
                    {
                        name: "Disarm",
                        icon: "/status/Disarm.png"
                    }
                ]);
                context.triggers[trigger].applyInfliction(status, 1, false);
            }, [{ cost: 10, status: "Charge"}], "Galvanic Pulse [O]"));

            context.conditionals.push(new Conditional("Galvanic Pulse [O]", `Spend 1 Overcharge to inflict 1 Feeble and 1 Disarm.`, (context) => {
                context.triggers[trigger].applyInfliction("Feeble", 1, false);
                context.triggers[trigger].applyInfliction("Disarm", 1, false);
            }, [{ cost: 1, status: "Overcharge"}], "Galvanic Pulse [C]"));
        },
        (count) => {
            return "May spend 10 [/status/Charge] Charge to inflict 1 [/status/Feeble] Feeble or 1 [/status/Disarm] Disarm immediately, or 1 [/status/Overcharge] Overcharge to apply both.";
        },
        ["Clash Win", "Clash Lose"],
        false,
        1
    ),
    new Effect(
        `Countercurrent`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Countercurrent [C]", `Spend 4 Charge to inflict 1 Paralysis.`, (context) => {
                context.triggers[trigger].applyInfliction("Paralysis", 1, false);
            }, [{ cost: 4, status: "Charge"}], "Countercurrent [O]"));

            context.conditionals.push(new Conditional("Countercurrent [O]", `Spend 1 Overcharge to inflict 2 Paralysis.`, (context) => {
                context.triggers[trigger].applyInfliction("Paralysis", 2, false);
            }, [{ cost: 1, status: "Overcharge"}], "Countercurrent [C]"));
        },
        (count) => {
            return "May spend 4 [/status/Charge] Charge to inflict 1 [/status/Paralysis] Paralysis immediately, or 1 [/status/Overcharge] Overcharge to inflict 2.";
        },
        ["Clash Win", "Clash Lose"],
        false,
        1
    ),
    new Effect(
        `Magnetic Drive`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Magnetic Drive [C]", `Spend 6 Charge to push the target 1 SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pushed 1 SQR away from ${context.actor.name} by Magnetic Drive!`);
                });
            }, [{ cost: 6, status: "Charge"}], "Magnetic Drive [O]"));

            context.conditionals.push(new Conditional("Magnetic Drive [O]", `Spend 1 Overcharge to push the target 2 SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pushed 2 SQR away from ${context.actor.name} by Magnetic Drive!`);
                });
            }, [{ cost: 1, status: "Overcharge"}], "Magnetic Drive [C]"));
        },
        (count) => {
            return "May spend 6 [/status/Charge] Charge to push the target 1 SQR, or 1 [/status/Overcharge] Overcharge to push them 2.";
        },
        ["Clash Win"],
        false,
        1, false, true
    ),
    markerEffect("Charge Ammo", false, 1),
    new Effect(
        `Loaded Magnet`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Loaded Magnet [C]", `Spend 6 Charge to pull the target ${Number(count)} SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pulled ${count} SQR towards ${context.actor.name} by Loaded Magnet!`);
                });
            }, [{ cost: count * 3, status: "Charge"}], "Loaded Magnet [O]"));

            context.conditionals.push(new Conditional("Loaded Magnet [O]", `Spend 1 Overcharge to pull the target ${Number(count) * 3} SQR.`, (context) => {
                context.triggers[trigger].modify.push((ctx, data) => {
                    createEffectsMessage(context.target.name, `[/status/Aggro] Is pulled ${count * 3} SQR towards ${context.actor.name} by Loaded Magnet!`);
                });
            }, [{ cost: count, status: "Overcharge"}], "Loaded Magnet [C]"));
        },
        (count) => {
            return `May spend ${3 * count} [/status/Charge] Charge to pull the target ${Number(count)} SQR, or ${Number(count)} [/status/Overcharge] Overcharge to pull them ${Number(count) * 3}.`;
        },
        ["On Use"],
        false,
        5, false, true
    ),
    //
    new Effect(
        `Shattershield`,
        (context, count, trigger) => {},
        (count) => {
            return `Inflict 1 [Type] Fragile corresponding to the attack type if the target used a Defensive die.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Backburner`,
        (context, count, trigger) => {
            context.triggers["Clash Win"].modify.push((ctx, data) => {
                let allies = getAlliesWithinRadiusOfTarget(context.actor, context.target, 1);

                if (allies.length > 0) {
                    data.applyInfliction("Burn", 2, false);
                }
            });
        },
        (count) => {
            return `Inflict 2 [/status/Burn] Burn if an ally is adjacent to the target.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        `Backstabber`,
        (context, count, trigger) => {},
        (count) => {
            return `Inflict 3 [/status/Bleed] Bleed if this attack went unopposed.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Duelist Sidearm`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Duelist Sidearm", `Gain 3 Poise if dual wielding.`, (context) => {
                context.triggers["Clash Win"].modify.push((ctx, data) => {
                    data.applyInfliction("Poise", -3, false);
                });
            }, [], null));
        },
        (count) => {
            return `Gain 3 [/status/Poise] Poise if this attack was due to dual wielding.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        `Fencer's Implement`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Fencer's Implement", `Gain 2 Poise if not dual wielding.`, (context) => {
                context.triggers["Clash Win"].modify.push((ctx, data) => {
                    data.applyInfliction("Poise", -2, false);
                });
            }, [], null));
        },
        (count) => {
            return `Gain 2 [/status/Poise] Poise if this attack was not due to dual wielding.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        `Friction Charger`,
        (context, count, trigger) => {
            if (context.target && context.target.getStatusCount("Burn") > 0) {
                context.triggers["Clash Win"].applyInfliction("Charge", -2, false);
            }
        },
        (count) => {
            return `Gain 2 [/status/Charge] Charge if the target has [/status/Burn] Burn.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Friction Charger`,
        (context, count, trigger) => {
            if (context.target && context.target.getStatusCount("Burn") > 0) {
                context.triggers["Clash Win"].applyInfliction("Charge", -2, false);
            }
        },
        (count) => {
            return `Gain 2 [/status/Charge] Charge if the target has [/status/Burn] Burn.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Frozen Blade`,
        (context, count, trigger) => {
            if (context.actor.getStatusCount("Frostbite") >= 4) {
                context.triggers["Clash Win"].stHeal -= 4;
            }
        },
        (count) => {
            return `Deal 4 ST damage if the user has 4+ [/status/Frostbite] Frostbite.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Hooked Barbs`,
        (context, count, trigger) => {},
        (count) => {
            return `Inflict 4 [/status/Rupture] Rupture and 2 [/status/Tremor] Tremor if this attack went unopposed.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Nerve Tap`,
        (context, count, trigger) => {
            context.triggers["Devastating Hit"].applyInfliction("Critical", 1, false);
        },
        (count) => {
            return `Gain 1 [/status/Critical] Critical.`;
        },
        ["Devastating Hit"],
        false, 1, false, false
    ),
    new Effect(
        `Panic Guard`,
        (context, count, trigger) => {},
        (count) => {
            return `May spend a use to gain 2 [/status/Protection] Protection and [/status/Stagger_Protection] Stagger Protection immediately.`;
        },
        ["Clash Lose"],
        false, 1, false, false
    ),
    new Effect(
        `Spasmic Loader`,
        (context, count, trigger) => {
            context.triggers["Clash Win"].modify.push((ctx, data) => {
                if (ctx.actor.isMarkedTarget(ctx.target)) {
                    data.applyInfliction("Tremor", 2, true);
                    data.applyInfliction("Rupture", 2, true);
                }
            });
        },
        (count) => {
            return `Inflict 2 [/status/Rupture] Rupture and [/status/Tremor] Tremor next round if the target is Marked.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        `Bear Trap`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Bear Trap", `Inflict 1 Bind and 3 Bleed on opportunity attack.`, (context) => {
                context.triggers["Clash Win"].modify.push((ctx, data) => {
                    data.applyInfliction("Bind", 1, false);
                    data.applyInfliction("Bleed", 2, false);
                });
            }, [], null));
        },
        (count) => {
            return `Inflict 1 [/status/Bind] Bind and 2 [/status/Bleed] Bleed if this is an Opportunity Attack.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        `Electrified Barrel`,
        (context, count, trigger) => {
            context.triggers["Tremor Burst"].applyInfliction("Paralysis", 1, true);
            context.triggers["Rupture Burst"].applyInfliction("Paralysis", 1, true);
        },
        (count) => {
            return `Inflict 1 [/status/Paralysis] Paralysis next round if [/status/Rupture] Rupture or [/status/Tremor] Tremor were bursted.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Rib Breaker`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Rib Breaker", `Inflict 4 Bleed if Force Damage is inflicted.`, (context) => {
                context.triggers["Clash Win"].modify.push((ctx, data) => {
                    data.applyInfliction("Bleed", 4, false);
                });
            }, [], null));
        },
        (count) => {
            return `Inflict 4 [/status/Bleed] Bleed if the attack causes Force Damage.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        `Snagging Thorns`,
        (context, count, trigger) => {},
        (count) => {
            return `May apply Rupture Pause if a reaction converted this to a Block.`;
        },
        ["Clash Lose"],
        false, 1, false, false
    ),
    new Effect(
        `Superpositioner`,
        (context, count, trigger) => {
            context.triggers["Tremor Burst"].applyInfliction("Rupture", 2, true);
            context.triggers["Rupture Burst"].applyInfliction("Tremor", 2, true);
        },
        (count) => {
            return `On [/status/Rupture] Rupture or [/status/Tremor] Tremor burst, apply 2 of the opposite status next round.`;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Ground Rumbler`,
        (context, count, trigger) => {},
        (count) => {
            return null;
        },
        ["Clash Win"],
        false, 1, false, false
    ),
    new Effect(
        `Hooked Lining`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Hooked Lining", `Convert 3 Bleed on target into 1 Hemorrhage.`, (context) => {
                context.triggers["Clash Win"].modify.push(async (ctx, data) => {
                    if (ctx.target.getStatusCount("Bleed") >= 3) {
                        data.applyInfliction("Hemorrhage", 1, false);
                        await ctx.target.reduceStatus("Bleed", 3);
                    }
                });
            }, [], null));
        },
        (count) => {
            return `Convert 3 [/status/Bleed] Bleed on target into 1 [/status/Hemorrhage] Hemorrhage.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        `Laser Pointer`,
        (context, count, trigger) => {},
        (count) => {
            return `Reduce the [/status/Critical] Critical die to a d8.`;
        },
        ["On Use"],
        false, 1, false, false
    ),
    new Effect(
        `Singular Strike`,
        (context, count, trigger) => {
            context.events["Critical Hit"].push(async (context) => {
                let poise = context.poise - 10;
                if (poise > 0) {
                    let damage = Math.min(poise * 2, 20);
                    let dummyCtx = new RollContext();
                    dummyCtx.damageType = "Slash";
                    dummyCtx.actor = context.actor;
                    dummyCtx.target = context.target;
                    let text = await context.target.takeDamage(damage, dummyCtx, 0, 0, 0, true, null, "[Singular Strike of the Blade]");
                    createEffectsMessage(context.target.name, text);
                }
            })
        },
        (count) => {
            return `Deal [/damageTypes/Slash] Slash damage equal to ([/status/Poise] Poise - 10) * 2, max 20.`;
        },
        ["On Crit"],
        false, 1, false, true
    ),
    //
    markerEffect("Ballistic", false, 1),
    new Effect(
        `Charged Blade`,
        (context, count, trigger) => {
        },
        (count) => {
            return `Consume ${1 + Number(count)} [/status/Charge] Charge to use this weapon.`;
        },
        ["On Use"],
        false, 5, false, false
    ),
    new Effect(
        `Blood-Tinged Blade`,
        (context, count, trigger) => {
            context.conditionals.push(new Conditional("Blood-Tinged Blade", `Consume 10 Bloodfeast to repeat attack.`, (context) => {
                context.events["Clash Win"].push(async (context) => {
                    createEffectsMessage(context.actor.name, `Spends 10 [/status/Bloodfeast] Bloodfeast to trigger Blood-Tinged Blade!`);
                })
            }, [
                {
                    status: "Bloodfeast",
                    cost: 10
                }
            ], null));
        },
        (count) => {
            return `May spend 10 [/status/Bloodfeast] Bloodfeast to attack another target with this weapon. This extra attack may not use skills.`;
        },
        ["Clash Win"],
        false, 1, false, true
    ),
    new Effect(
        "Bloodied Amplifier",
        (context, count, trigger) => { 
            let consumed = Math.min(Math.floor(context.actor.getSpentBloodfeast() / 20), 3);
            if (consumed > 0) {
                context.dicePower = Number(context.dicePower) + Number(consumed); 
            }
        },
        (count) => {
            return `Gain 1 Dice Power for every 20 [/status/Consumed_Bloodfeast] Consumed Bloodfeast, up to ${count}.`;
        },
        ["On Use"]
    ),
    new Effect(
        "Combat Medic",
        (context, count, trigger) => { 
            context.triggers[trigger].applyInfliction("Heal_Efficiency", -2, false);
        },
        (count) => {
            return `Gain 2 [/status/Heal_Efficiency] Heal Efficiency.`;
        },
        ["Clash Win", "Clash Lose"], false, 1
    ),
    simpleStatusEffect("Poison", false, true),
]

function simpleStatusEffect(status, nextRound, allowNegative) {
    let str = nextRound ? " next round" : "";
    return new Effect(
        `Inflict ${status}`,
        (context, count, trigger) => {
            context.triggers[trigger].applyInfliction(status, count, nextRound);
        },
        (count) => {
            return handleNegativeText(
                `Inflict % [/status/${status.replace(" ", "_")}] ${status}` + str, 
                `Gain % [/status/${status.replace(" ", "_")}] ${status}` + str, 
            count);
        },
        ["Clash Win", "Clash Lose"],
        allowNegative, status == "Rupture" ? 6 : 5
    );
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