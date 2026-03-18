import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashMessage, createEffectsMessage, createResultMessage } from "../core/helpers/clash.mjs";
import { createClashResponse } from "../core/helpers/dialog.mjs";
import { statusList } from "../core/status/statusEffects.mjs";
import { Triggers } from "../core/status/statusEffect.mjs";
import { playSound, searchByObject } from "../pmttrpg.mjs";
import { currentRound } from "../core/combat/combatState.mjs";
import { getRollContextFromData } from "./item.mjs";

let pending = {};
let targetHP = {};

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

        // augment management
        if (systemData.currentAugmentId == "") {
            const augments = this.items.filter(x => x.type == "augment");
            if (augments.length > 0) {
                systemData.currentAugmentId = augments[0]._id;
                this.augment = augments[0];
            }
        }
        else {
            this.augment = this.items.find(x => x._id == systemData.currentAugmentId);
        }

        let light = 3 + attr.rank.value;
        if (this.outfit != null && this.outfit.form == "Balanced") {
            light += 1;
        }

        attr.light.max = light;

        if (systemData.emotion == null || Object.is(Number(systemData.emotion), NaN)) {
            systemData.emotion = 0;
        }

        if (systemData.augment == null) {
            systemData.augment = {
                effects: []
            }
        }
    }

    getOutfitContext() {
        if (this.outfit != null) {
            return getRollContextFromData(this.outfit, true, "Block");
        }

        return new RollContext();
    }

    getAugmentContext() {
        if (this.augment != null) {
            return getRollContextFromData(this.augment, false);
        }

        return new RollContext();
    }

    async resetCombatData() {
        const actorData = this;
        const system = actorData.toObject(false).system;
        
        system.emotion = 0;
        system.damageDealt = 0;
        system.damageTaken = 0;
        system.chargeSpent = 0;
        system.bloodfeastConsumed = 0;
        system.clashesWon = 0;
        system.clashesLost = 0;

        await this.update({ system }, { diff: false, render: true });
    }

    getModifiedDamage(context, damage, cat) {
        const result = damage * this.findResistance(context.damageType, cat);

        return Math.floor(result);
    }

    handleProt(context, cat, type = false) {
        let dmg = 0;
        let text = null;
        let performProt = (prot, frag) => {
            let p = -this.getStatusCount(prot);
            let f = this.getStatusCount(frag);

            dmg = p + f;

            if (dmg > 0) {
                text = `Increased by ${dmg} from [/status/${frag}] ${frag.replace("_", " ")}`
            }
            else if (dmg < 0) {
                text = `Reduced by ${Math.abs(dmg)} from [/status/${prot}] ${prot.replace("_", " ")}`
            }
        };

        if (type) {
            performProt(context.damageType + "_Protection", context.damageType + "_Fragility");
        }
        else if (cat == "ST") {
            performProt("Stagger_Protection", "Stagger_Fragile");
        }
        else {
            performProt("Protection", "Fragile");
        }

        return { damage: dmg, text: text};
    }

    async performContextRoll(context) {
        let formula = `1d${context.diceMax}+${context.dicePower}`;
        if (this.getStatusCount("Paralysis") > 0) {
            await this.reduceStatus("Paralysis", 1);
            formula = `2d${context.diceMax}kl+${context.dicePower}`
        }

        let roll = new Roll(formula);

        return await roll.evaluate();
    }

    findResistance(type, cat) {
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
            const ctx1 = new RollContext();
            Object.assign(ctx1, systemData.mostRecentRoll.context);
            ctx1.fix();
                
            const ctx2 = new RollContext();
            if (ctx1.target != null && ctx1.target.system.mostRecentRoll != null) {
                Object.assign(ctx2, ctx1.target.system.mostRecentRoll.context);
                ctx2.fix();
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

            targetHP[respCtx.target.id] = respCtx.target.system.attributes.health.value;

            await respCtx.target.receiveAttackRoll(respCtx);
            playSound("clash");
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

        let ruin = ctx2.actor.getStatusCount("Ruin");
        let devastation = ctx2.actor.getStatusCount("Devastation");

        if (ruin > 0) {
            let tmp = new Roll(`1d10`);
            await tmp.evaluate();
            let roll = tmp.total;

            if (roll <= ruin) {
                tmp = new Roll(`${devastation}d8`);
                await tmp.evaluate();
                let damage = tmp.total;
                console.log(ctx2.actor);
                await ctx2.actor.setStatus("Ruin", 0);
                await ctx2.actor.setStatus("Devastation", 0);
                await ctx2.actor.takeDamageStatus(damage, "Ruin", null, `Received a [/status/Devastation] Devastating hit for %DMG% HP damage! (%PHP% -> %HP%)`);
                await ctx1.fireEvent("Devastating Hit");
            }
            else {
                createEffectsMessage(ctx1.actor.name, `Rolled ${roll}, failed [/status/Ruin] Ruin check!`);
            }
        }

        if (!ctx1.ignoreClashEffects && !ctx2.ignoreClashEffects) {
            createEffectsMessage(ctx1.actor.name, await ctx1.resolveTriggers(["On Use", "Clash Win"]), true);
            createEffectsMessage(ctx2.actor.name, await ctx2.resolveTriggers(["On Use", "Clash Lose"]), true);
        }

        if (pending[ctx2.actor.name] != null) {
            createEffectsMessage(pending[ctx2.actor.name].subject, pending[ctx2.actor.name].effect);
            pending[ctx2.actor.name] = null;
        }

        if (!ctx1.ignoreClashEffects && !ctx2.ignoreClashEffects) {
            await ctx1.fireEvent("Clash Win");
            await ctx2.fireEvent("Clash Lose");

            if (ctx2.actor.system.attributes.health.value == 0 && targetHP[ctx2.actor.id] > 0) {
                await ctx1.fireEvent("Kill");
            }
        }

        await ctx1.actor.queueRoll(null, true);
        await ctx2.actor.queueRoll(null, true);
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

        if (systemData.mostRecentRoll != null && systemData.mostRecentRoll.type != "None" && canRespond) {
            const respCtx = new RollContext();
            Object.assign(respCtx, systemData.mostRecentRoll.context);
            respCtx.fix();

            if (systemData.mostRecentRoll.type == "Block") {
                damage -= respCtx.result;
                if (damage < 0) {
                    damage = 0;
                }

                await this.takeDamage(damage, context);
            }

            if (systemData.mostRecentRoll.type == "Evade") {
                if (respCtx.result > context.result) {
                    await this.takeDamage(-respCtx.result, context);
                }
                else {
                    await this.takeDamage(damage, context);
                }
            }

            if (systemData.mostRecentRoll.type == "Counter") {
                if (respCtx.result > context.result) {
                    if (canRespond) context.actor.receiveAttackRoll(respCtx, false);
                }
                else {
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

        let resist = this.augmentEffectCount(`${status} Resistance`) + this.outfitEffectCount(`${status} Resistance`);
        let resText = "";

        if (resist != 0) {
            damage -= resist;
            damage = Math.max(damage, 0);

            if (resist > 0) {
                resText = ` (Resisted: ${resist})`;
            }
            else {
                resText = ` (Increased: ${Math.abs(resist)})`;
            }
        }

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
            .replace("%DMG%", `${damage}${resText}`)
        );

        await this.update({"system.attributes.health.value": hp}, {diff: false});
        await this.update({"system.attributes.stagger.value": st}, {diff: false});
        await this.update({"system.attributes.sanity.value": sp}, {diff: false});
    }

    async heal(fhp = 0, fst = 0, fsp = 0) {
        let hp = this.system.attributes.health.value;
        let st = this.system.attributes.stagger.value;
        let sp = this.system.attributes.sanity.value;

        hp += fhp;
        st += fst;
        sp += fsp;

        hp = Math.clamp(hp, 0, this.system.attributes.health.max);
        st = Math.clamp(st, 0, this.system.attributes.stagger.max);
        sp = Math.clamp(sp, 0, this.system.attributes.sanity.max);

        await this.update({"system.attributes.health.value": hp}, {diff: false});
        await this.update({"system.attributes.stagger.value": st}, {diff: false});
        await this.update({"system.attributes.sanity.value": sp}, {diff: false});
    }

    async takeDamage(damage, context, flatHP = 0, flatST = 0, flatSP = 0, silent = false) {
        let hp = this.system.attributes.health.value;
        let st = this.system.attributes.stagger.value;
        let sp = this.system.attributes.sanity.value;

        let prevHP = hp;
        let prevST = st;
        
        let protTextHP = [];
        let protTextST = [];

        let resist = this.augmentEffectCount(`Damage Resistance`) + this.outfitEffectCount(`Damage Resistance`);
        let resText = "";

        if (resist != 0) {
            damage -= resist;
            damage = Math.max(damage, 0);

            if (resist > 0) {
                resText = ` (Resisted: ${resist})`;
            }
            else {
                resText = ` (Increased: ${Math.abs(resist)})`;
            }
        }

        if (damage != 0) {
            let hpDmg = this.getModifiedDamage(context, damage, null);
            let stDmg = this.getModifiedDamage(context, damage, "ST");
            let hpP = this.handleProt(context, "", false);
            let hpPT = this.handleProt(context, "", true);
            let stP = this.handleProt(context, "ST", false);
            
            
            hp -= Math.max(hpDmg + (hpP.damage + hpPT.damage), 0);
            st -= Math.max(stDmg + stP.damage, 0);
            
            protTextHP.push(hpP.text);
            protTextHP.push(hpPT.text);
            protTextST.push(stP.text);
        }

        hp -= flatHP;
        st -= flatST;
        sp -= flatSP;

        hp = Math.clamp(hp, 0, this.system.attributes.health.max);
        st = Math.clamp(st, 0, this.system.attributes.stagger.max);
        await this.update({"system.attributes.health.value": hp}, {diff: false});
        await this.update({"system.attributes.stagger.value": st}, {diff: false});

        
        if (!silent) {
            pending[this.name] = 
            {
                subject: this.name,
                effect:
                this.removeLinesWithString(`
                ${damage}${resText} x ${this.findResistance(context.damageType, null)} = ${this.getModifiedDamage(context, damage, null)} HP damage taken. (${prevHP} -> ${hp})
                (${protTextHP[0] != null ? protTextHP[0] : ""})
                (${protTextHP[1] != null ? protTextHP[1] : ""})

                ${damage}${resText} x ${this.findResistance(context.damageType, "ST")} = ${this.getModifiedDamage(context, damage, "ST")} ST damage taken. (${prevST} -> ${st})
                (${protTextST[0] != null ? protTextST[0] : ""})
                `, "()")
            }
        }
    }

    removeLinesWithString(inputText, targetString) {
        const lines = inputText.split('\n');
        const filteredLines = lines.filter(line => !line.includes(targetString));
        return filteredLines.join('\n');
    }

    /**
    * @param {RollContext} context 
    */
    async queueRoll(context, reset = false) {
        const system = this.toObject(false).system;
        if (reset) {
            system.mostRecentRoll = null;
        }
        else {
            let ctx = new RollContext();
            Object.assign(ctx, context);
            ctx.prepareForSerialization();
            system.mostRecentRoll = {
                type: this.fixRollType(ctx.damageType),
                roll: ctx.roll,
                context: ctx
            };
        }

        await this.update({ system }, { diff: false });
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
        

        canvas.tokens.placeables.find(x => x.actor._id == context.actor._id).setTarget(true, { releaseOthers: true });
        createClashResponse(this, context);
    }


    async handleCombatStart() {
        await this.resetCombatData();
        const system = this.toObject(false).system;

        system.statusEffects = [];
        system.pendingStatusEffects = [];

        await this.update({ system }, { diff: false });

        this.getAugmentContext().fireEvent("Combat Start");
        this.getOutfitContext().fireEvent("Combat Start");
    }

    async handleNextRound() {
        await this.fireStatusEffects(Triggers.END);

        const system = this.toObject(false).system;
        
        for (const status of system.statusEffects) {
            status.count = Number(status.count) + Number(status.nextRoundCount);
            status.nextRoundCount = 0;
        }

        await this.update({ system }, { diff: false, render: true });

        await this.getAugmentContext().fireEvent("Round Start");
        await this.getOutfitContext().fireEvent("Round Start");
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
            type.count = Math.max(Number(type.count) - count, 0);
        }

        await this.update({ system }, { diff: false, render: true });

        // askdjajfjghashghgdsgas
        // this isnt working !!

        if (status == "Charge") {
            system.chargeSpent = Number(system.chargeSpent) + count;
            if (Number(system.chargeSpent) >= 10) {
                let count = Number(system.chargeSpent) % 10;
                system.chargeSpent = Number(system.chargeSpent) - (count * 10);
                await this.applyStatus("Overcharge", count);
                createEffectsMessage(this.name, `Gained ${count} [/status/Overcharge] Overcharge from spent [/status/Charge] Charge!`);
            }
        }
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
            if (def == null) {
                continue;
            }

            if (def.triggerType == trigger && status.count > 0) {
                await def.activation(this);
                await this.setStatus(status.name, def.decay(status.count));
            }
        }
    }

    async spendAction() {
        await this.fireStatusEffects(Triggers.ACTION);
    }

    async assignRecycleableAction(context, type, source) {
        const system = this.toObject(false).system;

        let ctx = new RollContext();
        Object.assign(ctx, context);
        ctx.prepareForSerialization();

        system.recycleAction = {
            context: ctx,
            type: type,
            source: source
        };

        await this.update({ system }, { diff: false, render: true });
    }

    augmentEffectCount(name) {
        if (this.augment != null) {
            let effect = this.getAugmentContext().effects.find(x => x.name == name);

            if (effect != null) {
                return Number(effect.count);
            }
        }

        return 0;
    }

    outfitEffectCount(name) {
        if (this.outfit != null) {
            let effect = this.getOutfitContext().effects.find(x => x.name == name);

            if (effect != null) {
                return Number(effect.count);
            }
        }

        return 0;
    }
}
