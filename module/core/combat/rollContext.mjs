import { searchByObject, searchForActor } from "../../pmttrpg.mjs";
import { weaponEffects } from "../effects/weaponEffects.mjs";
import { outfitEffects } from "../effects/outfitEffects.mjs";
import { getEffectsArray } from "../effects/effectHelpers.mjs";
import { currentRound } from "./combatState.mjs";

const triggerTypes = ["Clash Win", "Clash Lose", "On Use", "Always Active"];
const eventTypes = ["Kill", "Combat Start", "Round Start", "Devastating Hit", "Critical Hit", "Tremor Burst", "Sinking Burst", "Rupture Burst", "Clash Win", "Clash Lose"];
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

    prepareForSerialization() {
        this.mustDeserialize = true;

        if (this.actor != null) {
            this.actor = this.actor._id;
        }

        if (this.target != null) {
            this.target = this.target._id;
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

    async resolveTriggers(triggers) {
        let lines = [];
        for (const costs of this.costs) {
            for (const cost of costs) {
                let status = cost.status;
                let prev = this.actor.getStatusCount(status);

                await this.actor.reduceStatus(status, cost.cost);
                lines.push(`Lose ${cost.cost} [/status/${status}] ${status} (${prev} -> ${prev - cost.cost})`);
            }
        }

        for (const trigger of triggers) {
            let data = this.triggers[trigger];

            for (const func of data.modify) {
                await func(this, data);
            }

            for (const infliction of data.inflictions) {
                let status = infliction.key;
                let cur = Number(infliction.count);

                if (this.flags.includes("Refractor-C") && statusPlusValid.includes(status)) {
                    cur += 1;
                }

                if (this.flags.includes("Refractor-O") && statusPlusValid.includes(status)) {
                    cur += 3;
                }

                if (cur < 0) {
                    let prev = infliction.nextRound ? Number(this.actor.getStatusCountNext(status)) : Number(this.actor.getStatusCount(status));
                    await this.actor.applyStatus(status, infliction.nextRound ? 0 : Math.abs(cur), infliction.nextRound ? Math.abs(cur) : 0);
                    lines.push(`Gain ${Math.abs(cur)} [/status/${status}] ${status.replace("_", " ")}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + Math.abs(cur)})`);
                }
                else {
                    if (this.target != null) {
                        let prev = infliction.nextRound ? Number(this.target.getStatusCountNext(status)) : Number(this.target.getStatusCount(status));
                        await this.target.applyStatus(status, infliction.nextRound ? 0 : cur, infliction.nextRound ? cur : 0);
                        lines.push(`Inflict ${cur} [/status/${status}] ${status.replace("_", " ")}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + cur})`);
                    }
                }
            }
        }

        return this.append("", lines);
    }

    async processEffects() {
        if (this.actor != null) {
            this.actor.prepareData();

            switch (this.damageType) {
                case "Slash":
                case "Blunt":
                case "Pierce":
                    this.dicePower = this.dicePower + Number(this.actor.system.attributes.rank.value);
                    break;
                case "Block":
                    this.dicePower = this.dicePower + Number(this.actor.system.abilities.Temperance.value);
                    break;
                case "Evade":
                    this.dicePower = this.dicePower + Number(this.actor.system.abilities.Insight.value);
                    break;
            }
        }

        if (this.damageType == "Evade") {
            this.diceMax += 2;
        }
        
        for (const effect of this.effects) {
            effect.effect.apply(this, effect.count, effect.trigger);
        }
        
        for (const conditional of this.activeConditionals) {
            let def = this.conditionals.find(x => x.name == conditional);
            await def.onUse(this);
            this.costs.push(def.costs);
        }
    }

    getDescription(validTriggers = ["On Use", "Clash Win", "Clash Lose"], postClash = false, fakeFirstRound = false) {
        let desc = "";
        let triggers = {};
        triggers["Clash Win"] = [];
        triggers["Clash Lose"] = [];
        triggers["On Use"] = [];
        triggers["Always Active"] = [];
        triggers["Augment Passive"] = [];
        triggers["Combat Start"] = [];
        triggers["Round Start"] = [];
        let valid = ["Clash Win", "Clash Lose", "On Use"]
        if (fakeFirstRound) {
            valid.push("Combat Start");
            valid.push("Round Start");
        }

        for (const effect of this.effects) {
            if (this.ignoreClashEffects) {
                continue;
            }

            
            if (valid.find(x => x == effect.trigger) != null && effect.effect.description != null && !effect.effect.dontFormat) {
                let description = effect.effect.description(effect.count);
                if (description != null && (!(description.includes("first round") && currentRound > 1) || fakeFirstRound)) {
                    triggers[effect.trigger].push(
                        this.format(`<span style="color: ${this.getColor(effect.trigger)} !important;">[${effect.trigger}]</span>`, effect.effect.description(effect.count), !postClash)
                    );
                }
            }
            else {
                if (effect.effect.dontFormat) {
                    let desc = effect.effect.description(effect.count);
                    if (desc[0] != null) triggers["On Use"].push(this.format(`<span style="color: ${this.getColor("On Use")} !important;">[On Use]</span>`, desc[0], !postClash));
                    if (desc[1] != null) triggers["Clash Win"].push(this.format(`<span style="color: ${this.getColor("Clash Win")} !important;">Clash Win</span>`, desc[0], !postClash));
                    if (desc[2] != null) triggers["Clash Lose"].push(this.format(`<span style="color: ${this.getColor("Clash Lose")} !important;">Clash Lose</span>`, desc[0], !postClash));
                    if (desc[3] != null) triggers["Always Active"].push(this.format("", desc[3], false));
                    if (desc[4] != null && fakeFirstRound) triggers["Augment Passive"].push(this.format("", desc[4], false));
                }
            }
        }

        console.log("generating desc");
        console.log(this.modifierText);
        
        desc = this.append(desc, triggers["Augment Passive"]);
        desc = this.append(desc, triggers["Always Active"]);
        desc = this.append(desc, this.modifierText);
        if (valid.includes("Combat Start")) desc = this.append(desc, triggers["Combat Start"]);
        if (valid.includes("Round Start")) desc = this.append(desc, triggers["Round Start"]);
        if (validTriggers.includes("On Use")) desc = this.append(desc, triggers["On Use"]);
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
            if (effect.effect.reapply) {
                effect.effect.apply(this, effect.count, effect.trigger);
            }
        }
    }


    append(desc, triggers) {
        for (const str of triggers) {
            desc = desc + `${str}\n`;
        }

        return desc;
    }

    getColor(trigger) {
        if (trigger == "On Use") {
            trigger = "On Use";
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
        }

        return "#000000";
    }

    addEffectsList(effects, category) {
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
            
            for (const conditional of this.modifiers.activeConditionals) {
                this.activeConditionals.push(conditional);
            }

            this.ignoreClashEffects = this.modifiers.ignoreClashEffects;
            this.forcedAdvState = this.modifiers.forcedAdvState;
        }

        if (this.actor != null && this.actor.augment != null) {
            for (const effect of this.actor.augment.system.effects) {
                console.log("mirroring " + effect.name + " to list");
                this.effects.push({
                    effect: getEffectsArray("augment").find(x => x.name == effect.name),
                    count: effect.count,
                    trigger: effect.trigger,
                    source: "augment",
                    name: effect.name
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
    }

    mergeInflictions() {
        let inflictions2 = [];

        for (const infliction of inflictions) {
            let existing = inflictions2.find(x => x.key == infliction.key && x.nextRound == infliction.nextRound && ((x.count > 0 && infliction.count > 0) || (x.count < 0 && infliction.count < 0)));

            if (existing != null) {
                existing.count += infliction.count;
            }
            else {
                inflictions2.add(infliction);
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