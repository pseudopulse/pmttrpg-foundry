// import { Roll } from "@client/dice/_module.mjs";
// import { Token } from "@client/config.mjs";
// import { ChatMessage } from "@client/config.mjs";
import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashMessage } from "../core/helpers/clash.mjs";
import { createAlertBox, getActionModifiers } from "../core/helpers/dialog.mjs";
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

    async roll(initiator = true, defType = "Block") {
        switch (this.type) {
            case "weapon":
                await this.handleUsageWeapon(initiator);
                break;
            case "outfit":
                await this.handleUsageOutfit(defType);
                break;
            default:
                break;
        }
    }

    async handleUsageOutfit(defType) {
        const item = this;

        console.log("handling outfit usage as " + this.actor.name);

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        const rollMode = game.settings.get('core', 'rollMode');

        if (game.user.targets.first() == null) {
            createAlertBox("You must designate a target before defending!");
            return
        }

        const context = defType == "Block" ? await this.getRollContextBlo(game.user.targets.first().actor, true) : await this.getRollContextEvd(game.user.targets.first().actor, true);

        const label = `[${item.type}] ${item.name} targeting ${game.user.targets.first().actor.name}`;

        const roll = new Roll(`1d${context.diceMax}+${context.dicePower}`, "");
        const result = await roll.evaluate();
        context.result = result.total;
        context.applyClashEffects = true;
        
        createClashMessage(this.actor, context);
        this.actor.queueRoll(context);
    }

    async handleUsageWeapon(initiator) {
        const item = this;

        console.log("handling weapon usage as " + this.actor.name);

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
        const result = await roll.evaluate();
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
        
        this.actor.queueRoll(context);

        createClashMessage(this.actor, context);
    }

    async getRollContext(target = null, rollSkill = false) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        if (rollSkill) {
            rollContext.modifiers = await getActionModifiers(this.actor, rollContext);
        }
        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        rollContext.damageType = systemData.damageType;
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.type = systemData.type;
        rollContext.processEffects();
        return rollContext;
    }

    async getRollContextBlo(target = null, rollSkill = false) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        if (rollSkill) {
            rollContext.modifiers = await getActionModifiers(this.actor, rollContext);
        }
        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        rollContext.damageType = "Block";
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.type = systemData.type;
        rollContext.processEffects();
        return rollContext;
    }

    async getRollContextEvd(target = null, rollSkill = false) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        if (rollSkill) {
            rollContext.modifiers = await getActionModifiers(this.actor, rollContext);
        }
        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        rollContext.damageType = "Evade";
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.type = systemData.type;
        rollContext.processEffects();
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