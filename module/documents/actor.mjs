import { RollContext } from "../core/combat/rollContext.mjs";
import { createClashMessage, createEffectsMessage, createResultMessage } from "../core/helpers/clash.mjs";
import { createClashResponse, pollUserInputConfirm } from "../core/helpers/dialog.mjs";
import { statusList } from "../core/status/statusEffects.mjs";
import { Triggers } from "../core/status/statusEffect.mjs";
import { playSound, searchByObject } from "../pmttrpg.mjs";
import { currentRound } from "../core/combat/combatState.mjs";
import { getRollContextFromData } from "./item.mjs";
import { registerEffectMacro } from "../core/combat/macros.mjs";

let pending = {};
let pendingStagger = {};
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

        if (Number(attr.light) <= 0 || Number(attr.light) >= 0) {
            attr.light = {
                max: 0,
                value: 0
            }
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

        if (this.outfit != null) {
            let effect = this.outfit.effects.find(x => x.name == "Comfy Clothes");

            if (effect != null) {
                systemData.initiativeModifier = effect.count;
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
        system.overchargeDeclared = false;
        system.attributes.health.temp = 0;
        system.attributes.stagger.temp = 0;
        system.attributes.sanity.temp = 0;
        system.mostRecentRoll = null;
        system.recycleAction = null;
        system.chargeBarrierHP = 0;
        system.movement = 0;
        system.nextRoundMovement = 0;
        system.staggerRounds = 0;
        system.staggered = false;

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

        return { damage: dmg, text: text };
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
        if (this.outfit == null || this.system.staggered) {
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

        await new Promise(resolve => setTimeout(resolve, 1000));

        if (pending[ctx2.actor.name] != null) {
            createEffectsMessage(pending[ctx2.actor.name].subject, pending[ctx2.actor.name].effect);
            pending[ctx2.actor.name] = null;

            let kinetic = ctx2.actor.outfitEffectCount("Kinetic Inductor");

            if (kinetic != 0) {
                if (kinetic > 0) {
                    await ctx2.actor.applyStatus("Charge", kinetic);
                    createEffectsMessage(ctx2.actor.name, `Gains ${kinetic} [/status/Charge] Charge from Kinetic Inductor!`);
                }
                else {
                    kinetic = Math.abs(kinetic);
                    let count = Math.min(ctx2.actor.getStatusCount("Charge"), kinetic);
                    let hp = 2 * (kinetic - count);
                    await ctx2.actor.reduceStatus("Charge", count);
                    if (hp > 0) {
                        await ctx2.actor.takeDamage(0, null, hp, 0, 0, true);
                    }

                    if (hp > 0 && count <= 0) {
                        createEffectsMessage(ctx2.actor.name, `Takes ${hp} HP damage from Kinetic Inductor!`);
                    }
                    else if (count > 0 && hp <= 0) {
                        createEffectsMessage(ctx2.actor.name, `Loses ${count} [/status/Charge] Charge from Kinetic Inductor!`);
                    }
                    else {
                        createEffectsMessage(ctx2.actor.name, `Takes ${hp} HP damage and loses ${count} [/status/Charge] Charge from Kinetic Inductor!`);
                    }
                }
            }
        }

        if (pendingStagger[ctx2.actor.name] != null) {
            if (pendingStagger[ctx2.actor.name]) {
                await ctx2.actor.stagger();
                pendingStagger[ctx2.actor.name] = false;
            }
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

        await ctx1.actor.update({ "system.clashesWon": Number(ctx1.actor.system.clashesWon) + 1 }, { diff: false });
        if (ctx2.result != "X") {
            await ctx2.actor.update({ "system.clashesLost": Number(ctx2.actor.system.clashesLost) + 1 }, { diff: false });
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
        if (status == "Ruin" || status == "Poise") {
            resist += (this.augmentEffectCount("Vital Protections") * 2) + (this.outfitEffectCount("Vital Protections") * 2);
        }

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
                    if (hp >= this.system.attributes.health.value) {
                        let lost = prevHP - hp;
                        await this.update({ "system.attributes.health.temp": this.system.attributes.health.temp - lost }, { diff: false });

                        let barrier = Number(this.system.chargeBarrierHP);
                        if (barrier > 0) {
                            barrier = Math.clamp(barrier - lost, 0, barrier);
                            let count = Math.floor(lost / 3);
                            await this.reduceStatus("Charge_Barrier", Math.clamp(this.getStatusCount("Charge_Barrier"), 0, count));
                            await this.update({ "system.chargeBarrierHP": barrier }, { diff: false });
                        }

                        if (this.system.attributes.health.temp < 0) {
                            await this.update({ "system.attributes.health.temp": 0 }, { diff: false });
                            await this.update({ "system.attributes.health.value": this.system.attributes.health.value - Math.abs(lost) }, { diff: false });
                        }
                    }
                    else {
                        hp = Math.clamp(hp, 0, this.system.attributes.health.value);
                        await this.update({ "system.attributes.health.temp": 0 }, { diff: false });
                        await this.update({ "system.attributes.health.value": hp }, { diff: false });
                    }
                    break;
                case "ST":
                    st -= damage;
                    if (st >= this.system.attributes.stagger.value) {
                        let lost = prevST - st;
                        await this.update({ "system.attributes.stagger.temp": this.system.attributes.stagger.temp - lost }, { diff: false });

                        if (this.system.attributes.stagger.temp < 0) {
                            await this.update({ "system.attributes.stagger.temp": 0 }, { diff: false });
                            await this.update({ "system.attributes.stagger.value": this.system.attributes.stagger.value - Math.abs(lost) }, { diff: false });
                        }
                    }
                    else {
                        st = Math.clamp(st, 0, this.system.attributes.stagger.max);
                        await this.update({ "system.attributes.stagger.temp": 0 }, { diff: false });
                        await this.update({ "system.attributes.stagger.value": st }, { diff: false });
                    }
                    break;
                case "SP":
                    sp -= damage;
                    if (sp >= this.system.attributes.sanity.value) {
                        let lost = prevSP - sp;
                        await this.update({ "system.attributes.sanity.temp": this.system.attributes.sanity.temp - lost }, { diff: false });

                        if (this.system.attributes.sanity.temp < 0) {
                            await this.update({ "system.attributes.sanity.temp": 0 }, { diff: false });
                            await this.update({ "system.attributes.sanity.value": this.system.attributes.sanity.value - Math.abs(lost) }, { diff: false });
                        }
                    }
                    else {
                        sp = Math.clamp(sp, 0, this.system.attributes.sanity.max);
                        await this.update({ "system.attributes.sanity.temp": 0 }, { diff: false });
                        await this.update({ "system.attributes.sanity.value": sp }, { diff: false });
                    }
                    break;
            }
        }

        createEffectsMessage(this.name, string
            .replace("%HP%", hp).replace("%PHP%", prevHP)
            .replace("%ST%", st).replace("%PST%", prevST)
            .replace("%SP%", sp).replace("%PSP%", prevSP)
            .replace("%DMG%", `${damage}${resText}`)
        );

        await this.update({ "system.damageTaken": Number(this.system.damageTaken) + (prevHP - hp)});

        if (this.system.attributes.stagger.value <= 0 && !this.system.staggered) {
            await this.stagger();
        }
    }

    async heal(fhp = 0, fst = 0, fsp = 0) {
        if (this.system.staggered) {
            fst = 0;
        }

        let hp = this.system.attributes.health.value;
        let st = this.system.attributes.stagger.value;
        let sp = this.system.attributes.sanity.value;

        hp += fhp;
        st += fst;
        sp += fsp;

        hp = Math.clamp(hp, 0, this.system.attributes.health.max);
        st = Math.clamp(st, 0, this.system.attributes.stagger.max);
        sp = Math.clamp(sp, 0, this.system.attributes.sanity.max);

        await this.update({ "system.attributes.health.value": hp }, { diff: false });
        await this.update({ "system.attributes.stagger.value": st }, { diff: false });
        await this.update({ "system.attributes.sanity.value": sp }, { diff: false });
    }

    async healTemp(fhp = 0, fst = 0, fsp = 0) {
        let hp = this.system.attributes.health.temp;
        let st = this.system.attributes.stagger.temp;
        let sp = this.system.attributes.sanity.temp;

        hp += fhp;
        st += fst;
        sp += fsp;

        await this.update({ "system.attributes.health.temp": hp }, { diff: false });
        await this.update({ "system.attributes.stagger.temp": st }, { diff: false });
        await this.update({ "system.attributes.sanity.temp": sp }, { diff: false });
    }

    async takeDamage(damage, context, flatHP = 0, flatST = 0, flatSP = 0, silent = false) {
        let hp = this.system.attributes.health.value + this.system.attributes.health.temp;
        let st = this.system.attributes.stagger.value + this.system.attributes.stagger.temp;
        let sp = this.system.attributes.sanity.value + this.system.attributes.sanity.temp;

        let prevHP = hp;
        let prevST = st;
        let prevSP = sp;

        let protTextHP = [];
        let protTextST = [];

        let resist = this.augmentEffectCount(`Damage Resistance`) + this.outfitEffectCount(`Damage Resistance`);
        let resText = "";

        if (!silent) {
            if (this.outfitEffectCount("Charged Hull") > 0 && this.getStatusCount("Overcharge") > 0) {
                if (await pollUserInputConfirm(this, "Spend 1 [/status/Overcharge] Overcharge to reduce incoming damage by 3?")) {
                    resist += 3;
                    createEffectsMessage(this.name, `Spends 1 [/status/Overcharge] Overcharge to reduce incoming damage by 3!`);
                    await this.reduceStatus("Overcharge", 1);
                }
            }
        }

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

        if (hp >= this.system.attributes.health.value) {
            let lost = prevHP - hp;
            await this.update({ "system.attributes.health.temp": this.system.attributes.health.temp - lost }, { diff: false });

            let barrier = Number(this.system.chargeBarrierHP);
            if (barrier > 0) {
                barrier = Math.clamp(barrier - lost, 0, barrier);
                let count = Math.floor(lost / 3);
                await this.reduceStatus("Charge_Barrier", Math.clamp(this.getStatusCount("Charge_Barrier"), 0, count));
                await this.update({ "system.chargeBarrierHP": barrier }, { diff: false });
            }

            if (this.system.attributes.health.temp < 0) {
                await this.update({ "system.attributes.health.temp": 0 }, { diff: false });
                await this.update({ "system.attributes.health.value": this.system.attributes.health.value - Math.abs(lost) }, { diff: false });
            }
        }
        else {
            hp = Math.clamp(hp, 0, this.system.attributes.health.value);
            await this.update({ "system.attributes.health.temp": 0 }, { diff: false });
            await this.update({ "system.attributes.health.value": hp }, { diff: false });
        }

        if (st >= this.system.attributes.stagger.value) {
            let lost = prevST - st;
            await this.update({ "system.attributes.stagger.temp": this.system.attributes.stagger.temp - lost }, { diff: false });

            if (this.system.attributes.stagger.temp < 0) {
                await this.update({ "system.attributes.stagger.temp": 0 }, { diff: false });
                await this.update({ "system.attributes.stagger.value": this.system.attributes.stagger.value - Math.abs(lost) }, { diff: false });
            }
        }
        else {
            st = Math.clamp(st, 0, this.system.attributes.stagger.max);
            await this.update({ "system.attributes.stagger.temp": 0 }, { diff: false });
            await this.update({ "system.attributes.stagger.value": st }, { diff: false });
        }

        if (sp >= this.system.attributes.sanity.value) {
            let lost = prevSP - sp;
            await this.update({ "system.attributes.sanity.temp": this.system.attributes.sanity.temp - lost }, { diff: false });

            if (this.system.attributes.sanity.temp < 0) {
                await this.update({ "system.attributes.sanity.temp": 0 }, { diff: false });
                await this.update({ "system.attributes.sanity.value": this.system.attributes.sanity.value - Math.abs(lost) }, { diff: false });
            }
        }
        else {
            sp = Math.clamp(sp, 0, this.system.attributes.sanity.max);
            await this.update({ "system.attributes.sanity.temp": 0 }, { diff: false });
            await this.update({ "system.attributes.sanity.value": sp }, { diff: false });
        }

        await this.update({ "system.damageTaken": Number(this.system.damageTaken) + (prevHP - hp)}, { diff: false });
        if (context != null && context.actor != null) {
            await context.actor.update({ "system.damageDealt": Number(context.actor.system.damageDealt) + (prevHP - hp)}, { diff: false });
        }

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

        if (this.system.attributes.stagger.value <= 0 && !this.system.staggered) {
            if (!silent) {
                pendingStagger[this.name] = true;
            }
            else {
                await this.stagger();
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

        if (this.system.overchargeDeclared) {
            await this.fireStatusEffect("Overcharge");
        }

        const system = this.toObject(false).system;

        if (system.staggered) {
            system.staggerRounds = Number(system.staggerRounds) - 1;

            if (system.staggerRounds <= 0) {
                system.staggered = false;
                system.attributes.stagger.value = system.attributes.stagger.max;
                system.attributes.stagger.temp = Number(system.attributes.stagger.temp) + 10;

                createEffectsMessage(this.name, `${this.name} has recovered from stagger!`);
            }
        }

        for (const status of system.statusEffects) {
            status.count = Number(status.count) + Number(status.nextRoundCount);
            status.nextRoundCount = 0;
        }

        await this.update({ system }, { diff: false, render: true });

        await this.getAugmentContext().fireEvent("Round Start");
        await this.getOutfitContext().fireEvent("Round Start");

        let barrier = Number(this.system.chargeBarrierHP);
        if (barrier > 0) {
            await this.update({ "system.attributes.health.temp": Math.max(this.system.attributes.health.temp - barrier, 0) }, { diff: false });
            await this.update({ "system.chargeBarrierHP": 0 }, { diff: false });
        }

        let cbStack = this.getStatusCount("Charge_Barrier");
        if (cbStack > 0) {
            let shield = cbStack * 3;
            await this.update({ "system.attributes.health.temp": this.system.attributes.health.temp + shield }, { diff: false });
            await this.update({ "system.chargeBarrierHP": shield }, { diff: false });
            createEffectsMessage(this.name, `Gains ${shield} Temporary HP from [/status/Charge_Barrier] Charge Barrier!`);
        }

        let speed = this.getStatusCount("Haste") + this.getStatusCount("Bind");
        speed += this.system.nextRoundMovement;

        await this.update({ "system.movement": 6 + speed }, { diff: false });
        await this.update({ "system.nextRoundMovement": 0 }, { diff: false });
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

    async stagger() {
        const system = this.toObject(false).system;
        system.attributes.stagger.value = 0;
        system.attributes.stagger.temp = 0;
        system.staggerRounds = 2;
        system.staggered = true;
        system.attributes.light = Math.min(Number(system.attributes.light.max), Number(system.attributes.light.value) + 1);

        playSound("stagger", true);

        createEffectsMessage(this.name, `${this.name} has been staggered!`);

        await this.update({ system }, { diff: false, render: true });
        await this.takeDamage(0, null, 0, 0, 5, true);
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

        if (status == "Charge") {
            let chargeSpent = Number(system.chargeSpent) + count;
            if (chargeSpent >= 10) {
                let count = Math.floor(chargeSpent / 10);
                chargeSpent -= count * 10;
                await this.applyStatus("Overcharge", count);
                createEffectsMessage(this.name, `Gained ${count} [/status/Overcharge] Overcharge from spent [/status/Charge] Charge!`);
            }
            await this.update({ "system.chargeSpent": chargeSpent }, { diff: false });
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

    async fireStatusEffect(status) {
        let def = statusList.find(x => x.name == status);
        let count = this.getStatusCount(status);

        await def.activation(this);
        
        if (status == "Bleed" && this.getStatusCount("Hemorrhage") > 0) {
            await this.reduceStatus("Hemorrhage", 1);
            return;
        }

        if (status == "Burn" && this.getStatusCount("Renewed_Blaze") > 0) {
            await this.reduceStatus("Renewed_Blaze", 1);
            return;
        }

        if (status == "Frostbite" && this.getStatusCount("Deep_Chill") > 0) {
            await this.reduceStatus("Deep_Chill", 1);
            return;
        }

        await this.setStatus(status, def.decay(count));
    }

    async fireStatusEffects(trigger) {
        for (const status of this.system.statusEffects) {
            let def = statusList.find(x => x.name == status.name);
            if (def == null) {
                continue;
            }

            if (def.triggerType == trigger && status.count > 0) {
                await this.fireStatusEffect(status.name);
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

    async refreshMacroBar() {
        console.log("refreshing macro bar for: " + this.name);
        let oCtx = this.getOutfitContext();
        let aCtx = this.getAugmentContext();

        for (let i = 1; i <= 50; i++) {
            await game.user.assignHotbarMacro(null, i);
        }

        await registerEffectMacro("Dash", async (actor) => {
            let movement = Number(actor.system.movement);
            let extraMovement = 3 + actor.system.abilities.Justice.value + this.outfitEffectCount("Light Material");
            await actor.update({ "system.movement": movement + extraMovement });
            createEffectsMessage(actor.name, `Gains ${extraMovement} extra movement from dashing! (${movement} -> ${movement + extraMovement})`);
        }, "icons/Dash.png")

        if (this.augmentEffectCount("Concentrated Overcharge") > 0 || this.augmentEffectCount("Meditation") > 0) {
            console.log("registering effect macro for Controlled Stagger");
            await registerEffectMacro("Controlled Stagger", async (actor) => {
                if (actor.system.staggered) {
                    ui.notifications.notify("You are already staggered!");
                    return;
                }

                await actor.stagger();

                if (actor.augmentEffectCount("Concentrated Overcharge") > 0) {
                    await actor.applyStatus("Overcharge", 2);
                    createEffectsMessage(actor.name, "Gains 2 [/status/Overcharge] Overcharge from Concentrated Overcharge!");
                }

                if (actor.augmentEffectCount("Meditation") > 0) {
                    let emotion = Number(actor.system.emotion);
                    await actor.update({ "system.emotion": emotion + 8 }, { diff: false });
                    createEffectsMessage(actor.name, `Gains 8 [/resources/EmotionIcon] Emotion from Meditation! (${emotion} -> ${emotion + 8})`);
                }
            }, "icons/Controlled_Stagger.png");
        }

        for (const macro of oCtx.macros) {
            await registerEffectMacro(macro.name, macro.callback, macro.img);
        }

        for (const macro of aCtx.macros) {
            await registerEffectMacro(macro.name, macro.callback, macro.img);
        }
    }
}
