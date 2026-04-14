import { RollContext } from "../core/combat/rollContext.mjs";
import { checkDraw, createClashMessage, createEffectsMessage, createResultMessage } from "../core/helpers/clash.mjs";
import { createClashResponse, getAttackOptions, getSkillOptions, pollReduceStatus, pollUserInputBurst, pollUserInputConfirm, pollUserInputOptions, pollUserInputText } from "../core/helpers/dialog.mjs";
import { statusList } from "../core/status/statusEffects.mjs";
import { Triggers } from "../core/status/statusEffect.mjs";
import { getAlliesWithinRadius, getDistance, playSound, searchByObject } from "../pmttrpg.mjs";
import { currentRound } from "../core/combat/combatState.mjs";
import { getRollContextFromData } from "./item.mjs";
import { registerEffectMacro } from "../core/combat/macros.mjs";
import { Mark, MarkNames, MARKS } from "../core/status/mark.mjs";
import { findByID, sendNetworkMessage } from "../core/helpers/netmsg.mjs";

let pending = {};
let pendingStagger = {};
let pendingSmokeVeil = {};
let targetHP = {};
let targetST = {};

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

    sendTriggerActionSkill(item, target) {
        sendNetworkMessage("USE_ACTION_SKILL", {
            attacker: this,
            target: target,
            item: item,
        });
    }

    async processActionSkill(item, target) {
        let ctx = getRollContextFromData(item);
        
        createEffectsMessage(ctx.actor.name, `Uses the skill ${item.name} on ${target == this ? "self" : target.name}!`);
        createEffectsMessage(ctx.actor.name, await ctx.resolveTriggers(["On Use", "Clash Win"]));
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
        system.kineticStorageMovement = 0;
        system.poisePaused = false;
        system.ruinPaused = false;
        system.primerEffectsList = [];
        system.outgoingMarks = [];
        system.incomingMarks = [];
        system.overheatedWeapons = [];
        system.forceFields = this.augmentEffectCount("Force Fields");

        await this.update({ system }, { diff: false, render: true });
    }

    getModifiedDamage(context, damage, cat) {
        let res = this.findResistance(context.damageType, cat);
        if (context.flags.includes("Rip Space") && res < 1.5) {
            res = 1.5;
        }

        const result = damage * res;

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
            default:
                return 1;
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
            targetST[respCtx.target.id] = respCtx.target.system.attributes.stagger.value;

            await respCtx.target.receiveAttackRoll(respCtx);
            playSound("clash");
        }
    }

    getCritRoll(ctx) {
        if (ctx.hasEffect("Precision")) {
            return "1d10kh";
        }

        return "1d10";
    }

    getDevastationRoll(ctx) {
        if (ctx.hasEffect("Ruination")) {
            return "1d10kh";
        }

        return "1d10";
    }

    processIgnorePower(ctx1, ctx2) {
        if (ctx2.hasEffect("Ignore Power")) {
            ctx1.nullifyPower(true);
            ctx2.nullifyPower(false);
        }

        if (ctx1.hasEffect("Ignore Power")) {
            ctx2.nullifyPower(true);
            ctx1.nullifyPower(false);
        }
    }

    async processClashResolution(ctx1, ctx2) {
        this.processIgnorePower(ctx1, ctx2);
        
        createResultMessage(ctx1, ctx2);

        if (checkDraw(ctx1, ctx2)) {
            return;
        }

        if (ctx1.result >= ctx2.result || ctx2.result == "X") {

        }
        else if (ctx2.result >= ctx1.result || ctx1.result == "X") {
            let tmp = ctx1;
            ctx1 = ctx2;
            ctx2 = tmp;
        }

        if (ctx1.target.hasMarkApplied(ctx1.actor, MARKS.Analysis) 
        && (ctx1.target.findResistance(ctx1.damageType, "HP") >= 1.5 || ctx1.target.findResistance(ctx1.damageType, "ST") >= 1.5)) {
            let type = await pollUserInputOptions(ctx1.actor, "Choose Marked for Analysis [Type] Fragility.", [
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

            ctx1.triggers["Clash Win"].applyInfliction(type, 2, true);
        }

        if (ctx1.target.hasMarkApplied(ctx1.actor, MARKS.Exploitation)) {
            ctx1.triggers["On Use"].applyInfliction("Charge", -2, false);
        }

        let totalAssassinationDamage = 3;

        await ctx1.fireEvent("On Use");
        await ctx2.fireEvent("On Use");

        let ruin = ctx2.actor.getStatusCount("Ruin");
        let devastation = ctx2.actor.getStatusCount("Devastation");
        ctx1.devastation = devastation;

        let landedDevastating = false;

        if (ruin > 0 && !ctx2.actor.system.ruinPaused) {
            let tmp = new Roll(this.getDevastationRoll(ctx1));
            await tmp.evaluate();
            let roll = tmp.total;

            if (roll <= ruin) {
                tmp = new Roll(`${devastation}d8`);
                await tmp.evaluate();
                let damage = tmp.total;
                await ctx2.actor.setStatus("Ruin", 0);
                await ctx2.actor.setStatus("Devastation", 0);
                await ctx2.actor.takeDamageStatus(damage, "Ruin", null, `Received a [/status/Devastation] Devastating hit for %DMG% HP damage! (%PHP% -> %HP%)`);
                await ctx2.actor.loadPrimerEffects(ctx1);
                await ctx1.fireEvent("Devastating Hit");
                if (ctx1.actor.augmentEffectCount("Open Arteries") > 0) {
                    await ctx2.actor.applyStatus("Bleed", Math.min(damage, 8));
                    createEffectsMessage(ctx1.actor.name, `Inflicts ${Math.min(damage, 8)} [/status/Bleed] Bleed from Open Arteries!`);
                }
                landedDevastating = true;
                totalAssassinationDamage += 3;
            }
            else {
                createEffectsMessage(ctx1.actor.name, `Rolled ${roll}, failed [/status/Ruin] Ruin check!`);
            }
        }

        if (!landedDevastating && ctx1.hasEffect("Primer")) {
            await ctx2.actor.cachePrimerEffects(ctx1);
        }

        let poise = ctx1.actor.getStatusCount("Poise");
        let critical = ctx1.actor.getStatusCount("Critical");
        ctx1.critical = critical;

        let landedCrit = false;

        if (poise > 0 && (ctx1.attackType == "Melee" || ctx1.attackType == "Ranged") && !ctx1.actor.system.poisePaused) {
            let tmp = new Roll(this.getCritRoll(ctx1));
            await tmp.evaluate();
            let roll = tmp.total;

            if (roll <= poise) {
                let allies = getAlliesWithinRadius(ctx1.actor, 3);
                let bonusCritical = 0;
                for (let ally of allies) {
                    if (ally.augmentEffectCount("Mentor") > 0 && await pollUserInputConfirm(ally, `Spend your [/status/Critical] Critical to strengthen ${ctx1.actor.name}'s hit?`)) {
                        bonusCritical += ally.getStatusCount("Critical");
                        await ally.setStatus("Critical", 0);
                        await ally.setStatus("Poise", 0);
                        createEffectsMessage(ally.name, `Contributes their [/status/Critical] Critical to strengthen ${ctx1.actor.name}'s attack!`);
                    }
                }
                if (ctx2.actor.hasMarkApplied(ctx1.actor, MARKS.Commander)) {
                    bonusCritical += 1;
                }
                tmp = new Roll(`${critical + bonusCritical}d10`);
                await tmp.evaluate();
                let damage = tmp.total + (3 * ctx1.effectCount("Critical DMG+"));
                await ctx1.actor.setStatus("Poise", 0);
                await ctx1.actor.setStatus("Critical", 0);
                await ctx2.actor.takeDamageStatus(damage, "Poise", null, `Received a [/status/Critical] Critical hit for %DMG% HP damage! (%PHP% -> %HP%)`);
                await ctx1.fireEvent("Critical Hit");
                landedCrit = true;
                totalAssassinationDamage += 3;
            }
            else {
                createEffectsMessage(ctx1.actor.name, `Rolled ${roll}, failed [/status/Poise] Poise check!`);
            }
        }

        let smoke = ctx2.actor.getStatusCount("Smoke");

        if (smoke > 0) {
            let damage = Math.max(Math.floor(smoke / 2), 1);
            await ctx2.actor.takeDamageStatus(damage, "Smoke", null, `Takes %DMG% extra HP damage from [/status/Smoke] Smoke! (%PHP% -> %HP%)`);
            if (ctx1.actor.augmentEffectCount("Dizzying Smog") > 0) {
                damage = Math.max(Math.floor(damage / 2), 1);
                await ctx2.actor.takeDamageStatus(damage, "none", "ST", `Takes %DMG% extra ST damage from [/status/Smoke] Smoke due to Dizzying Smog! (%PST% -> %ST%)`);
            }
        }

        if (ctx1.actor.augmentEffectCount("Puffy Brume") > 0) {
            let smoke = ctx1.actor.getStatusCount("Smoke");
            let damage = Math.max(Math.floor(smoke / 2), 1);
            await ctx2.actor.takeDamageStatus(damage, "none", null, `Takes %DMG% extra HP damage from [/status/Smoke] Smoke due to Puffy Brume! (%PHP% -> %HP%)`);
        }

        if (ctx1.hasEffect("Fumigate")) {
            let smoke = ctx1.actor.getStatusCount("Smoke");
            if (smoke > 0) {
                await ctx1.actor.setStatus("Smoke", 0);
                await ctx2.actor.takeDamageStatus(smoke, "none", null, `Takes %DMG% extra HP damage from [/status/Smoke] Smoke due to Fumigate! (%PHP% -> %HP%)`);
            }
        }

        let attackerTriggers = ["On Use", "Clash Win"];
        if (landedCrit) {
            attackerTriggers.push("On Crit");
        }

        if (landedDevastating) {
            attackerTriggers.push("Devastating Hit");
        }

        if (!ctx1.ignoreClashEffects && !ctx2.ignoreClashEffects) {
            await ctx1.fireEvent("Clash Win Instant");
            await ctx2.fireEvent("Clash Lose Instant");
        }

        if (ctx1.flags.includes("IgnoreInfliction")) {
            ctx2.ignoringInflictions = true;
        }

        if (ctx2.flags.includes("IgnoreInfliction")) {
            ctx1.ignoringInflictions = true;
        }

        let ctx1R = ctx1.flags.includes("Reflective Barrier");
        let ctx2R = ctx2.flags.includes("Reflective Barrier");

        if (ctx1R) {
            ctx1.flags = ctx1.flags.filter(x => x != "Reflective Barrier");
            ctx2.flags.push("Reflective Barrier");
        }

        if (ctx2R) {
            ctx2.flags = ctx2.flags.filter(x => x != "Reflective Barrier");
            ctx1.flags.push("Reflective Barrier");
        }
        
        let bursts = await pollUserInputBurst(ctx1.actor, ctx2.actor);

        if (bursts.sinkingBurst) {
            await ctx1.fireEvent("Sinking Burst");
            await ctx2.actor.fireStatusEffect("Sinking");
            attackerTriggers.push("Sinking Burst");
        }

        if (bursts.tremorBurst) {
            await ctx1.fireEvent("Tremor Burst");
            await ctx2.actor.fireStatusEffect("Tremor");
            attackerTriggers.push("Tremor Burst");
            totalAssassinationDamage += 3;
        }

        if (bursts.ruptureBurst) {
            await ctx1.fireEvent("Rupture Burst");
            await ctx2.actor.fireStatusEffect("Rupture");
            attackerTriggers.push("Rupture Burst");
            totalAssassinationDamage += 3;
        }

        if (ctx2.actor.hasMarkApplied(ctx1.actor, MARKS.Commander) && !landedCrit) {
            ctx1.triggers["Clash Win"].applyInfliction("Poise", 1, false);
        }

        if (ctx1.actor.augmentEffectCount("Feedback Loop") > 0) {
            let charge = ctx1.getChargeCosts();
            if (charge > 12) {
                charge = 12;
            }

            ctx1.triggers["Clash Win"].applyInfliction("Charge", charge, false);
        }

        await ctx1.actor.handleClashEmotion(ctx1.actor, ctx1.triggers, ctx2.actor, ctx2.result == "X", ctx1);
        await ctx2.actor.handleClashEmotion(ctx2.actor, ctx2.triggers, ctx1.actor, ctx2.result == "X", ctx2);

        if (!ctx1.ignoreClashEffects && !ctx2.ignoreClashEffects) {
            createEffectsMessage(ctx1.actor.name, await ctx1.resolveTriggers(attackerTriggers), true);
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

        if (ctx1.target.hasMarkApplied(ctx1.actor, MARKS.Assassination)) {
            await ctx2.actor.takeDamageStatus(totalAssassinationDamage, "none", "HP", `Takes %DMG% HP damage from Target for Assassination! (%PHP% -> %HP%)`);
        }

        if (ctx1.target.hasMarkApplied(ctx1.actor, MARKS.Subjugation)) {
            await ctx2.actor.takeDamageStatus(2, "none", "SP", `Takes %DMG% SP damage from Target for Subjugation! (%PSP% -> %SP%)`);
            await ctx1.actor.heal(0, 0, 2);
        }

        if (pendingStagger[ctx2.actor.name] != null) {
            if (pendingStagger[ctx2.actor.name]) {
                await ctx2.actor.stagger();
                pendingStagger[ctx2.actor.name] = false;
            }
        }

        if (pendingSmokeVeil[ctx2.actor.name] != null) {
            if (pendingStagger[ctx2.actor.name]) {
                await ctx2.setStatus("Smoke", 0);
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

    async handleClashEmotion(actor, triggers, target, oneSided, context) {
        let ignoreLoss = context.ignoreEmotionLoss;
        if (actor.checkDisposition("Protective") && context.protect) {
            ignoreLoss = true;
        }

        if (actor.checkDisposition("Possessive")) {
            if (context.protect) {
                triggers["On Use"].emotion += 1;
            }
            
            if (context.bondTarget) {
                triggers["Clash Win"].emotion += 1;
            }
        }

        if (actor.checkDisposition("Vengeful") && context.defTwoHandedFree) {
            triggers["On Use"].emotion += 1;
            ignoreLoss = true;
        }

        if (!actor.checkDisposition("Gloomy")) {
            triggers["Clash Win"].emotion += 1;
            if (!ignoreLoss) triggers["Clash Lose"].emotion -= 1;
        }

        if (actor.checkDisposition("Masochistic") && oneSided) {
            triggers["Clash Lose"].emotion += 3;
        }

        if (actor.checkDisposition("Gloomy")) {
            let kill = actor.system.attributes.health.value <= 0 && targetHP[target.id] > 0;
            let stagger = actor.system.attributes.stagger.value <= 0 && targetST[target.id] > 0;
            let ignoreOS = actor.checkImpassioned("Gloomy") && oneSided;
            if (!kill && !stagger && !ignoreOS) {
                if (!ignoreLoss) triggers["Clash Win"].emotion -= 1;
            }

            triggers["Clash Lose"].emotion += 1;
        }

        if (actor.checkDisposition("Focused") && actor.isMarkedTarget(target)) {
            triggers["Clash Win"].emotion += 1;
        }

        if (actor.checkDisposition("Wrathful") && context.skillUsed) {
            triggers["Clash Win"].emotion += 1;
        }

        if (actor.system.attributes.health.value <= 0 && targetHP[target.id] > 0) {
            if (actor.checkDisposition("Focused") && actor.isMarkedTarget(target)) {
                triggers["Clash Win"].emotion += 1;
            }

            if (actor.checkDisposition("Wrathful") && context.skillUsed) {
                triggers["Clash Win"].emotion += 1;
            }
        }

        if (actor.system.attributes.stagger.value <= 0 && targetST[target.id] > 0) {
            if (actor.checkDisposition("Focused") && actor.isMarkedTarget(target)) {
                triggers["Clash Win"].emotion += 1;
            }

            if (actor.checkDisposition("Wrathful") && context.skillUsed) {
                triggers["Clash Win"].emotion += 1;
            }
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

        if (systemData.mostRecentRoll == null || context.result > systemData.mostRecentRoll.context.result) {
            if (context.attackType == "Ranged" || context.type == "Ranged") {
                let feeder = context.actor.augmentEffectCount("Belt Feeder");
                if (feeder > 0) {
                    let bullets = await pollUserInputText(context.actor, `Belt Feeder: Select bullet count to spend for bonus damage (${2 + (feeder - 1)} DMG per bullet)`, `Bullets to consume`, "number", 12 / (2 + (feeder - 1)), 0);
                    let extra = Number(bullets) * (2 + (feeder - 1));
                    damage += extra;
                    createEffectsMessage(context.actor, `Spends ${bullets} bullets to deal ${extra} additional damage!`);
                }
            }
        }

        if (systemData.mostRecentRoll != null && systemData.mostRecentRoll.type != "None" && canRespond) {
            const respCtx = new RollContext();
            Object.assign(respCtx, systemData.mostRecentRoll.context);
            respCtx.fix();
            this.processIgnorePower(context, respCtx);

            if (respCtx.type != "Block" && respCtx.type != "Evade" && respCtx.hand == "Defensive 1H") {
                let conv = await pollUserInputConfirm(this, "Convert Defensive 1-Handed attack to a Block?");

                if (conv) {
                    respCtx.type = "Block";
                    systemData.mostRecentRoll.type = "Block";
                    await this.convertQueuedRoll();
                    createEffectsMessage(this.name, `Converts their Counter into a Block!`);

                    if (this.checkDisposition("Anxious")) {
                        let pe = this.system.emotion;
                        await this.gainEmotion(2);
                        let e = this.system.emotion;
                        createEffectsMessage(this.name, `Gains 2 Emotion from Anxious! (${pe} -> ${e})`)
                    }
                }
            }

            if (systemData.mostRecentRoll.type == "Block") {
                damage -= respCtx.result;
                if (damage < 0) {
                    damage = 0;
                }

                await this.takeDamage(damage, context, 0, 0, 0, false, respCtx);
            }

            if (systemData.mostRecentRoll.type == "Evade") {
                if (respCtx.flags.includes("Elusive")) {
                    let poise = ctx1.actor.getStatusCount("Poise");
                    if (poise > 0 && !this.system.poisePaused) {
                        let tmp = new Roll(this.getCritRoll(respCtx));
                        await tmp.evaluate();
                        let roll = tmp.total;

                        if (roll <= poise) {
                            tmp = new Roll(`${critical}d10`);
                            await tmp.evaluate();
                            await selfCtx.actor.setStatus("Poise", 0);
                            await selfCtx.actor.setStatus("Critical", 0);
                            await selfCtx.fireEvent("Critical Hit");
                            createEffectsMessage(respCtx.actor.name, `[/status/Critical] Elusive grants ${Math.floor(tmp.total) / 2} SQR of movement!`);
                            await this.update({ "system.movement": Number(this.system.movement) + Math.floor(tmp.total / 2) }, { diff: false });
                        }
                        else {
                            createEffectsMessage(respCtx.actor.name, `Rolled ${roll}, failed [/status/Poise] Poise check!`);
                        }
                    }
                }

                if (respCtx.result >= context.result) {
                    let pst = this.system.attributes.stagger.value;
                    await this.heal(0, respCtx.result, 0);
                    let st = this.system.attributes.stagger.value;
                    createEffectsMessage(this.name, `Recovers ${respCtx.result} ST from Evade! (${pst} -> ${st})`);
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
                    await this.takeDamage(damage, context, 0, 0, 0, false, respCtx);
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

    async takeDamage(damage, context, flatHP = 0, flatST = 0, flatSP = 0, silent = false, selfCtx = null) {
        let hp = this.system.attributes.health.value + this.system.attributes.health.temp;
        let st = this.system.attributes.stagger.value + this.system.attributes.stagger.temp;
        let sp = this.system.attributes.sanity.value + this.system.attributes.sanity.temp;

        if (selfCtx != null && selfCtx.hasEffect("Lowered Guard")) {
            let guard = selfCtx.effectCount("Lowered Guard");

            if (this.getStatusCount("Sinking") >= guard) {
                await this.applyStatus("Protection", guard * 2, 0);
                await this.applyStatus("Stagger_Protection", guard * 2, 0);
            }
        }

        let snipersMarkLine = "";
        let markDamage = 0;
        if (selfCtx != null && this.hasMarkApplied(context.actor, MARKS.Sniper)) {
            let distance = getDistance(this, context.actor) - 4;
            if (distance > 0) {
                markDamage = distance;
                snipersMarkLine = `Increased by ${markDamage} from Sniper's Mark`;
            }
        }
        
        let smokeVeilLine = "";
        let veilResistance = 0;
        if (selfCtx != null && this.augmentEffectCount("Smoke Veil") > 0) {
            let smoke = this.getStatusCount("Smoke");
            if (await pollUserInputConfirm(this, "Spend all [/status/Smoke] Smoke to reduce incoming stagger damage by half?")) {
                veilResistance = Math.floor(smoke / 2);
                await this.setStatus("Smoke", 0);
                
                if (veilResistance > 0) {
                    smokeVeilLine = `Reduced by ${veilResistance} from Smoke Veil`;
                }
            }
        }

        let prevHP = hp;
        let prevST = st;
        let prevSP = sp;

        let protTextHP = [];
        let protTextST = [];

        let resist = this.augmentEffectCount(`Damage Resistance`) + this.outfitEffectCount(`Damage Resistance`);
        let resText = "";

        if (selfCtx != null && selfCtx.flags.includes("Bulwark Defense")) {
            let poise = ctx1.actor.getStatusCount("Poise");
            if (poise > 0 && !this.system.poisePaused) {
                let tmp = new Roll(this.getCritRoll(selfCtx));
                await tmp.evaluate();
                let roll = tmp.total;

                if (roll <= poise) {
                    tmp = new Roll(`${critical}d10`);
                    await tmp.evaluate();
                    await selfCtx.actor.setStatus("Poise", 0);
                    await selfCtx.actor.setStatus("Critical", 0);
                    await selfCtx.fireEvent("Critical Hit");
                    createEffectsMessage(selfCtx.actor.name, `[/status/Critical] Bulwark Defense reduces incoming damage by ${tmp.total}!`);
                    resist += tmp.total;
                }
                else {
                    createEffectsMessage(selfCtx.actor.name, `Rolled ${roll}, failed [/status/Poise] Poise check!`);
                }
            }
        }

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
            let hpDmg = this.getModifiedDamage(context, damage + markDamage, null);
            let stDmg = this.getModifiedDamage(context, damage, "ST");
            stDmg = Math.max(stDmg - veilResistance, 0);
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
                (${snipersMarkLine})
                (${protTextHP[0] != null ? protTextHP[0] : ""})
                (${protTextHP[1] != null ? protTextHP[1] : ""})

                ${damage}${resText} x ${this.findResistance(context.damageType, "ST")} = ${this.getModifiedDamage(context, damage, "ST")} ST damage taken. (${prevST} -> ${st})
                (${protTextST[0] != null ? protTextST[0] : ""})
                (${smokeVeilLine})
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

    async updateQueuedRoll(target) {
        const system = this.toObject(false).system;
        
        if (system.mostRecentRoll != null) {
            system.mostRecentRoll.context.target = target.id;
        }

        await this.update({ system }, { diff: false });
    }

    async convertQueuedRoll() {
        const system = this.toObject(false).system;
        
        if (system.mostRecentRoll != null) {
            system.mostRecentRoll.type = "Block";
            system.mostRecentRoll.context.type = "Block";
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

    async cachePrimerEffects(incoming) {
        const system = this.toObject(false).system;
        if (system.primerEffects == null) {
            system.primerEffects = [];
        }

        system.primerEffects = system.primerEffects.filter(x => x.id != incoming.actor.id);
        let data = {
            id: incoming.actor.id,
            effects: []
        };

        let primerValidEffects = [
            "Armor Decay", "[Type] Deterioration", "Devastating Force", "Devastating Shock",
            "Debilitate", "Wasting Curse", "Slowing Curse", "Exposing Curse", "Spreading Curse",
        ];

        for (const effect of incoming.effects) {
            if (primerValidEffects.includes(effect.name)) {
                data.effects.push(effect);
            }
        }

        system.primerEffects.push(data);
        await this.update({ system }, { diff: false });
    }

    async loadPrimerEffects(context) {
        let actor = context.actor;
        let actorToken = canvas.tokens.placeables.filter(x => x.actor._id == actor._id);

        if (actorToken == null) return;

        if (this.system.primerEffects == null) {
            return;
        }

        let primers = this.system.primerEffects.filter(x => {
            let token = canvas.tokens.placeables.filter(y => y.actor._id == x.id);

            if (token != null && token.disposition == actorToken.disposition) {
                return true;
            }

            return false;
        });

        for (let primer of primers) {
            await context.loadPrimerEffects(primer.effects);
        }
    }

    async handleNextRound() {
        if (this.augmentEffectCount("Soothing Mist") > 0) {
            let smoke = Math.floor(this.getStatusCount("Smoke") / 4);
            if (smoke > 0) {
                let php = this.system.attributes.health.value;
                await this.heal(0, 0, smoke);
                let hp = this.system.attributes.health.value;
                createEffectsMessage(this.name, `Recovered ${smoke} HP from Soothing Mist! (${php} -> ${hp})`);
            }
        }
        
        if (this.augmentEffectCount("Thermal Generator") > 2) {
            let burn = Math.floor(this.getStatusCount("Burn") / 2);

            if (burn > 0) {
                this.applyStatus("Charge", burn);
                createEffectsMessage(this.name, `Gains ${burn} [/status/Charge] Charge from Thermal Generator!`);
            }
        }

        await this.fireStatusEffects(Triggers.END);
        await this.fireStatusEffects(Triggers.AFTER_DECAY);
        await this.setStatus("Sinking", 0);
        await this.setStatus("Rupture", 0);
        await this.setStatus("Tremor", 0);

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

        system.poisePaused = false;
        system.ruinPaused = false;
        system.primerEffectsList = [];

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
    }

    checkDisposition(dispo) {
        return this.system.disposition == dispo || (this.system.secondaryDisposition == dispo && this.augmentEffectCount("Multifaceted") > 0);
    }

    checkImpassioned(dispo) {
        return this.system.disposition == dispo && this.augmentEffectCount("Impassioned") > 0;
    }

    async gainEmotion(count) {
        const system = this.toObject(false).system;

        system.emotion = Number(system.emotion) + count;

        await this.update({ system }, { diff: false, render: true });
    }

    async loseEmotion(count) {
        const system = this.toObject(false).system;

        system.emotion = Number(system.disposition) - count;
        if (system.emotion < 0) {
            system.emotion = 0;
        }

        await this.update({ system }, { diff: false, render: true });
    }

    async handleNextTurn() {
        let sinking = this.getStatusCount("Sinking");
        if (sinking > 0 && this.augmentEffectCount("Torment Nexus") > 0) {
            await this.applyStatus("Charge", sinking);
            createEffectsMessage(this.name, `Gains ${sinking} [/status/Charge] Charge from Torment Nexus!`);
        }

        let kMovement = Math.max(this.system.movement - this.system.kineticStorageMovement, 0);
        let speed = this.getStatusCount("Haste") + this.getStatusCount("Bind");
        speed += 2 * this.augmentEffectCount("EMA");
        speed += this.system.nextRoundMovement;
        if (this.augmentEffectCount("Kinetic Storage") > 0) {
            speed += kMovement;
        }

        if (this.augmentEffectCount("Deserter") && getAlliesWithinRadius(this, 2).length == 0) {
            speed += 3;
            createEffectsMessage(this.name, "Gains 3 SQR of movement from Deserter!");
        }

        await this.update({ "system.movement": 6 + speed }, { diff: false });
        await this.update({ "system.nextRoundMovement": 0 }, { diff: false });
        await this.update({ "system.kineticStorageMovement": kMovement }, { diff: false });

        let reactions = Number(this.system.attributes.rank.value) + this.augmentEffectCount("Additional Reaction") + this.outfitEffectCount("Additional Reaction");
        await this.update({ "system.reactions": reactions }, { diff: false });

        let actions = Math.max(Math.ceil(Number(this.system.attributes.rank.value) / 2), 1);
        await this.update({ "system.actions": actions }, { diff: false });

        await this.updateOverheatedWeapons();
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

    getCanUseItem(item) {
        return this.system.overheatedWeapons.filter(x => x.id == item.id).length == 0;
    }

    async overheatWeapon(item) {
        let weapon = {
            id: item.id,
            rounds: 2
        };

        const system = this.toObject(false).system;

        let existing = system.overheatedWeapons.find(x => x.id == item.id);
        if (existing != null) {
            existing.rounds = Number(existing.rounds) + 1;
        }
        else {
            system.overheatedWeapons.push(weapon);
        }

        await this.update({ system }, { diff: false, render: true });
    }

    async updateOverheatedWeapons() {
        const system = this.toObject(false).system;

        for (let weapon of system.overheatedWeapons) {
            weapon.rounds = Number(weapon.rounds) - 1;
        }

        system.overheatedWeapons = system.overheatedWeapons.filter(x => x.rounds > 0);

        await this.update({ system }, { diff: false, render: true });
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

        if (this.augmentEffectCount("Indomitable") > 0 && !this.system.indomitableSpent) {
            const system2 = this.toObject(false).system;
            system2.attributes.stagger.value = system2.attributes.stagger.max;
            system2.staggerRounds = 0;
            system2.staggered = false;
            await this.update({ system2 }, { diff: false, render: true });
            createEffectsMessage(this.name, `${this.name} is Indomitable! Recovered from stagger.`);
        }
    }

    async takeForceDamage(dice, context = null) {
        if (context != null && context.actor != null) {
            if (context.actor.augmentEffectCount("Explosive Force") > 0) {
                dice += 3 + context.actor.system.attributes.rank.value;
            }

            if (context.actor.augmentEffectCount("Slamdown") > 0) {
                await this.applyStatus("Tremor", dice, 0);
                createEffectsMessage(context.actor.name, `Inflicts ${dice} [/status/Tremor] Tremor from Slamdown!`);
            }
        }

        let modifier = this.outfitEffectCount("Impact Guard") + this.augmentEffectCount("Steady");
        let damage = new Roll(`${dice}d${8+modifier}`);
        await damage.evaluate();
        await this.takeDamageStatus(damage.total, "Force", "HP", "Received %DMG% HP in Force Damage! (%PHP% -> %HP%)");
    }

    async applyStatus(status, count = 0, nextRoundCount = 0, ignoreSmokeCap = false) {
        count = Math.floor(count);
        nextRoundCount = Math.floor(nextRoundCount);
        const system = this.toObject(false).system;

        let type = system.statusEffects.find(x => x.name == status);

        if (status == "Smoke") {
            let cap = 10;
            let overflow = this.augmentEffectCount("Smoke Overflow");
            if (overflow > 0) {
                cap = 8 + (overflow * 4);
            }

            if (count + this.getStatusCount("Smoke") > cap && !ignoreSmokeCap) {
                count = Math.max(cap - this.getStatusCount("Smoke"), 0);
            }
        }

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

        await this.verifyStatusRelation("Poise", "Critical");
        await this.verifyStatusRelation("Ruin", "Devastation");
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

        await this.verifyStatusRelation("Poise", "Critical");
        await this.verifyStatusRelation("Ruin", "Devastation");
    }

    async verifyStatusRelation(mainStatus, correlatedStatus) {
        let c1 = this.getStatusCount(mainStatus);
        let c2 = this.getStatusCount(correlatedStatus);

        if (c2 > 0 && c1 <= 0) {
            await this.setStatus(correlatedStatus, 0);
        }

        if (c1 > 0 && c2 <= 0) {
            await this.applyStatus(correlatedStatus, 1);
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

        await this.verifyStatusRelation("Poise", "Critical");
        await this.verifyStatusRelation("Ruin", "Devastation");
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

        if (count <= 0) {
            return;
        }

        if (status == "Charge_Barrier" && this.system.maintainedBarrier) {
            await this.setStatus(status, Math.max(Math.floor(count / 2), 1));
            await this.setMaintainedBarrier(false);
            await def.activation(this);
            return;
        }

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

        let decay = def.decay(count);

        if (status == "Smoke" && this.augmentEffectCount("Steam Engine") > 0) {
            let amount = count - decay;
            if (amount > 0) {
                await this.applyStatus("Charge", amount);
                createEffectsMessage(this.name, `Gains ${amount} [/status/Charge] Charge from Steam Engine!`);
            }
        }

        await this.setStatus(status, decay);
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

    async handleMarkAid(actor, hp = 3) {
        if (actor.hasMarkApplied(this, MARKS.Aid)) {
            await actor.heal(hp, 0, 0);
            createEffectsMessage(actor.name, `Recovers ${hp} HP from ${this.name}'s Target for Aid!`);
        }
    }

    async spendAction(triggerBleed = true, free = false) {
        if (!free) {
            let actions = Number(this.system.actions);
            await this.update({ "system.actions": Math.max(actions - 1, 0)}, { diff: false });
            createEffectsMessage(this.name, `Spends 1 Action! (${actions} -> ${Math.max(actions - 1, 0)})`)
        }
        if (triggerBleed) {
            await this.fireStatusEffects(Triggers.ACTION);
        }
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

    async performReduceStatus(source, count) {
        if (this.hasMarkApplied(null, MARKS.Fanaticism)) {
            count = Math.max(Math.floor(count / 2), 0);
        }

        let data = await pollReduceStatus(this, source, count, this.system.statusEffects);
        let text = "";

        let totalReduction = 0;

        for (let status in data) {
            if (Object.prototype.hasOwnProperty.call(data, status)) {
                let count = data[status];
                if (count <= 0) continue;

                totalReduction += count;

                let prev = this.getStatusCount(status);
                await this.reduceStatus(status, count);
                text = text + `[/status/${status}] ${status.replace("_", " ")} reduced by ${count} (${prev} -> ${prev - count})` + "\n";
            }
        }

        createEffectsMessage(this.name, text);

        return totalReduction;
    }

    getReduceStatusCount() {
        return (Number(this.system.abilities.Justice.value) + Number(this.system.attributes.rank.value)) * 2;
    }

    async getAvailableMarks() {
        let marks = [];
        for (const [id, name] of Object.entries(MarkNames)) {
            if (this.getOutgoingMarkCount(id) < this.augmentEffectCount(name)) {
                marks.push(id);
            }
        }

        return marks;
    }

    async getAllMarks() {
        let marks = [];
        for (const [id, name] of Object.entries(MarkNames)) {
            marks.push(id);
        }

        return marks;
    }

    getOutgoingMarkCount(markType) {
        return this.system.outgoingMarks.filter(x => x.source == this.id && x.id == markType).length;
    }

    async pushToOutgoing(mark) {
        const system = this.toObject(false).system;
        system.outgoingMarks.push(mark);
        await this.update({ system }, { diff: false, render: true });
    }

    async removeFromOutgoing(predicate) {
        const system = this.toObject(false).system;
        system.outgoingMarks = system.outgoingMarks.filter(predicate);
        await this.update({ system }, { diff: false, render: true });
    }

    async applyMark(source, markType) {
        const system = this.toObject(false).system;

        let mark = new Mark(source.id, this.id, markType);

        system.incomingMarks.push(mark);

        await this.update({ system }, { diff: false, render: true });

        await source.pushToOutgoing(mark);
    }

    async removeMark(source, markType) {
        const system = this.toObject(false).system;

        system.incomingMarks = system.incomingMarks.filter(x => !(x.source == source.id && x.id == markType));

        await this.update({ system }, { diff: false, render: true });

        await source.removeFromOutgoing(x => !(x.source == source.id && x.id == markType));
    }

    hasMarkApplied(source, markType) {
        return this.system.incomingMarks.filter(x => (source == null || (x.source == source.id)) && x.id == markType).length > 0;
    }

    isMarkedTarget(target) {
        return this.system.outgoingMarks.filter(x => x.target == target.id).length > 0;
    }

    getAllMarkSources(markType) {
        let marks = this.system.incomingMarks.filter(x => x.id == markType);
        let actors = [];

        for (let mark of marks) {
            actors.push(findByID(mark.source));
        }
    }

    async handleLoadedBranding(target) {
        let marks = await this.getAllMarks();

        let options = [];
        let map = {};

        for (let mark of marks) {
            if (target.hasMarkApplied(this, mark)) {
                continue;
            }
            
            map[MarkNames[mark]] = mark;
            options.push({
                name: MarkNames[mark],
                icon: null
            });
        }

        if (options.length == 0) {
            ui.notifications.info("You have no available marks!");
            return
        }

        let type = await pollUserInputOptions(this, "Select a Mark to apply.", options, 0);
        type = map[type];

        await target.applyMark(this, type);
        createEffectsMessage(this.name, `Applied ${MarkNames[type]} to ${target.name}!`);
    }

    async handleApplyMark() {
        if (game.user.targets.first() == null) {
            ui.notifications.info("You need a target to mark!");
            return
        }

        let target = game.user.targets.first().actor;

        let marks = await this.getAvailableMarks();

        let options = [];
        let map = {};

        for (let mark of marks) {
            if (target.hasMarkApplied(this, mark)) {
                continue;
            }
            
            map[MarkNames[mark]] = mark;
            options.push({
                name: MarkNames[mark],
                icon: null
            });
        }

        if (options.length == 0) {
            ui.notifications.info("You have no available marks!");
            return
        }

        let type = await pollUserInputOptions(this, "Select a Mark to apply.", options, 0);
        type = map[type];

        await target.applyMark(this, type);
        createEffectsMessage(this.name, `Applied ${MarkNames[type]} to ${target.name}!`);
    }

    async setMaintainedBarrier(val) {
        const system = this.toObject(false).system;
        system.maintainedBarrier = val;
        await this.update({ system }, { diff: false, render: true });
    }

    async refreshMacroBar() {
        let oCtx = this.getOutfitContext();
        let aCtx = this.getAugmentContext();

        for (let i = 1; i <= 50; i++) {
            await game.user.assignHotbarMacro(null, i);
        }

        await registerEffectMacro("Take Action", async (actor) => {
            let type = await pollUserInputOptions(actor, "What action do you want to take?", [
                { name: "Attack", icon: "icons/Attack.png" },
                { name: "Dash", icon: "icons/Dash.png" },
                { name: "Use Skill", icon: "resources/LightIcon.webp" },
                { name: "Reduce Status", icon: "icons/Reduce_Status.png" },
                { name: "Mark", icon: "icons/Mark.png" },
                { name: "Spend Action", icon: "icons/Discard_Reaction.png" }
            ]);

            switch (type) {
                case "Attack":
                    await getAttackOptions(actor);
                    break;
                case "Use Skill":
                    await getSkillOptions(actor);
                    break;
                case "Dash":
                    let movement = Number(actor.system.movement);
                    let extraMovement = 3 + actor.system.abilities.Justice.value + this.outfitEffectCount("Light Material");
                    if (this.augmentEffectCount("Double Time") > 0) {
                        extraMovement += 3;
                    }
                    await actor.update({ "system.movement": movement + extraMovement });
                    createEffectsMessage(actor.name, `Gains ${extraMovement} extra movement from dashing! (${movement} -> ${movement + extraMovement})`);
                    await actor.spendAction(false);
                    break;
                case "Reduce Status":
                    await actor.performReduceStatus("Reduce Status", actor.getReduceStatusCount());
                    await actor.spendAction(false);
                    break;
                case "Mark":
                    await actor.handleApplyMark();
                    break;
                case "Spend Action":
                    await actor.spendAction(true);
                    break;
            }
        }, "icons/Take_Action.png");

        await registerEffectMacro("Discard Reaction", async (actor) => {
            let reactions = Number(actor.system.reactions);
            await actor.update({ "system.reactions": Math.max(reactions - 1, 0) }, { diff: false });
            createEffectsMessage(actor.name, `Spends 1 Reaction! (${reactions} -> ${Math.max(reactions - 1, 0)})`);
        }, "icons/Discard_Reaction.png");

        if (this.augmentEffectCount("Concentrated Overcharge") > 0 || this.augmentEffectCount("Meditation") > 0) {
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

        if (this.augmentEffectCount("Integrated Boosters") > 0) {
            await registerEffectMacro("Integrated Boosters", async (actor) => {
                let charge = await actor.getStatusCount("Charge");
                let cost = 3 * actor.augmentEffectCount("Integrated Boosters");

                if (charge >= cost) {
                    await actor.reduceStatus("Charge", cost);
                    await actor.update({ "system.movement": Number(actor.system.movement) + (cost / 3)}, { render: true, diff: false });
                    createEffectsMessage(actor.name, `Spends ${cost} [/status/Charge] Charge to gain ${cost / 3} SQR of movement!`)
                }
                else {
                    ui.notifications.info(`You need at least ${cost} Charge, but you only have ${charge}!`);
                }
            },
        "icons/Integrated_Boosters.png");
        }

        if (this.augmentEffectCount("Ice Skater") > 0) {
            await registerEffectMacro("Ice Skater", async (actor) => {
                let frostbite = await actor.getStatusCount("Frostbite");
                let cost = actor.augmentEffectCount("Ice Skater");

                if (frostbite >= cost) {
                    await actor.reduceStatus("Frostbite", cost);
                    await actor.update({ "system.movement": Number(actor.system.movement) + cost}, { render: true, diff: false });
                    createEffectsMessage(actor.name, `Burns ${cost} [/status/Frostbite] Frostbite to gain ${cost} SQR of movement!`)
                }
                else {
                    ui.notifications.info(`You need at least ${cost} Frostbite, but you only have ${frostbite}!`);
                }
            },
        "icons/Ice_Skater.png");
        }

        if (this.augmentEffectCount("Detox") > 0) {
            await registerEffectMacro("Detox", async (actor) => {
                let charge = await actor.getStatusCount("Charge");

                if (charge > 2) {
                    charge = Math.floor(charge / 2);

                    let reduction = await actor.performReduceStatus("Detox", charge);
                    createEffectsMessage(actor.name, `Spends ${reduction * 2} [/status/Charge] Charge to use Detox!`);
                    await actor.reduceStatus("Charge", reduction * 2);
                }
                else {
                    ui.notifications.info(`You have no Charge!`);
                }
            },
        "icons/Detox");
        }

        for (const macro of oCtx.macros) {
            await registerEffectMacro(macro.name, macro.callback, macro.img);
        }

        for (const macro of aCtx.macros) {
            await registerEffectMacro(macro.name, macro.callback, macro.img);
        }
    }
}
