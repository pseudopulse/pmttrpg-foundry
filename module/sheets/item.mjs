// import { ItemSheet } from "@client/applications/sheets/_module.mjs";
import { validate, handleEffectAddButton, handleEffectCounterChange, handleEffectRemoveButton, handleEffectTriggerChange, handleEffectTypeChange, getEffectsArray } from "../core/effects/effectHelpers.mjs";
import { weaponEffects } from "../core/effects/weaponEffects.mjs";
import { RollContext } from "../core/combat/rollContext.mjs";
import { enrichClashData } from "../core/helpers/clash.mjs";
import { outfitEffects } from "../core/effects/outfitEffects.mjs";
import { findItemOwner } from "../pmttrpg.mjs";
import { pollUserInputConfirm, pollUserInputOptions, pollUserInputText } from "../core/helpers/dialog.mjs";
//

export function calculateTechniqueCost(effects, actor) {
    let effectsList = getEffectsArray("technique");
    let totalCost = 0;

    for (let effect of effects) {
        let def = effectsList.find(x => x.name == effect.name);
        if (def.name == "Emotion Level") {
            totalCost += (def.cost * (1 + actor.system.emotionLevelUsed)) * effect.count;
        }
        else {
            totalCost += def.cost * effect.count;
        }
    }

    return totalCost;
}

//
export class PTItemSheet extends ItemSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["pmttrpg", "sheet", "item"],
            width: 600,
            height: 600,
            tabs: [{ contentSelector: ".sheet-body" }]
        });
    }

    /** @override */
    get template() {
        return `systems/pmttrpg/templates/item/item-${this.item.type}.hbs`;
    }

    async getData() {
        const context = super.getData();
        const itemData = this.document.toObject(false);

        // Enrich description info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedDescription = this.item.system.description;

        // Add the item's data to context.data for easier access, as well as flags.

        itemData.system.effects = validate(itemData.system.effects, this.item.type);
        await this.item.update({ "system.effects": itemData.system.effects }, { diff: true, render: true });

        context.system = itemData.system;
        context.flags = itemData.flags;

        context.effectsList = getEffectsArray(this.item.type);

        context.rollContext = new RollContext();
        if (this.item.type == "weapon") {
            context.rollContext.damageType = context.system.damageType;
            context.rollContext.attackType = context.system.attackType;
        }

        context.rollContext.hand = context.system.hand;
        context.rollContext.form = context.system.form;

        context.rollContext.addEffectsList(context.system.effects, this.item.type);
        context.rollContext.processEffects();

        if (this.item.type == "technique") {
            let actor = findItemOwner(this.item);
            context.emotion = actor.system.emotion;

            context.totalCost = calculateTechniqueCost(context.system.effects, actor);

            context.techniqueTooExpensive = context.totalCost > context.emotion;
        }

        context.enrichedClashData = enrichClashData(context.rollContext.getDescription(["Clash Win", "Clash Lose", "On Use"], false, true));

        let optionsM = ["Small", "Medium", "Long", "Sturdy", "Hybrid", "Versatile", "Innate", "Healing", "Thirsty", "Psionic", "Psionic (M)", "Heavy"];
        let optionsR = ["Low Cal", "High Cal", "Reactive", "Hybrid", "Recoil", "Innate", "Healing", "Thirsty", "Psionic"];

        context.forms = context.system.attackType == "Ranged" ? optionsR : optionsM;

        return context;
    }

    async loadEffectsFromClipboard() {
        if (!(await pollUserInputConfirm(game.user, "This will overwrite all of the effects on this item. Are you sure?"))) {
            return;
        }

        let text = await pollUserInputText(game.user, 'Paste effect data below (select the square of cells in sheets and hit copy).', 'paste here');

        await this.item.update({ "system.effects": [] }, { diff: true, render: true });

        let rows = text
            .trim()
            .split("\n")
            .map(line => line.split(/\t+/).map(x => x.trim()))
            .filter(row => row.length >= 2)
            .filter(row => !row.every(x => x === "---" || x === ""));

        rows = rows[0];

        const result = [];

        for (let i = 0; i < rows.length; i++) {
            const element = rows[i];
            if (element == "---" || element == "" || !Object.is(Number(element), NaN)) {
                continue;
            }

            result.push([element.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\([^)]*\)|\[[^\]]*\]/g, ''), rows[i + 2]]);
        }

        let effects = this.item.system.effects;
        
        for (let effect of result) {
            let def = getEffectsArray(this.item.type).find(x => x.name == effect[0]);
            if (def == null) {
                let matches = getEffectsArray(this.item.type).filter(x => x.name.includes(effect[0]));

                if (matches.length == 0) {
                    continue;
                }

                if (matches.length == 1) {
                    def = matches[0];
                }

                if (matches.length > 1) {
                    let options = [];

                    for (let match of matches) {
                        options.push({
                            name: match.name
                        });
                    }

                    let eff = await pollUserInputOptions(game.user, `Select possible match for missing effect "${effect[0]}"`, options);

                    def = getEffectsArray(this.item.type).find(x => x.name == eff);

                    if (def == null) {
                        continue;
                    }
                }
            }

            effects.push({
                name: def.name,
                trigger: def.validTriggers[0],
                count: Object.is(Number(effect[1]), NaN) ? 0 : Number(effect[1]),
                index: effects.length
            });
        }

        await this.item.update({ "system.effects": effects }, { diff: true, render: true });
    }

    capitalizeFirstLetter(val) {
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        html.on('click', '.effect-remove-button', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectRemoveButton(event, system.effects);
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.effect-add-button', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectAddButton(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('change', '.effect-counter', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectCounterChange(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.effect-type', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectTypeChange(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.effect-trigger', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectTriggerChange(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.wb-typeBtn', (event) => {
            const system = this.document.toObject(false).system;
            system.damageType = event.currentTarget.id;
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.sb-typeBtn', (event) => {
            const system = this.document.toObject(false).system;
            system.type = event.currentTarget.id;
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.tlb-typeBtn', (event) => {
            const system = this.document.toObject(false).system;
            system.type = event.currentTarget.id;
            this.item.update({ system }, { render: true, diff: true });
        });


        html.on('click', '.wb-attack-type-button', (event) => {
            const system = this.document.toObject(false).system;
            if (system.attackType == "Melee") {
                system.attackType = "Ranged";
            }
            else {
                system.attackType = "Melee";
            }

            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.wb-weapon-form', (event) => {
            const system = this.document.toObject(false).system;
            
            system.form = event.currentTarget.textContent;

            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.ob-hand-type-button', (event) => {
            const system = this.document.toObject(false).system;
            let options = ["Balanced", "Armored", "Swift"];

            let array = options;
            let index = array.findIndex(x => x == system.form);
            if (index == -1) index = 0;

            index++;
            if (index >= array.length) {
                index = 0;
            }

            system.form = array[index];

            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.wb-hand-type-button', (event) => {
            const system = this.document.toObject(false).system;
            let optionsM = ["Offensive 1H", "Offensive 2H", "Defensive 1H", "Defensive 2H", "Expressive 1H", "Expressive 2H"]
            let optionsR = ["Offensive 1H", "Offensive 2H", "Expressive 1H", "Expressive 2H"];

            let array = system.attackType == "Ranged" ? optionsR : optionsM;
            let index = array.findIndex(x => x == system.hand);
            if (index == -1) index = 0;

            index++;
            if (index >= array.length) {
                index = 0;
            }

            system.hand = array[index];

            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('change', '.sb-light-cost', (event) => {
            const system = this.document.toObject(false).system;
            system.light = Math.max(Number(event.currentTarget.value), 0);
            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.rt-drpbtn', (event) => {
            const system = this.document.toObject(false).system;
            const type = event.currentTarget.dataset.resType;
            const cat = event.currentTarget.dataset.resCat;
            const val = event.currentTarget.dataset.resVal;

            switch (type) {
                case "Slash":
                    if (cat == "Stg") {
                        system.slashResST = val;
                    }
                    else {
                        system.slashRes = val;
                    }
                    break;
                case "Pierce":
                    if (cat == "Stg") {
                        system.pierceResST = val;
                    }
                    else {
                        system.pierceRes = val;
                    }
                    break;
                case "Blunt":
                    if (cat == "Stg") {
                        system.bluntResST = val;
                    }
                    else {
                        system.bluntRes = val;
                    }
                    break;
                default:
                    break;
            }

            this.item.update({ system }, { render: true, diff: true });
        });

        html.on('click', '.ise-import', async (ev) => {
            await this.loadEffectsFromClipboard();
        });
    }
}