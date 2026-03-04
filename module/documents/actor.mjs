import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashMessage, createEffectsMessage, createResultMessage } from "../core/helpers/clash.mjs";
import { createClashResponse } from "../core/helpers/dialog.mjs";
import { statusList } from "../core/status/statusEffects.mjs";
import { Triggers } from "../core/status/statusEffect.mjs";
import { searchByObject } from "../pmttrpg.mjs";
import { currentRound } from "../core/combat/combatState.mjs";

let pending = {};

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

        //
        if (attr.health.value == null) attr.health.value = 0;
        if (attr.stagger.value == null) attr.stagger.value = 0;
        if (attr.sanity.value == null) attr.sanity.value = 0;

        // outfit management
        if (systemData.currentOutfitId == "") {
            const outfits = this.items.filter(x => x.type == "outfit");
            if (outfits.length > 0) {
                systemData.currentOutfitId = outfits[0]._id;
                this.outfit = outfits[0];
            }
        }
        else {
            this.outfit = this.items.find(x => x._id == systemData.currentOutfitId);
        }
    }

    getModifiedDamage(context, damage, cat) {
        const result = damage * this.findResistance(context.damageType, cat);

        if (this.outfit) {
            
        }

        return Math.floor(result);
    }

    findResistance(type, cat) {
        console.log(this.outfit);
        if (this.outfit == null) {
            return 2;
        }

        switch (type) {
            case "Slash":
                return cat == "ST" ? this.outfit.system.slashResST : this.outfit.system.slashRes;
            case "Pierce":
                return cat == "ST" ? this.outfit.system.pierceResST : this.outfit.system.pierceRes;
            case "Blunt":
                return cat == "ST" ? this.outfit.system.bluntResST : this.outfit.system.bluntRes;
        }
    }

    /**
    * @param {RollContext} context 
    */
    async sendAttackRoll(alertClashResolved = false) {
        this.prepareData();

        const actorData = this;
        const systemData = this.system;
        const attr = systemData.attributes;
        const stats = systemData.abilities;

        if (alertClashResolved) {
            this.queueRoll(null, true);

            const ctx1 = new RollContext();
            Object.assign(ctx1, systemData.mostRecentRoll.context);
            ctx1.fix();
                
            const ctx2 = new RollContext();
            if (ctx1.target != null && ctx1.target.system.mostRecentRoll != null) {
                Object.assign(ctx2, ctx1.target.system.mostRecentRoll.context);
            }
            else {
                ctx2.result = "X";
                if (ctx1.target != null) {
                    ctx2.actor = ctx1.target;
                }
            }

            this.processClashResolution(ctx1, ctx2);
        }
        else {
            const respCtx = new RollContext();
            Object.assign(respCtx, systemData.mostRecentRoll.context);
            respCtx.fix();
            console.log(respCtx);

            await respCtx.target.receiveAttackRoll(respCtx);
        }
    }

    async processClashResolution(ctx1, ctx2) {
        createResultMessage(ctx1, ctx2);
        if (ctx1.result > ctx2.result || ctx2.result == "X") {
            
        }
        else if (ctx2.result > ctx1.result || ctx1.result == "X") {
            let tmp = ctx1;
            ctx1 = ctx2;
            ctx2 = tmp;
        }
        else {
            return;
        }

        createEffectsMessage(ctx1.actor.name, ctx1.resolveTriggers(["On Use", "Clash Win"]), true);
        createEffectsMessage(ctx2.actor.name, ctx2.resolveTriggers(["On Use", "Clash Lose"]), true);

        if (pending[ctx2.actor.name] != null) {
            createEffectsMessage(pending[ctx2.actor.name].subject, pending[ctx2.actor.name].effect);
            pending[ctx2.actor.name] = null;
        }
    }

    /**
    * @param {RollContext} context 
    */
    async receiveAttackRoll(context, canRespond = true) {
        this.prepareData();

        const actorData = this;
        const systemData = actorData.toObject(false).system;
        const attr = systemData.attributes;
        const stats = systemData.abilities;

        let damage = context.result;

        this.queueRoll(null, true);

        if (systemData.mostRecentRoll != null && systemData.mostRecentRoll.type != "None" && canRespond) {
            const respCtx = new RollContext();
            Object.assign(respCtx, systemData.mostRecentRoll.context);
            respCtx.fix();

            if (systemData.mostRecentRoll.type == "Block") {
                damage -= respCtx.result;
                if (damage < 0) {
                    damage = 0;
                }

                console.log("blocked, reducing damage by " + respCtx.result);

                await this.takeDamage(damage, context);
            }

            if (systemData.mostRecentRoll.type == "Evade") {
                if (respCtx.result > context.result) {
                    console.log("won evade, regen sp");
                    await this.takeDamage(-respCtx.result, context);
                }
                else {
                    console.log("lost evade");
                    await this.takeDamage(damage, context);
                }
            }

            if (systemData.mostRecentRoll.type == "Counter") {
                console.log("checking against counter");
                console.log(respCtx.result + " vs " + context.result);
                if (respCtx.result > context.result) {
                    console.log("won counter, returning attack");
                    if (canRespond) context.actor.receiveAttackRoll(respCtx, false);
                }
                else {
                    console.log("lost counter");
                    await this.takeDamage(damage, context);
                }
            }
        }
        else {
            await this.takeDamage(damage, context);
        }

        if (canRespond) {
            context.actor.sendAttackRoll(true);
        }
    }

    async takeDamageStatus(damage, status, cat, string) {
        let hp = this.system.attributes.health.value;
        let st = this.system.attributes.stagger.value;
        let sp = this.system.attributes.sanity.value;
        
        console.log("-/-");
        console.log(this.system);

        let prevHP = hp;
        let prevST = st;
        let prevSP = sp;
        
        if (damage != 0) {
            switch (cat) {
                case "HP":
                    hp -= damage;
                    break;
                case "ST":
                    st -= damage;
                    break;
                case "SP":
                    sp -= damage;
                    break;
            }
        }

        hp = Math.clamp(hp, 0, this.system.attributes.health.max);
        st = Math.clamp(st, 0, this.system.attributes.stagger.max);
        sp = Math.clamp(sp, 0, this.system.attributes.sanity.max);

        createEffectsMessage(this.name, string
            .replace("%HP%", hp).replace("%PHP%", prevHP)
            .replace("%ST%", st).replace("%PST%", prevST)
            .replace("%SP%", sp).replace("%PSP%", prevSP)
            .replace("%DMG%", damage)
        );

        await this.update({"system.attributes.health.value": hp}, {diff: false});
        await this.update({"system.attributes.stagger.value": st}, {diff: false});
        await this.update({"system.attributes.sanity.value": sp}, {diff: false});

        console.log(this.system);
    }

    async takeDamage(damage, context, flatHP = 0, flatST = 0, flatSP = 0) {
        let hp = this.system.attributes.health.value;
        let st = this.system.attributes.stagger.value;
        let sp = this.system.attributes.sanity.value;

        console.log("hp before: " + hp + " - " + st);

        let prevHP = hp;
        let prevST = st;

        console.log("---");
        console.log(this.system);
        console.log(hp);
        console.log(context);
        console.log("---");

        if (damage != 0) {
            hp -= this.getModifiedDamage(context, damage, null);
            st -= this.getModifiedDamage(context, damage, "ST");
        }

        hp = Math.clamp(hp, 0, this.system.attributes.health.max);
        st = Math.clamp(st, 0, this.system.attributes.stagger.max);
        await this.update({"system.attributes.health.value": hp}, {diff: false});
        await this.update({"system.attributes.stagger.value": st}, {diff: false});

        console.log("hp after: " + hp + " - " + st);
        
        pending[this.name] = 
        {
            subject: this.name,
            effect:
            `
            ${damage} x ${this.findResistance(context.damageType, null)} = ${this.getModifiedDamage(context, damage, null)} HP damage taken.
            (${prevHP} -> ${hp})
            ${damage} x ${this.findResistance(context.damageType, "ST")} = ${this.getModifiedDamage(context, damage, "ST")} ST damage taken.
            (${prevST} -> ${st})
            `
        }
    }

    /**
    * @param {RollContext} context 
    */
    queueRoll(context, reset = false) {
        const system = this.toObject(false).system;
        if (reset) {
            system.mostRecentRoll = null;
        }
        else {
            system.mostRecentRoll = {
                type: this.fixRollType(context.damageType),
                roll: context.roll,
                context: context
            };
        }

        this.update({ system }, { diff: false });
    }

    fixRollType(type) {
        if (type != "Block" && type != "Evade") {
            return "Counter";
        }

        return type;
    }
    
    /**
    * @param {RollContext} context 
    */

    async handlePendingClash(context) {
        const actorData = this;
        const systemData = actorData.system;
        const attr = systemData.attributes;
        const stats = systemData.abilities;

        console.log(this);
        
        console.log("we are: " + this.name);
        console.log("setting target to: " + canvas.tokens.placeables.find(x => x.actor._id == context.actor._id).actor.name);
        canvas.tokens.placeables.find(x => x.actor._id == context.actor._id).setTarget(true, { releaseOthers: true });
        createClashResponse(this, context);
    }


    async handleCombatStart() {
        const system = this.toObject(false).system;

        system.statusEffects = [];
        system.pendingStatusEffects = [];

        await this.update({ system }, { diff: false });
    }

    async handleNextRound() {
        await this.fireStatusEffects(Triggers.END);

        const system = this.toObject(false).system;
        
        for (const status of system.statusEffects) {
            status.count = Number(status.count) + Number(status.nextRoundCount);
            status.nextRoundCount = 0;
        }

        await this.update({ system }, { diff: false, render: true });
    }

    getStatusCount(status) {
        let type = this.system.statusEffects.find(x => x.name == status);

        if (type != null) {
            return type.count;
        }

        return 0;
    }

    getStatusCountNext(status) {
        let type = this.system.statusEffects.find(x => x.name == status);

        if (type != null) {
            return type.nextRoundCount;
        }

        return 0;
    }

    async applyStatus(status, count = 0, nextRoundCount = 0) {
        count = Math.floor(count);
        nextRoundCount = Math.floor(nextRoundCount);
        const system = this.toObject(false).system;

        let type = system.statusEffects.find(x => x.name == status);

        if (type != null) {
            type.count = Number(type.count) + count;
            type.nextRoundCount = Number(type.nextRoundCount) + nextRoundCount;
        }
        else {
            system.statusEffects.push({
                name: status,
                count: count,
                nextRoundCount: nextRoundCount
            });
        }

        await this.update({ system }, { diff: false, render: true });
    }

    async reduceStatus(status, count = 0) {
        count = Math.floor(count);
        const system = this.toObject(false).system;

        let type = system.statusEffects.find(x => x.name == status);

        if (type != null) {
            type.count = Number(type.count) - count;
        }

        await this.update({ system }, { diff: false, render: true });
    }

    async setStatus(status, count) {
        count = Math.floor(count);
        const system = this.toObject(false).system;

        let type = system.statusEffects.find(x => x.name == status);

        if (type != null) {
            type.count = count;
        }
        else {
            system.statusEffects.push({
                name: status,
                count: count,
                nextRoundCount: 0
            })
        }

        await this.update({ system }, { diff: false, render: true });
    }

    async setStatusNext(status, count) {
        const system = this.toObject(false).system;

        let type = system.statusEffects.find(x => x.name == status);

        if (type != null) {
            type.nextRoundCount = count;
        }
        else {
            system.statusEffects.push({
                name: status,
                count: 0,
                nextRoundCount: count,
            })
        }

        await this.update({ system }, { diff: false, render: true });
    }

    async fireStatusEffects(trigger) {
        for (const status of this.system.statusEffects) {
            let def = statusList.find(x => x.name == status.name);
            if (def.triggerType == trigger && status.count > 0) {
                await def.activation(this);
                console.log("setting decay for " + status.name + " to " + def.decay(status.count));
                await this.setStatus(status.name, def.decay(status.count));
            }
        }
    }

    async spendAction() {
        await this.fireStatusEffects(Triggers.ACTION);
    }
}
