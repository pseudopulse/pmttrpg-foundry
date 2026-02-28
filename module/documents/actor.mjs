import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashResponse } from "../core/helpers/dialog.mjs";

//
export class PTActor extends Actor {
    static get defaultType() {
        return "character";
    }

    prepareDerivedData() {
        super.prepareDerivedData();
        const actorData = this;
        const systemData = actorData.system;

        const attr = systemData.attributes;
        const stats = systemData.abilities;
        
        // rank

        attr.level.value = Math.floor(attr.xp.value / 8);
        attr.rank.value = 1 + Math.floor(attr.level.value / 3);
        
        // stat formulas
        attr.health.max = Math.floor(64 + (stats.Fortitude.value * 8) + (attr.rank.value * 32));
        attr.stagger.max = Math.floor(20 + (stats.Charm.value * 4) + (attr.rank.value * 4));
        attr.sanity.max = Math.floor(15 + (stats.Prudence.value * 3) + (attr.rank.value * 3));
    }

    /**
    * @param {RollContext} context 
    */
    processAttackRoll(context) {
        const actorData = this;
        const systemData = actorData.system;
        const attr = systemData.attributes;
        const stats = systemData.abilities;

        attr.health.value = Math.max(0, attr.health.value - context.result);

        this.update({systemData}, { render: true });
    }
    
    /**
    * @param {RollContext} context 
    */

    handlePendingClash(context) {
        const actorData = this;
        const systemData = actorData.system;
        const attr = systemData.attributes;
        const stats = systemData.abilities;
        
        console.log("we are: " + this.name);
        console.log("setting target to: " + canvas.tokens.placeables.find(x => x.actor._id == context.actor._id).actor.name);
        canvas.tokens.placeables.find(x => x.actor._id == context.actor._id).setTarget(true, { releaseOthers: true });
        createClashResponse(this, context);
    }
}
