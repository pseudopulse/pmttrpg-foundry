import { Effect } from "./effect.mjs";
import { handleNegativeText } from "../../core/effects/effectHelpers.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";
import { pollUserInputOptions } from "../helpers/dialog.mjs";

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
            context.events.push(trigger, async (context) => {
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
            context.events.push(trigger, async (context) => {
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
            context.events.push(trigger, async (context) => {
                let burn = context.target.getStatusCount("Burn");

                if (burn > 0) {
                    applyInAoe(context.target, count, async (actor) => {
                        if (actor == context.target) {
                            return;
                        }
                        
                        await actor.takeDamageStatus(burn, "Burn", "HP", `[/status/Burn] Burns for %DMG% HP damage from Fireball! (%PHP% -> %HP%)`);
                    });
                    
                    await context.target.fireStatusEffect("Burn");
                }
            });
        },
        (count) => {
            return `Trigger [/status/Burn] Burn on target and deal damage equal to [/status/Burn] Burn to all characters within ${count} SQR of the target.`;
        },
        ["Clash Win"],
        false,
        1, false, true
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

function simpleStatusEffect(status, nextRound, allowNegative) {
    let str = nextRound ? " next round" : "";
    return new Effect(
        `Inflict ${status}`,
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
            return `Inflict ${count} [/status/${status.replace(" ", _)}] ${status}.`
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