import { searchByObject, searchForActor } from "../../pmttrpg.mjs";
import { weaponEffects } from "../effects/weaponEffects.mjs";
import { outfitEffects } from "../effects/outfitEffects.mjs";
import { getEffectsArray } from "../effects/effectHelpers.mjs";

export class RollContext {
    constructor() {
        const triggerTypes = ["Clash Win", "Clash Lose", "On Use", "Always Active"];
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
        this.mustDeserialize = false;
        this.ignoreClashEffects = false;
        this.forcedAdvState = 0;

        for (const trigger of triggerTypes) {
            this.triggers[trigger] = new TriggerEvents();
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
        const triggerTypes = ["Clash Win", "Clash Lose", "On Use", "Always Active"];
        
        for (let trigger of triggerTypes) {
            let data = this.triggers[trigger];
            this.triggers[trigger] = new TriggerEvents();
            Object.assign(this.triggers[trigger], data);
        }
    }

    resolveTriggers(triggers) {
        let lines = [];

        console.log(this.triggers);

        for (const cost of this.costs) {
            let status = cost.status;
            let prev = this.actor.getStatusCount(status);

            this.actor.reduceStatus(status, cost.cost);
            lines.push(`Lose ${cost.cost} [/status/${status}] ${status} (${prev} -> ${prev - cost.cost})`);
        }

        for (const trigger of triggers) {
            let data = this.triggers[trigger];

            for (const infliction of data.inflictions) {
                let status = infliction.key;
                let cur = Number(infliction.count);

                if (cur < 0) {
                    let prev = infliction.nextRound ? Number(this.actor.getStatusCountNext(status)) : Number(this.actor.getStatusCount(status));
                    this.actor.applyStatus(status, infliction.nextRound ? 0 : Math.abs(cur), infliction.nextRound ? Math.abs(cur) : 0);
                    lines.push(`Gain ${Math.abs(cur)} [/status/${status}] ${status}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + Math.abs(cur)})`);
                }
                else {
                    if (this.target != null) {
                        let prev = infliction.nextRound ? Number(this.target.getStatusCountNext(status)) : Number(this.target.getStatusCount(status));
                        this.target.applyStatus(status, infliction.nextRound ? 0 : cur, infliction.nextRound ? cur : 0);
                        lines.push(`Inflict ${cur} [/status/${status}] ${status}${infliction.nextRound ? " next round" : ""}. (${prev} -> ${prev + cur})`);
                    }
                }
            }
        }

        return this.append("", lines);
    }

    processEffects() {
        if (this.actor != null) {
            this.actor.prepareData();
            console.log(this.actor);
            console.log("rank: " + Number(this.actor.system.attributes.rank.value));

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
    }

    getDescription(validTriggers = ["On Use", "Clash Win", "Clash Lose"], postClash = false) {
        let desc = "";
        let triggers = {};
        triggers["Clash Win"] = [];
        triggers["Clash Lose"] = [];
        triggers["On Use"] = [];
        let valid = ["Clash Win", "Clash Lose", "On Use"]
        for (const effect of this.effects) {
            if (this.ignoreClashEffects) {
                continue;
            }
            
            if (valid.find(x => x == effect.trigger) != null && effect.effect.description != null) {
                triggers[effect.trigger].push(
                    this.format(`<span style="color: ${this.getColor(effect.trigger)} !important;">[${effect.trigger}]</span>`, effect.effect.description(effect.count), !postClash)
                );
            }
            else {
                if (effect.effect.dontFormat) {
                    let desc = effect.effect.description(effect.count);
                    if (desc[0] != null) triggers["On Use"].push(this.format(`<span style="color: ${this.getColor("On Use")} !important;">[On Use]</span>`, desc[0], !postClash));
                    if (desc[1] != null) triggers["Clash Win"].push(this.format(`<span style="color: ${this.getColor("Clash Win")} !important;">Clash Win</span>`, desc[0], !postClash));
                    if (desc[2] != null) triggers["Clash Lose"].push(this.format(`<span style="color: ${this.getColor("Clash Lose")} !important;">Clash Lose</span>`, desc[0], !postClash));
                }
            }
        }

        if (validTriggers.includes("On Use")) desc = this.append(desc, triggers["On Use"]);
        if (validTriggers.includes("Clash Win")) desc = this.append(desc, triggers["Clash Win"]);
        if (validTriggers.includes("Clash Lose")) desc = this.append(desc, triggers["Clash Lose"]);

        return desc;
    }

    format(prefix, suffix, usePrefix = true) {
        return usePrefix ? prefix + " " + suffix : suffix;
    }

    fix() {
        for (const effect of this.effects) {
            effect.effect = getEffectsArray(effect.source).find(x => x.name == effect.name);
        }

        if (this.mustDeserialize) {
            this.prepareForDeserialization();
        }
        else {
            this.target = searchByObject(this.target);
            this.actor = searchByObject(this.actor);
        }

        this.fixTriggers();
    }


    append(desc, triggers) {
        for (const str of triggers) {
            desc = desc + `${str}\n`;
        }

        return desc;
    }

    getColor(trigger) {
        switch (trigger) {
            case "On Use":
                return "#4aff68ff";
            case "Clash Win":
                return "#f5c950ff";
            case "Clash Lose":
                return "#c00000ff";
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

            if (this.modifiers.activeConditionals != null) {
                for (let conditional of this.modifiers.activeConditionals) {
                    conditional.onUse(this);
                    for (let cost of conditional.costs) {
                        this.costs.push(cost);
                    }
                }
            }

            this.ignoreClashEffects = this.modifiers.ignoreClashEffects;
            this.forcedAdvState = this.modifiers.forcedAdvState;
            console.log("ignore cwl - " + this.ignoreClashEffects);
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