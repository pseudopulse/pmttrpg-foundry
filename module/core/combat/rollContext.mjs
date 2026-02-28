import { weaponEffects } from "../effects/weaponEffects.mjs";

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

        for (const trigger of triggerTypes) {
            this.triggers[trigger] = new TriggerEvents();
        }
    }

    processEffects() {
        for (const effect of this.effects) {
            effect.effect.apply(this, effect.count, effect.trigger);
        }
    }

    getDescription() {
        let desc = "";
        let triggers = {};
        triggers["Clash Win"] = [];
        triggers["Clash Lose"] = [];
        triggers["On Use"] = [];
        let valid = ["Clash Win", "Clash Lose", "On Use"]
        for (const effect of this.effects) {
            if (valid.find(x => x == effect.trigger) != null && effect.effect.description != null) {
                triggers[effect.trigger].push(
                    `<span style="color: ${this.getColor(effect.trigger)} !important;">[${effect.trigger}]</span> ${effect.effect.description(effect.count)}`
                );
            }
            else {
                if (effect.effect.dontFormat) {
                    let desc = effect.effect.description(effect.count);
                    if (desc[0] != null) triggers["On Use"].push(`<span style="color: ${this.getColor("On Use")} !important;">[On Use]</span> ${desc[0]}`);
                    if (desc[1] != null) triggers["Clash Win"].push(`<span style="color: ${this.getColor("Clash Win")} !important;">[Clash Win]</span> ${desc[1]}`);
                    if (desc[2] != null) triggers["Clash Lose"].push(`<span style="color: ${this.getColor("Clash Lose")} !important;">[Clash Lose]</span> ${desc[2]}`);
                }
            }
        }

        desc = this.append(desc, triggers["On Use"]);
        desc = this.append(desc, triggers["Clash Win"]);
        desc = this.append(desc, triggers["Clash Lose"]);

        return desc;
    }

    fix() {
        for (const effect of this.effects) {
            let def = null;
            switch (effect.source) {
                case "Weapon":
                    def = weaponEffects.find(x => x.name == effect.name);
                    break;
                default:
                    break;
            }
            effect.effect = def;
            console.log("fixed - ");
            console.log(effect);
        }
        console.log("full");
        console.log(this.effects);
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
            let def = null;
            switch (category) {
                case "Weapon":
                    def = weaponEffects.find(x => x.name == effect.name);
                    break;
                case "Outfit":
                    def = outfitEffects.find(x => x.name == effect.name);
                    break;
                default:
                    break;
            }

            this.effects.push({
                effect: def,
                count: effect.count,
                trigger: effect.trigger,
                source: category,
                name: effect.name
            });
        }
    }
}


export class TriggerEvents {
    constructor() {
        this.inflictions = [];
    }

    applyInfliction(key, count, nextRound) {
        this.inflictions.push({
            key: key,
            count: count,
            nextRound: nextRound
        })
    }
}