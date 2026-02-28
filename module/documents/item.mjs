// import { Roll } from "@client/dice/_module.mjs";
// import { Token } from "@client/config.mjs";
// import { ChatMessage } from "@client/config.mjs";
import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashMessage } from "../core/helpers/clash.mjs";
import { createAlertBox } from "../core/helpers/dialog.mjs";
import { sendNetworkMessage } from "../core/helpers/netmsg.mjs";

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
                this.handleUsageWeapon(initiator);
                break;
            case "outfit":
                break;
            default:
                break;
        }
    }

    async handleUsageWeapon(initiator) {
        const item = this;

        const speaker = ChatMessage.getSpeaker({ actor: this.actor });
        const rollMode = game.settings.get('core', 'rollMode');

        if (game.user.targets.first() == null) {
            createAlertBox("You must designate a target before attacking!");
            return
        }

        const context = this.getRollContext(game.user.targets.first().actor);
        console.log("/")
        console.log("we are: " + this.actor.name);
        console.log("targeting: " + context.target.name);
        console.log("/");

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
        }
        
        createClashMessage(this.actor, context);
        game.user.targets.first().actor.processAttackRoll(context);
    }

    getRollContext(target = null) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        rollContext.damageType = systemData.damageType;
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.type = systemData.type;
        rollContext.processEffects();
        return rollContext;
    }

    getRollContextBlo(target = null) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
        rollContext.addEffectsList(systemData.effects, fixTypeName(this.type));
        rollContext.damageType = "Block";
        rollContext.name = this.name;
        rollContext.actor = this.actor;
        rollContext.target = target;
        rollContext.type = systemData.type;
        rollContext.processEffects();
        return rollContext;
    }

    getRollContextEvd(target = null) {
        const itemData = this;
        const systemData = itemData.system;
        const rollContext = new RollContext();
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
    const itemData = item;
    const systemData = itemData.system;
    const rollContext = new RollContext();
    rollContext.addEffectsList(systemData.effects, fixTypeName(item.type));
    rollContext.damageType = def ? defType : systemData.damageType;
    rollContext.name = item.name;
    rollContext.attackType = systemData.type;
    rollContext.processEffects();
    return rollContext;
}