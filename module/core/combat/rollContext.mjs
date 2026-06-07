import { getBloodfeast, searchByObject, searchForActor } from "../../pmttrpg.mjs";
import { weaponEffects } from "../effects/weaponEffects.mjs";
import { outfitEffects } from "../effects/outfitEffects.mjs";
import { getEffectsArray } from "../effects/effectHelpers.mjs";
import { currentRound } from "./combatState.mjs";
import { MARKS } from "../status/mark.mjs";
import { bulletList } from "../effects/bullets.mjs";
import { pollUserInputConfirm, pollUserInputOptions } from "../helpers/dialog.mjs";
import { calculateTechniqueCost } from "../../sheets/item.mjs";

const triggerTypes = ["Round End", "Clash Win", "Clash Lose", "On Use", "Always Active", "On Crit", "Devastating Hit", "Tremor Burst", "Sinking Burst", "Rupture Burst", "Augment Passive", "Combat Start", "Round Start", "Effective Heal"];
const eventTypes = ["Before Attack", "Round End", "Kill", "Combat Start", "Round Start", "Devastating Hit", "Critical Hit", "Tremor Burst", "Sinking Burst", "Rupture Burst", "Clash Win", "Clash Lose", "On Use", "Clash Win Instant", "Clash Lose Instant"];
const statusPlusValid = ["Burn", "Bleed", "Frostbite", "Sinking", "Tremor", "Rupture", "Poise", "Ruin"];

export class RollContext {
    constructor() {
        this.diceMax = 10;
        this.dicePower = 0;
        this.enemyPowerMod = 0;
        this.triggers = {};
        this.target = null;
        this.diceCount = 1;
        this.effects = [];
        this.result = 0;
        this.applyClashEffects = true;
        this.damageType = "Slash";
        this.name = "you shouldnt see this !";
        this.actor = null;
        this.target = null;
        this.attackType = "Melee";
        this.modifiers = null;
        this.costs = [];
        this.light = 0;
        this.messages = [];
        this.conditionals = [];
        this.activeConditionals = [];
        this.mustDeserialize = false;
        this.ignoreClashEffects = false;
        this.forcedAdvState = 0;
        this.events = {};
        this.enemyAdvState = 0;
        this.enemyModifierText = [];
        this.modifierText = [];
        this.flags = [];
        this.recycled = false;
        this.macros = [];
        this.critical = 0;
        this.poise = 0;
        this.devastation = 0;
        this.forcedBurst = [];
        this.forcedExcludeBurst = [];
        this.ignoringInflictions = false;
        this.recycledEvade = false;
        // power null stuff
        this.nonSkillDicePower = 0;
        this.skillDicePower = 0;
        this.alreadyAppliedPowerNull = false;
        //
        this.protect = false;
        this.ignoreEmotionLoss = false;
        this.bondTarget = false;
        this.defTwoHandedFree = false;
        this.skillUsed = false;
        this.defFollowup = false;
        this.reactive = false;
        //
        this.converted = false;
        //
        this.isReaction = false;
        //
        this.minRoll = 0;
        this.maxRoll = 0;
        //
        this.form = "";
        this.hand = "";
        //
        this.bonusAttackDamage = 0;

        for (const trigger of triggerTypes) {
            this.triggers[trigger] = new TriggerEvents();
        }

        for (const event of eventTypes) {
            this.events[event] = [];
        }
    }

    async fireEvent(event) {
        for (const ev of this.events[event]) {
            if (ev == null) {
                continue;
            }

            await ev(this);
        }
    }

    getRange() {
        if (this.form == "Psionic (M)") {
            return this.actor.system.abilities.Prudence.value + 1;
        }
        else if (this.form == "Psionic") {
            return this.actor.system.abilities.Prudence.value + this.actor.system.abilities.Insight.value;
        }

        if (this.type == "Melee") {
            let baseRange = 1;

            if (this.form == "Long") {
                baseRange += 1;
            }
            if (this.hasEffect("Increase Range")) {
                baseRange += 1;
            }

            return baseRange;
        }
        else {
            let baseRange = 10;
            baseRange += 2 * this.effectCount("Extra Range");
            return baseRange;
        }
    }

    prepareForSerialization() {
        this.mustDeserialize = true;

        if (this.actor != null) {
            this.actor = this.actor.system.id;
        }

        if (this.target != null) {
            this.target = this.target.system.id;
        }
    }

    prepareForDeserialization() {
        this.actor = searchForActor(this.actor);
        this.target = searchForActor(this.target);
        this.mustDeserialize = false;
    }

    fixTriggers() {
        for (let trigger of triggerTypes) {
            let data = this.triggers[trigger];
            this.triggers[trigger] = new TriggerEvents();
            Object.assign(this.triggers[trigger], data);
        }
    }

    hasEffect(name) {
        return this.effects.find(x => x.name == name) != null;
    }

    effectCount(name) {
        let effect = this.effects.find(x => x.name == name);

        if (effect != null) {
            return effect.count;
        }

        return 0;
    }

    mergeCosts() {
        let newCosts = [];
        for (let cost of this.costs) {
            let existing = newCosts.find(x => x.status == cost.status);
            if (existing) {
                existing.cost = Number(existing.cost) + cost.cost;
            }
            else {
                newCosts.push(cost);
            }
        }

        this.costs = newCosts;
    }

    shouldApplyCriticalConversion(triggers) {
        if (this.hasEffect("Critical Conversion")) {
            let poise = this.actor.getStatusCount("Poise");
            
            for (const trigger of triggers) { 
                let data = this.triggers[trigger];

                for (const infliction of data.inflictions) {
                    if (infliction.key == "Poise" && infliction.count < 0) {
                        poise += Number(Math.abs(infliction.count)); 
                    }
                }
            }

            if (poise >= 10) {
                this.negatePoise = true;
                return true;
            }
        }

        return false;
    }

    shouldApplyDevastationConversion(triggers) {
        if (this.hasEffect("Devastation Conversion")) {
            let ruin = this.target.getStatusCount("Ruin");
            for (const trigger of triggers) {
                let data = this.triggers[trigger];

                for (const infliction of data.inflictions) {
                    if (infliction.key == "Ruin" && infliction.count > 0) {
                        ruin += Number(infliction.count);
                    }
                }
            }

            if (ruin >= 10) {
                this.negateRuin = true;
                return true;
            }
        }

        return false;
    }

    isOffensive() {
        return this.damageType != "Evade" && this.damageType != "Block" && this.type != "Evade" && this.type != "Block";
    }

    async resolveInstantStatus(triggers) {
        let lines = [];
        let alreadyApplied = [];
        let totalAidHP = 0;

        for (const trigger of triggers) {
            let data = new TriggerEvents();
            Object.assign(data, JSON.parse(JSON.stringify(this.triggers[trigger])));
            data.modify = this.triggers[trigger].modify;

            for (const func of data.modify) {
                if (func != null) {
                    try {
                        await func(this, data);
                    }
                    catch (exception) {
                        console.log('roll context resolvetrigger error!');
                        console.log(exception);
                    }
                }
            }

            for (const infliction of data.inflictions) {
                let status = infliction.key;
                if (this.negatePoise && status == "Poise") continue;
                if (this.negateRuin && status == "Ruin") continue;
                
                if ((status == "Critical" || status == "Poise") && !this.hasEffect("Instant Crit")) { continue;}
                if ((status == "Devastation" || status == "Ruin") && !this.hasEffect("Instant Devastation")) { continue; }
                if ((status != "Critical" && status != "Poise") && (status != "Devastation" && status != "Ruin") && !this.hasEffect(`Instant ${status}`)) 
                { 
                    continue; 
                }

                let cur = Number(infliction.count);

                if (this.flags.includes("Reflective Barrier") && cur > 0) {
                    cur = -cur;
                }

                if (this.flags.includes("OC Vuln") && cur > 0) {
                    cur = 2 * cur;
                }

                if (this.flags.includes("Refractor-C") && statusPlusValid.includes(status)) {
                    cur += 1;
                }

                if (this.flags.includes("Refractor-O") && statusPlusValid.includes(status)) {
                    cur += 3;
                }

                let plusEffect = this.effects.find(x => x.name == `${infliction.key}+`);
                if (plusEffect != null) {
                    cur += Number(plusEffect.count);
                }

                if (this.actor.augmentEffectCount("Rekindled Embers") > 0 && infliction.key == "Burn") {
                    let thresholds = Math.min(Math.floor((max - stat) / (max * 0.25)), 3);
                    cur += thresholds;
                }

                if (this.actor.hasMarkApplied(this.target, MARKS.Crippling) && statusPlusValid.includes(status)) {
                    cur += 1;
                }

                if (this.hasEffect(`Instant ${infliction.key}`)) {
                    infliction.nextRound = false;
                }

                if (cur < 0) {
                    let prev = infliction.nextRound ? Number(this.actor.getStatusCountNext(status)) : Number(this.actor.getStatusCount(status));
                    await this.actor.applyStatus(status, infliction.nextRound ? 0 : Math.abs(cur), infliction.nextRound ? Math.abs(cur) : 0);
                    lines.push(`Gain ${Math.abs(cur)} [/status/${status.replace(" ", "_")}] ${status.replace("_", " ")}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + Math.abs(cur)})`);
                }
                else {
                    if (this.target != null && !this.ignoringInflictions) {
                        let prev = infliction.nextRound ? Number(this.target.getStatusCountNext(status)) : Number(this.target.getStatusCount(status));
                        await this.target.applyStatus(status, infliction.nextRound ? 0 : cur, infliction.nextRound ? cur : 0);
                        if (!alreadyApplied.includes(status)) {
                            alreadyApplied.push(status);
                            totalAidHP += 3;
                        }

                        lines.push(`Inflict ${cur} [/status/${status.replace(" ", "_")}] ${status.replace("_", " ")}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + cur})`);
                    }
                }
            }
        }

        if (this.target != null && totalAidHP > 0) {
            await this.actor.handleMarkAid(this.target, totalAidHP);
        }

        return this.append("", lines);
    }

    async resolveTriggers(triggers) {
        let lines = [];
        this.mergeCosts();
        if (this.costs != null) {
            for (const cost of this.costs) {
                let status = cost.status;
                if (status == "Bloodfeast") {
                    if (triggers.includes("Clash Win")) {
                        let val = this.actor.getModifiedBloodfeastCost(cost.cost);
                        let prev = getBloodfeast();
                        await this.actor.spendBloodfeast(val);
                        lines.push(`Consume ${val} [/status/${status.replace(" ", "_")}] ${status.replace("_", " ")} (${prev} -> ${prev - val})`);
                    }
                }
                else {
                    let prev = this.actor.getStatusCount(status);

                    await this.actor.reduceStatus(status, cost.cost);
                    lines.push(`Lose ${cost.cost} [/status/${status.replace(" ", "_")}] ${status.replace("_", " ")} (${prev} -> ${prev - cost.cost})`);
                }
            }
        }

        if (this.modifiers != null && this.modifiers.item != null) {
            if (this.actor.augmentEffectCount("Companion") > 0) {
                if (this.actor.augmentEffectCount("Companion - Striker") > 0) {
                    let count = this.actor.system.strikerPerkCount;

                    if (count < this.actor.system.abilities.Charm.value && await pollUserInputConfirm(this.actor, 
                        `Activate Striker Companion cost reduction? ${this.actor.system.abilities.Charm.value - count} uses remaining.`)
                    ) {
                        await (await this.actor.getLinkedActor()).deductLight(Math.max(Number(this.modifiers.item.system.light) - 1, 0));
                        await this.actor.update({ "system.strikerPerkCount": Number(count) + 1 });
                    }
                    else {
                        await (await this.actor.getLinkedActor()).deductLight(this.modifiers.item.system.light);
                    }
                }
                else {
                    await (await this.actor.getLinkedActor()).deductLight(this.modifiers.item.system.light);
                }
            }
            else {
                await this.actor.deductLight(this.modifiers.item.system.light);
            }
        }

        let alreadyApplied = [];
        let totalAidHP = 0;

        let totalEmotion = 0;

        for (const trigger of triggers) {
            let data = this.triggers[trigger];

            for (const func of data.modify) {
                if (func != null) {
                    try {
                        await func(this, data);
                    }
                    catch (exception) {
                        console.log('roll context resolvetrigger error!');
                        console.log(exception);
                    }
                }
            }

            data.mergeInflictions();

            if (data.hpHeal > 0 || data.spHeal > 0 || data.stHeal > 0) {
                let php = this.actor.system.attributes.health.value;
                let pst = this.actor.system.attributes.stagger.value;
                let psp = this.actor.system.attributes.sanity.value;
                await this.actor.heal(data.hpHeal, data.stHeal, data.spHeal, this.actor);
                let hp = this.actor.system.attributes.health.value;
                let st = this.actor.system.attributes.stagger.value;
                let sp = this.actor.system.attributes.sanity.value;

                if (data.hpHeal > 0) {
                    lines.push(`Recover ${data.hpHeal} HP (${php} -> ${hp})`);
                }

                if (data.stHeal > 0) {
                    lines.push(`Recover ${data.stHeal} ST (${pst} -> ${st})`);
                }

                if (data.spHeal > 0) {
                    lines.push(`Recover ${data.spHeal} SP (${psp} -> ${sp})`);
                }
            }

            if (data.hpDamage > 0) {
                let php = this.target.system.attributes.health.value;
                await this.target.takeDamage(0, null, Math.abs(data.hpDamage), 0, 0, true);
                let hp = this.target.system.attributes.health.value;
                lines.push(`Deal ${Math.abs(hpDamage)} HP damage (${php} -> ${hp})`);
            }

            if (data.stDamage > 0) {
                let php = this.target.system.attributes.stagger.value;
                await this.target.takeDamage(0, null, 0, Math.abs(data.stDamage), 0, true);
                let hp = this.target.system.attributes.stagger.value;
                lines.push(`Deal ${Math.abs(hpDamage)} ST damage (${php} -> ${hp})`);
            }

            totalEmotion += data.emotion;

            for (const infliction of data.inflictions) {
                let status = infliction.key;
                let cur = Number(infliction.count);

                if ((status == "Critical" || status == "Poise") && this.hasEffect("Instant Crit")) continue;
                if ((status == "Devastation" || status == "Ruin") && this.hasEffect("Instant Devastation")) continue;
                if (this.hasEffect(`Instant ${status}`)) continue;
                if (this.negatePoise && status == "Poise") continue;
                if (this.negateRuin && status == "Ruin") continue;

                if (this.flags.includes("Reflective Barrier") && cur > 0) {
                    cur = -cur;
                }

                if (this.flags.includes("OC Vuln") && cur > 0) {
                    cur = 2 * cur;
                }

                if (this.flags.includes("Refractor-C") && statusPlusValid.includes(status)) {
                    cur += 1;
                }

                if (this.flags.includes("Refractor-O") && statusPlusValid.includes(status)) {
                    cur += 3;
                }

                let plusEffect = this.effects.find(x => x.name == `${infliction.key}+`);
                if (plusEffect != null) {
                    cur += Number(plusEffect.count);
                }

                if (this.actor.augmentEffectCount("Rekindled Embers") > 0 && infliction.key == "Burn") {
                    let thresholds = Math.min(Math.floor((max - stat) / (max * 0.25)), 3);
                    cur += thresholds;
                }

                if (this.actor.hasMarkApplied(this.target, MARKS.Crippling) && statusPlusValid.includes(status)) {
                    cur += 1;
                }

                if (this.hasEffect(`Instant ${infliction.key}`)) {
                    infliction.nextRound = false;
                }

                if (cur < 0) {
                    let prev = infliction.nextRound ? Number(this.actor.getStatusCountNext(status)) : Number(this.actor.getStatusCount(status));
                    await this.actor.applyStatus(status, infliction.nextRound ? 0 : Math.abs(cur), infliction.nextRound ? Math.abs(cur) : 0);
                    lines.push(`Gain ${Math.abs(cur)} [/status/${status.replace(" ", "_")}] ${status.replace("_", " ")}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + Math.abs(cur)})`);
                }
                else {
                    if (this.target != null && !this.ignoringInflictions) {
                        let prev = infliction.nextRound ? Number(this.target.getStatusCountNext(status)) : Number(this.target.getStatusCount(status));
                        await this.target.applyStatus(status, infliction.nextRound ? 0 : cur, infliction.nextRound ? cur : 0);
                        if (!alreadyApplied.includes(status))  {
                            alreadyApplied.push(status);
                            totalAidHP += 3;
                        }

                        lines.push(`Inflict ${cur} [/status/${status.replace(" ", "_")}] ${status.replace("_", " ")}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + cur})`);
                    }
                }
            }
        }

        if (totalEmotion > 0) {
            let pe = this.actor.system.emotion;
            await this.actor.gainEmotion(totalEmotion);
            let e = this.actor.system.emotion;
            lines.push(`Gain ${totalEmotion} [/resources/EmotionIcon] Emotion (${pe} -> ${e})`);
        }

        if (totalEmotion < 0) {
            let pe = this.actor.system.emotion;
            await this.actor.loseEmotion(Math.abs(totalEmotion));
            let e = this.actor.system.emotion;
            lines.push(`Lose ${Math.abs(totalEmotion)} [/resources/EmotionIcon] Emotion (${pe} -> ${e})`);
        }

        if (this.target != null && totalAidHP > 0) {
            await this.actor.handleMarkAid(this.target, totalAidHP);
        }

        return this.append("", lines);
    }

    getChargeCosts() {
        let totalCharge = 0;

        for (let cost of this.costs) {
            if (cost.status == "Charge") {
                totalCharge += cost.cost;
            }
        }

        return totalCharge;
    }

    nullifyPower(nullifySkill = false) {
        if (this.result == "X") return;

        if (this.alreadyAppliedPowerNull) {
            return;
        }
        
        this.alreadyAppliedPowerNull = true;
        this.dicePower = Number(this.dicePower) - this.nonSkillDicePower;
        this.result = Number(this.result) - this.nonSkillDicePower;
        
        if (nullifySkill) {
            this.dicePower = Number(this.dicePower) - this.skillDicePower;
            this.result = Number(this.result) - this.skillDicePower;
        }
    }

    async processEffects() {
        try {
            if (this.actor != null) {
                this.actor.prepareData();

                switch (this.damageType) {
                    case "Slash":
                    case "Blunt":
                    case "Pierce":
                        this.dicePower = Number(this.dicePower) + Number(this.actor.system.attributes.rank.value);
                        //
                        this.dicePower = Number(this.dicePower) + await this.actor.getStatusCount("Strength");
                        this.nonSkillDicePower = Number(this.nonSkillDicePower) + await this.actor.getStatusCount("Strength");
                        //
                        this.dicePower = Number(this.dicePower) - await this.actor.getStatusCount("Feeble");
                        this.nonSkillDicePower = Number(this.nonSkillDicePower) - await this.actor.getStatusCount("Feeble");
                        break;
                    case "Block":
                        this.dicePower = Number(this.dicePower) + Number(this.actor.system.abilities.Temperance.value);
                        //
                        this.dicePower = Number(this.dicePower) + await this.actor.getStatusCount("Endurance");
                        this.nonSkillDicePower = Number(this.nonSkillDicePower) + await this.actor.getStatusCount("Endurance");
                        //
                        this.dicePower = Number(this.dicePower) - await this.actor.getStatusCount("Disarm");
                        this.nonSkillDicePower = Number(this.nonSkillDicePower) - await this.actor.getStatusCount("Disarm");
                        break;
                    case "Evade":
                        this.dicePower = Number(this.dicePower) + Number(this.actor.system.abilities.Insight.value);
                        //
                        this.dicePower = Number(this.dicePower) + await this.actor.getStatusCount("Endurance");
                        this.nonSkillDicePower = Number(this.nonSkillDicePower) + await this.actor.getStatusCount("Endurance");
                        //
                        this.dicePower = Number(this.dicePower) - await this.actor.getStatusCount("Disarm");
                        this.nonSkillDicePower = Number(this.nonSkillDicePower) - await this.actor.getStatusCount("Disarm");
                        //
                        this.diceMax = this.diceMax + 2;
                        break;
                }
            }

            switch (this.form) {
                case "Medium":
                    this.diceMax = this.diceMax + 2;
                    break;
                case "High Cal":
                    this.diceMax = this.diceMax + 2;
                    break;
                case "Armored":
                    if (this.damageType == "Block") {
                        this.dicePower = Number(this.dicePower) + 1;
                    }
                case "Swift":
                    if (this.damageType == "Evade") {
                        this.dicePower = Number(this.dicePower) + 1;
                    }
                default:
                    break;
            }

            switch (this.hand) {
                case "Offensive 1H":
                    this.dicePower = Number(this.dicePower) + 1;
                    break;
                case "Offensive 2H":
                    this.dicePower = Number(this.dicePower) + 2;
                    break;
                default:
                    break;
            }
            
            for (const effect of this.effects) {
                if (!effect.effect) {
                    continue;
                }

                this.dicePower = Number(this.dicePower);
                this.nonSkillDicePower = Number(this.nonSkillDicePower);
                this.skillDicePower = Number(this.skillDicePower);

                try {
                    effect.effect.apply(this, Number(effect.count), effect.trigger);
                }
                catch (exception) {
                    console.log('rollcontext error');
                    console.log(exception);
                }
            }
            
            for (const conditional of this.activeConditionals) {
                let def = this.conditionals.find(x => x.name == conditional);

                try {
                    await def.onUse(this);
                }
                catch (exception) {
                    console.log('rollcontext error');
                    console.log(exception);
                }

                for (let cost of def.costs) {
                    this.costs.push(cost);
                }
            }

            return true;
        }
        catch {
            return true;
        }
    }

    processEffectsSync() {
        if (this.actor != null) {
            this.actor.prepareData();

            switch (this.damageType) {
                case "Slash":
                case "Blunt":
                case "Pierce":
                    this.dicePower = Number(this.dicePower) + Number(this.actor.system.attributes.rank.value);
                    //
                    this.dicePower = Number(this.dicePower) + this.actor.getStatusCount("Strength");
                    this.nonSkillDicePower = Number(this.nonSkillDicePower) + this.actor.getStatusCount("Strength");
                    //
                    this.dicePower = Number(this.dicePower) - this.actor.getStatusCount("Feeble");
                    this.nonSkillDicePower = Number(this.nonSkillDicePower) - this.actor.getStatusCount("Feeble");
                    break;
                case "Block":
                    this.dicePower = Number(this.dicePower) + Number(this.actor.system.abilities.Temperance.value);
                    //
                    this.dicePower = Number(this.dicePower) + this.actor.getStatusCount("Endurance");
                    this.nonSkillDicePower = Number(this.nonSkillDicePower) + this.actor.getStatusCount("Endurance");
                    //
                    this.dicePower = Number(this.dicePower) - this.actor.getStatusCount("Disarm");
                    this.nonSkillDicePower = Number(this.nonSkillDicePower) - this.actor.getStatusCount("Disarm");
                    break;
                case "Evade":
                    this.dicePower = Number(this.dicePower) + Number(this.actor.system.abilities.Insight.value);
                    //
                    this.dicePower = Number(this.dicePower) + this.actor.getStatusCount("Endurance");
                    this.nonSkillDicePower = Number(this.nonSkillDicePower) + this.actor.getStatusCount("Endurance");
                    //
                    this.dicePower = Number(this.dicePower) - this.actor.getStatusCount("Disarm");
                    this.nonSkillDicePower = Number(this.nonSkillDicePower) - this.actor.getStatusCount("Disarm");
                    //
                    this.diceMax = this.diceMax + 2;
                    break;
            }
        }

        switch (this.form) {
            case "Medium":
                this.diceMax = this.diceMax + 2;
                break;
            case "High Cal":
                this.diceMax = this.diceMax + 2;
                break;
            case "Armored":
                if (this.damageType == "Block") {
                    this.dicePower = Number(this.dicePower) + 1;
                }
                break;
            case "Swift":
                if (this.damageType == "Evade") {
                    this.dicePower = Number(this.dicePower) + 1;
                }
                break;
            default:
                break;
        }

        switch (this.hand) {
            case "Offensive 1H":
                this.dicePower = Number(this.dicePower) + 1;
                break;
            case "Offensive 2H":
                this.dicePower = Number(this.dicePower) + 2;
                break;
            default:
                break;
        }

        for (const effect of this.effects) {
            try {
                if (!effect.effect) {
                    continue;
                }

                effect.effect.apply(this, Number(effect.count), effect.trigger);
            }
            catch (exception) {
                console.log('rollcontext error');
                console.log(exception);
            }
        }
    }

    getDescription(validTriggers = ["On Use", "Clash Win", "Clash Lose"], postClash = false, fakeFirstRound = false) {
        let desc = "";
        let triggers = {};
        for (let trigger of triggerTypes) {
            triggers[trigger] = [];
        }

        let valid = ["Clash Win", "Clash Lose", "On Use", "Tremor Burst", "Sinking Burst", "Rupture Burst", "Effective Heal", "Round End"]
        if (fakeFirstRound) {
            valid.push("Combat Start");
            valid.push("Round Start");
        }

        valid.push("On Crit");
        valid.push("Devastating Hit");

        for (const effect of this.effects) {
            if (!effect.effect) {
                continue;
            }

            if (this.ignoreClashEffects) {
                continue;
            }

            if (valid.find(x => x == effect.trigger) != null && effect.effect.description != null && !effect.effect.dontFormat) {
                let description = effect.effect.description(effect.count);
                if (description != null && (!(description.includes("first round") && currentRound > 1) || fakeFirstRound) && !(
                    (description.includes("[!O]") && !this.isOffensive() && !fakeFirstRound) ||
                    (description.includes("[!D]") && this.isOffensive() && !fakeFirstRound)
                )) {
                    description = description.replace("[!O]", "").replace("[!D]", "");
                    triggers[effect.trigger].push(
                        this.format(`<span style="color: ${this.getColor(effect.trigger)} !important;">[${effect.trigger}]</span>`, description, !postClash)
                    );
                }
            }
            else {
                if (effect.effect.dontFormat) {
                    let desc = effect.effect.description(effect.count);
                    if (desc[0] != null) triggers["On Use"].push(this.format(`<span style="color: ${this.getColor("On Use")} !important;">[On Use]</span>`, desc[0], !postClash));
                    if (desc[1] != null) triggers["Clash Win"].push(this.format(`<span style="color: ${this.getColor("Clash Win")} !important;">[Clash Win]</span>`, desc[1], !postClash));
                    if (desc[2] != null) triggers["Clash Lose"].push(this.format(`<span style="color: ${this.getColor("Clash Lose")} !important;">[Clash Lose]</span>`, desc[2], !postClash));
                    if (desc[3] != null) triggers["Always Active"].push(this.format("", desc[3], false));
                    if (desc[4] != null && fakeFirstRound) triggers["Augment Passive"].push(this.format("", desc[4], false));
                }
            }
        }

        desc = this.append(desc, triggers["Augment Passive"]);
        desc = this.append(desc, triggers["Always Active"]);
        desc = this.append(desc, this.modifierText);
        if (valid.includes("Combat Start")) desc = this.append(desc, triggers["Combat Start"]);
        if (valid.includes("Round Start")) desc = this.append(desc, triggers["Round Start"]);
        if (validTriggers.includes("On Use")) desc = this.append(desc, triggers["On Use"]);
        desc = this.append(desc, triggers["On Crit"]);
        desc = this.append(desc, triggers["Devastating Hit"]);
        desc = this.append(desc, triggers["Rupture Burst"]);
        desc = this.append(desc, triggers["Sinking Burst"]);
        desc = this.append(desc, triggers["Tremor Burst"]);
        desc = this.append(desc, triggers["Effective Heal"]);
        desc = this.append(desc, triggers["Round End"]);
        if (validTriggers.includes("Clash Win")) desc = this.append(desc, triggers["Clash Win"]);
        if (validTriggers.includes("Clash Lose")) desc = this.append(desc, triggers["Clash Lose"]);

        return desc;
    }

    format(prefix, suffix, usePrefix = true) {
        return usePrefix ? prefix + " " + suffix : suffix;
    }

    fix() {
        if (this.mustDeserialize) {
            this.prepareForDeserialization();
        }
        else {
            this.target = searchByObject(this.target);
            this.actor = searchByObject(this.actor);
        }

        this.fixTriggers();

        for (const event of eventTypes) {
            this.events[event] = [];
        }

        for (const effect of this.effects) {
            effect.effect = getEffectsArray(effect.source).find(x => x.name == effect.name);
            if (!effect.effect) {
                continue;
            }

            if (effect.effect.reapply) {
                try {
                    effect.effect.apply(this, Number(effect.count), effect.trigger);
                }
                catch (exception) {
                    console.log('rollcontext error');
                    console.log(exception);
                }
            }
        }
    }

    findAfflictions(status, triggers) {
        let afflictions = [];

        for (let trigger of triggers) {
            let data = this.triggers[trigger];

            for (let affliction of data.inflictions) {
                if (affliction.key == status) {
                    afflictions.push(affliction);
                }
            }
        }

        return afflictions;
    }

    append(desc, triggers) {
        for (const str of triggers) {
            desc = desc + `${str}\n`;
        }

        return desc;
    }

    getColor(trigger) {
        for (let triggerType of triggerTypes) {
            if (trigger == triggerType) {
                trigger = triggerType;
            }
        }

        switch (trigger) {
            case "On Use":
                return "#4aff68ff";
            case "Clash Win":
                return "#f5c950ff";
            case "Clash Lose":
                return "#c00000ff";
            case "Combat Start":
                return "#ffa450ff";
            case "Round Start":
                return "#fff350ff";
            case "Devastating Hit":
                return "#4600b6ff";
            case "Tremor Burst":
                return "#e5ff00ff";
            case "Sinking Burst":
                return "#0043d4ff";
            case "Rupture Burst":
                return "#31ffbaff";
            case "On Crit":
                return "#ffedb0ff";
            case "Effective Heal":
                return "#ff5858ff";
            case "Round End":
                return "#3a4885ff";
        }

        return "#000000";
    }

    loadPrimerEffects(effects) {
        for (const effect of effects) {
            let def = getEffectsArray(effect.source).find(x => x.name == effect.name);

            this.effects.push({
                effect: def,
                count: effect.count,
                trigger: effect.trigger,
                source: effect.source,
                name: effect.name
            });

            def.apply(this, effect.count, effect.trigger);
        }
    }

    async loadBullet() {
        let options = [];

        for (let bullet of bulletList) {
            options.push({
                name: bullet.name
            });
        }

        let type = await pollUserInputOptions(this.actor, "Select a bullet to use.", options);

        let effect = bulletList.find(x => x.name == type);
        this.effects.push({
            effect: effect,
            count: 1,
            trigger: effect.validTriggers[0],
            source: "bullet",
            name: effect.name
        });

        return type;
    }

    addEffectsList(effects, category) {
        if (this.form == "Thirsty") {
            this.conditionals.push(new Conditional("Thirsty", `Consume 10 Bloodfeast.`, (context) => {
                
            }, [{
                status: "Bloodfeast",
                cost: 10
            }], null));
        }


        if (category == "skill" || category == "Skill") {
            this.skillUsed = true;
        }

        for (const effect of effects) {
            let def = getEffectsArray(category).find(x => x.name == effect.name);

            this.effects.push({
                effect: def,
                count: effect.count,
                trigger: effect.trigger,
                source: category,
                name: effect.name
            });
        }

        if (this.modifiers != null) {
            if (this.modifiers.item != null) {
                for (const effect of this.modifiers.item.system.effects) {
                    this.effects.push({
                        effect: getEffectsArray("skill").find(x => x.name == effect.name),
                        count: effect.count,
                        trigger: effect.trigger,
                        source: "skill",
                        name: effect.name
                    });
                }
            }

            if (this.modifiers.technique != null) {
                for (const effect of this.modifiers.technique.system.effects) {
                    this.effects.push({
                        effect: getEffectsArray("technique").find(x => x.name == effect.name),
                        count: effect.count,
                        trigger: effect.trigger,
                        source: "technique",
                        name: effect.name
                    });
                }

                let cost = calculateTechniqueCost(this.modifiers.technique.system.effects, this.actor);
                this.triggers["On Use"].emotion -= cost;
            }
            
            for (const conditional of this.modifiers.activeConditionals) {
                this.activeConditionals.push(conditional);
            }

            this.ignoreClashEffects = this.modifiers.ignoreClashEffects;
            this.forcedAdvState = this.modifiers.forcedAdvState;
            this.defTwoHandedFree = this.modifiers.def2H;
            this.ignoreEmotionLoss = this.modifiers.ignoreEmotion;
            this.protect = this.modifiers.protect;
            this.bondTarget = this.modifiers.bondTarget;
            this.defFollowup = this.modifiers.defFollowup;
            this.reactive = this.modifiers.reactive;
            this.dicePower = Number(this.dicePower) + Number(this.modifiers.powerMod);
        }

        if (this.actor != null && this.actor.augment != null) {
            for (const effect of this.actor.augment.system.effects) {
                this.effects.push({
                    effect: getEffectsArray("augment").find(x => x.name == effect.name),
                    count: effect.count,
                    trigger: effect.trigger,
                    source: "augment",
                    name: effect.name
                });
            }
        }

        if (this.hasEffect("Ground Rumbler")) {
            let earthquake = this.effects.find(x => x.name == "Earthquake");

            if (earthquake != null) {
                earthquake.count = Number(earthquake.count) + 1;
            } else {
                let def = getEffectsArray("skill").find(x => x.name == "Earthquake");
                this.effects.push({
                    effect: def,
                    count: 1,
                    trigger: "Tremor Burst",
                    source: "skill",
                    name: def.name
                });
            }
        }
    }
}

export class Conditional {
    constructor(name, description, onUse, costs = [], exclusiveWith = null) {
        this.costs = costs;
        this.onUse = onUse;
        this.name = name;
        this.description = description;
        this.exclusiveWith = exclusiveWith;
    }
}

export class TriggerEvents {
    constructor() {
        this.inflictions = [];
        this.modify = [];
        this.hpHeal = 0;
        this.spHeal = 0;
        this.stHeal = 0;
        this.hpDamage = 0;
        this.stDamage = 0;
        this.emotion = 0;
    }

    mergeInflictions() {
        let inflictions2 = [];

        for (const infliction of this.inflictions) {
            let existing = inflictions2.find(x => x.key == infliction.key && x.nextRound == infliction.nextRound && ((x.count > 0 && infliction.count > 0) || (x.count < 0 && infliction.count < 0)));

            if (existing != null) {
                existing.count += infliction.count;
            }
            else {
                inflictions2.push(infliction);
            }
        }

        this.inflictions = inflictions2;
    }

    applyInfliction(key, count, nextRound) {
        this.inflictions.push({
            key: key,
            count: count,
            nextRound: nextRound
        })
    }
}