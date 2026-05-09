// import { Roll } from "@client/dice/_module.mjs";
// import { Token } from "@client/config.mjs";
// import { ChatMessage } from "@client/config.mjs";
import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashMessage, createEffectsMessage } from "../core/helpers/clash.mjs";
import { createAlertBox, getActionModifiers, pollUserInputOptions } from "../core/helpers/dialog.mjs";
import { sendNetworkMessage } from "../core/helpers/netmsg.mjs";
import { Triggers } from "../core/status/statusEffect.mjs";
import { findItemOwner } from "../pmttrpg.mjs";

//
export class PTItem extends Item {
    static get defaultType() {
        return "weapon";
    }

    prepareDerivedData() {
        super.prepareDerivedData();
        const itemData = this;
        const systemData = itemData.system;
    }

    async roll(initiator = true, defType = "Block", enemyCtx = null) {
        switch (this.type) {
            case "weapon":
                return await this.handleUsageWeapon(initiator, enemyCtx);
                break;
            case "outfit":
                return await this.handleUsageOutfit(defType, enemyCtx);
                break;
            default:
                break;
        }
    }

    async handleUsageOutfit(defType, enemyCtx = null) {
        const item = this;

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        const rollMode = game.settings.get('core', 'rollMode');

        if (game.user.targets.first() == null) {
            createAlertBox("You must designate a target before defending!");
            return false;
        }

        const context = defType == "Block" ? await this.getRollContextBlo(game.user.targets.first().actor, true) : await this.getRollContextEvd(game.user.targets.first().actor, true);

        if (context == null) {
            await this.actor.handlePendingClash(enemyCtx);
            return false;
        }

        const label = `[${item.type}] ${item.name} targeting ${game.user.targets.first().actor.name}`;

        const roll = new Roll(`1d${context.diceMax}+${context.dicePower}`, "");
        let result = await roll.evaluate();

        if (enemyCtx != null) {
            context.forcedAdvState += enemyCtx.enemyAdvState;
            context.modifierText = enemyCtx.enemyModifierText;
        }

        context.isReaction = true;
        // await this.actor.spendReaction(true, false);

        if (context.forcedAdvState != 0 || this.actor.getStatusCount("Paralysis") > 0) {
            const reroll = await new Roll(`1d${context.diceMax}+${context.dicePower}`, "").evaluate();

            if (context.forcedAdvState > 0) {
                result = result.total > reroll.total ? result : reroll;
            }
            else if (context.forcedAdvState < 0) {
                result = result.total > reroll.total ? reroll : result;
            }
            else {
                if (this.actor.augmentEffectCount("Energy Intake") > 0) {
                    await this.actor.applyStatus("Charge", 4);
                    createEffectsMessage(this.actor.name, `Gains 4 [/status/Charge] Charge from Energy Intake!`);
                }
                
                await this.actor.reduceStatus("Paralysis", 1);
                result = result.total > reroll.total ? reroll : result;
            }
        }

        context.result = result.total;
        context.applyClashEffects = true;

        createClashMessage(this.actor, context);
        await this.actor.queueRoll(context);

        await this.actor.assignRecycleableAction(context, defType, item);

        return true;
    }

    async handleUsageWeapon(initiator, enemyCtx = null) {
        const item = this;

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        const rollMode = game.settings.get('core', 'rollMode');

        if (game.user.targets.first() == null) {
            createAlertBox("You must designate a target before attacking!");
            return false;
        }

        if (game.user.targets.first().actor == this.actor) {
            createAlertBox("You can't attack yourself!");
            return false;
        }

        const context = await this.getRollContext(game.user.targets.first().actor, true);

        if (context == null) {
            if (initiator) {
                return false;
            }
            else {
                return false;
            }
        }

        const label = `[${item.type}] ${item.name} targeting ${game.user.targets.first().actor.name}`;

        const roll = new Roll(`1d${context.diceMax}+${context.dicePower}`, "");
        let result = await roll.evaluate();

        if (enemyCtx != null) {
            context.forcedAdvState += enemyCtx.enemyAdvState;
            context.modifierText = enemyCtx.enemyModifierText;
        }

        if (context.forcedAdvState != 0 || this.actor.getStatusCount("Paralysis") > 0) {
            const reroll = await new Roll(`1d${context.diceMax}+${context.dicePower}`, "").evaluate();

            if (context.forcedAdvState > 0) {
                result = result.total > reroll.total ? result : reroll;
            }
            else if (context.forcedAdvState < 0) {
                result = result.total > reroll.total ? reroll : result;
            }
            else {
                if (this.actor.augmentEffectCount("Energy Intake") > 0) {
                    await this.actor.applyStatus("Charge", 4);
                    createEffectsMessage(this.actor.name, `Gains 4 [/status/Charge] Charge from Energy Intake!`);
                }

                await this.actor.reduceStatus("Paralysis", 1);
                result = result.total > reroll.total ? reroll : result;
            }
        }

        context.result = result.total;
        context.applyClashEffects = true;

        if (context.hasEffect("Overheat")) {
            await this.actor.overheatWeapon(this);
        }

        if (initiator) {
            sendNetworkMessage("PENDING_CLASH", {
                attacker: this.actor.system.id,
                target: game.user.targets.first().actor.system.id,
                context: context,
            })

            // await this.actor.spendAction();
        }
        else {
            context.isReaction = true;
            // await this.actor.spendReaction(true, false);
        }

        await this.actor.queueRoll(context);

        await this.actor.assignRecycleableAction(context, "Attack", item);

        createClashMessage(this.actor, context);

        return true;
    }

    async getRollContext(target = null, rollSkill = false) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        rollContext.damageType = systemData.damageType;
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.type = systemData.attackType;
        rollContext.attackType = systemData.attackType;
        rollContext.form = systemData.form;
        rollContext.hand = systemData.hand;

        if (rollContext.form == "Hybrid") {
            rollContext.attackType = await pollUserInputOptions(this.actor, "Select attack type for hybrid weapon.", [{ name: "Melee" }, { name: "Ranged" }], 0);
            rollContext.type = rollContext.attackType;
        }

        if (rollSkill) {
            const tmpCtx = new RollContext();
            Object.assign(tmpCtx, JSON.parse(JSON.stringify(rollContext)));
            tmpCtx.fix();
            tmpCtx.addEffectsList(systemData.effects, fixTypeName(this.type));
            await tmpCtx.processEffects();
            rollContext.modifiers = await getActionModifiers(this.actor, tmpCtx);
            if (rollContext.modifiers == null) {
                return null;
            }
            
            if (rollContext.modifiers.item != null) {
                await this.actor.deductLight(rollContext.modifiers.item.system.light);
            }
        }

        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        await rollContext.processEffects();

        if (rollContext.hasEffect("Extra DMG Type") || rollContext.hasEffect("Versatility") || (rollContext.attackType == "Ranged" && !rollContext.hasEffect("Charge Ammo"))) {
            rollContext.damageType = await pollUserInputOptions(game.user, "Select Damage Type", [
                {
                    name: "Slash",
                    icon: "/damageTypes/Slash.png"
                },
                {
                    name: "Pierce",
                    icon: "/damageTypes/Pierce.png"
                },
                {
                    name: "Blunt",
                    icon: "/damageTypes/Blunt.png"
                },
            ], ["Slash", "Pierce", "Blunt"].indexOf(rollContext.damageType));
        }

        if ((rollContext.attackType == "Ranged" || rollContext.hasEffect("Ballistic") || rollContext.hasEffect("Loaded Salvo")) && (!rollContext.hasEffect("Charge Ammo") || (this.actor.augmentEffectCount("Ammo Infusion") > 0 || this.actor.augmentEffectCount("Ammo Infusion Alt")))) {
            if (rollContext.hasEffect("Charge Ammo")) {
                let cost = 2;
                if (((this.actor.augmentEffectCount("Ammo Infusion") > 0 && this.actor.getStatusCount("Charge") >= 6) || (this.actor.augmentEffectCount("Ammo Infusion Alt") && this.actor.getStatusCount("Charge") >= 4))) {
                    let bullet = await rollContext.loadBullet();
                    if (bullet != "Standard") {
                        if (this.actor.augmentEffectCount("Ammo Infusion") > 0) {
                            cost = 6;
                        }
                        else {
                            cost = 4;
                        }
                    }
                }

                await this.actor.reduceStatus("Charge", cost);
                createEffectsMessage(this.actor.name, `Spends ${cost} [/status/Charge] Charge to create ammo!`);
            }
            else {
                await rollContext.loadBullet();
            }
        }

        if (rollContext.hasEffect("Charged Blade")) {
            let count = 1 + Number(rollContext.effects.find(x => x.name == "Charged Blade").count);
            await this.actor.reduceStatus("Charge", count);
            createEffectsMessage(this.actor.name, `Spends ${count} [/status/Charge] Charge to wield their weapon!`);
        }

        return rollContext;
    }

    async getRollContextBlo(target = null, rollSkill = false) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        rollContext.damageType = systemData.damageType;
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.damageType = "Block";
        rollContext.type = "Block";
        rollContext.form = systemData.form;
        rollContext.hand = systemData.hand;

        if (rollSkill) {
            const tmpCtx = new RollContext();
            Object.assign(tmpCtx, JSON.parse(JSON.stringify(rollContext)));
            tmpCtx.fix();
            tmpCtx.addEffectsList(systemData.effects, fixTypeName(this.type));
            await tmpCtx.processEffects();
            rollContext.modifiers = await getActionModifiers(this.actor, tmpCtx);
            if (rollContext.modifiers == null) {
                return null;
            }

            if (rollContext.modifiers.item != null) {
                await this.actor.deductLight(rollContext.modifiers.item.system.light);
            }
        }

        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        await rollContext.processEffects();
        return rollContext;
    }

    async getRollContextEvd(target = null, rollSkill = false) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        rollContext.damageType = systemData.damageType;
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.damageType = "Evade";
        rollContext.type = "Evade";
        rollContext.form = systemData.form;
        rollContext.hand = systemData.hand;

        if (rollSkill) {
            const tmpCtx = new RollContext();
            Object.assign(tmpCtx, JSON.parse(JSON.stringify(rollContext)));
            tmpCtx.fix();
            tmpCtx.addEffectsList(systemData.effects, fixTypeName(this.type));
            await tmpCtx.processEffects();
            rollContext.modifiers = await getActionModifiers(this.actor, tmpCtx);
            if (rollContext.modifiers == null) {
                return null;
            }

            if (rollContext.modifiers.item != null) {
                await this.actor.deductLight(rollContext.modifiers.item.system.light);
            }
        }

        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        await rollContext.processEffects();
        return rollContext;
    }
}

function fixTypeName(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

export function getRollContextFromData(item, def = false, defType = "Block") {
    if (item.type == null) {
        item = item.item;
    }

    const itemData = item;
    const systemData = itemData.system;
    const rollContext = new RollContext();
    rollContext.addEffectsList(systemData.effects, fixTypeName(item.type));
    rollContext.actor = findItemOwner(item);
    rollContext.damageType = def ? defType : systemData.damageType;
    rollContext.type = def ? defType : systemData.type;
    rollContext.name = item.name;
    rollContext.attackType = systemData.type;
    rollContext.form = systemData.form;
    rollContext.hand = systemData.hand;

    rollContext.processEffectsSync();

    rollContext.mergeCosts();
    return rollContext;
}

export async function getRollContextFromDataFull(item, def = false, defType = "Block") {
    if (item.type == null) {
        item = item.item;
    }

    const itemData = item;
    const systemData = itemData.system;
    const rollContext = new RollContext();
    rollContext.addEffectsList(systemData.effects, fixTypeName(item.type));
    rollContext.actor = findItemOwner(item);
    rollContext.damageType = def ? defType : systemData.damageType;
    rollContext.type = def ? defType : systemData.type;
    rollContext.name = item.name;
    rollContext.attackType = systemData.type;
    rollContext.form = systemData.form;
    rollContext.hand = systemData.hand;

    await rollContext.processEffects();

    rollContext.mergeCosts();
    return rollContext;
}