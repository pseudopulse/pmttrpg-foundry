// import { Roll } from "@client/dice/_module.mjs";
// import { Token } from "@client/config.mjs";
// import { ChatMessage } from "@client/config.mjs";
import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashMessage } from "../core/helpers/clash.mjs";
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
                await this.handleUsageWeapon(initiator, enemyCtx);
                break;
            case "outfit":
                await this.handleUsageOutfit(defType, enemyCtx);
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
            return
        }

        const context = defType == "Block" ? await this.getRollContextBlo(game.user.targets.first().actor, true) : await this.getRollContextEvd(game.user.targets.first().actor, true);

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
                await this.actor.reduceStatus("Paralysis", 1);
                result = result.total > reroll.total ? reroll : result;
            }
        }

        context.result = result.total;
        context.applyClashEffects = true;

        createClashMessage(this.actor, context);
        await this.actor.queueRoll(context);

        await this.actor.assignRecycleableAction(context, defType, item);
    }

    async handleUsageWeapon(initiator, enemyCtx = null) {
        const item = this;

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        const rollMode = game.settings.get('core', 'rollMode');

        if (game.user.targets.first() == null) {
            createAlertBox("You must designate a target before attacking!");
            return
        }

        if (game.user.targets.first().actor == this.actor) {
            createAlertBox("You can't attack yourself!");
        }

        const context = await this.getRollContext(game.user.targets.first().actor, true);

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
                await this.actor.reduceStatus("Paralysis", 1);
                result = result.total > reroll.total ? reroll : result;
            }
        }

        context.result = result.total;
        context.applyClashEffects = true;

        if (initiator) {
            sendNetworkMessage("PENDING_CLASH", {
                attacker: this.actor,
                target: game.user.targets.first().actor,
                context: context,
            })

            await this.actor.spendAction();
        }

        await this.actor.queueRoll(context);

        await this.actor.assignRecycleableAction(context, "Attack", item);

        createClashMessage(this.actor, context);
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

        if (rollSkill) {
            const tmpCtx = new RollContext();
            Object.assign(tmpCtx, JSON.parse(JSON.stringify(rollContext)));
            tmpCtx.fix();
            tmpCtx.addEffectsList(systemData.effects, fixTypeName(this.type));
            await tmpCtx.processEffects();
            rollContext.modifiers = await getActionModifiers(this.actor, tmpCtx);
        }

        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        await rollContext.processEffects();

        if (rollContext.hasEffect("Extra DMG Type") || (rollContext.attackType == "Ranged" && !rollContext.hasEffect("Charge Ammo"))) {
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
        rollContext.type = systemData.type;

        if (rollSkill) {
            const tmpCtx = new RollContext();
            Object.assign(tmpCtx, JSON.parse(JSON.stringify(rollContext)));
            tmpCtx.fix();
            tmpCtx.addEffectsList(systemData.effects, fixTypeName(this.type));
            await tmpCtx.processEffects();
            rollContext.modifiers = await getActionModifiers(this.actor, tmpCtx);
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
        rollContext.type = systemData.type;

        if (rollSkill) {
            const tmpCtx = new RollContext();
            Object.assign(tmpCtx, JSON.parse(JSON.stringify(rollContext)));
            tmpCtx.fix();
            tmpCtx.addEffectsList(systemData.effects, fixTypeName(this.type));
            await tmpCtx.processEffects();
            rollContext.modifiers = await getActionModifiers(this.actor, tmpCtx);
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
    rollContext.name = item.name;
    rollContext.attackType = systemData.type;
    rollContext.processEffects();
    return rollContext;
}