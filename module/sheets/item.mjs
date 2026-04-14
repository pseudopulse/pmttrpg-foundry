// import { ItemSheet } from "@client/applications/sheets/_module.mjs";
import { validate, handleEffectAddButton, handleEffectCounterChange, handleEffectRemoveButton, handleEffectTriggerChange, handleEffectTypeChange, getEffectsArray } from "../core/effects/effectHelpers.mjs";
import { weaponEffects } from "../core/effects/weaponEffects.mjs";
import { RollContext } from "../core/combat/rollContext.mjs";
import { enrichClashData } from "../core/helpers/clash.mjs";
import { outfitEffects } from "../core/effects/outfitEffects.mjs";
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

        context.enrichedClashData = enrichClashData(context.rollContext.getDescription(["Clash Win", "Clash Lose", "On Use"], false, true));

        return context;
    }

    capitalizeFirstLetter(val) {
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
    }

    activateListeners(html) {
        super.activateListeners(html);
        
        html.on('click', '.effect-remove-button', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectRemoveButton(event, system.effects);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.effect-add-button', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectAddButton(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('change', '.effect-counter', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectCounterChange(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.effect-type', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectTypeChange(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.effect-trigger', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectTriggerChange(event, system.effects, this.item.type);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.wb-typeBtn', (event) => {
            const system = this.document.toObject(false).system;
            system.damageType = event.currentTarget.id;
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.sb-typeBtn', (event) => {
            const system = this.document.toObject(false).system;
            system.type = event.currentTarget.id;
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.wb-attack-type-button', (event) => {
            const system = this.document.toObject(false).system;
            if (system.attackType == "Melee") {
                system.attackType = "Ranged";
            }
            else {
                system.attackType = "Melee";
            }

            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.wb-form-type-button', (event) => {
            const system = this.document.toObject(false).system;
            let optionsM = ["Small", "Medium", "Sturdy", "Hybrid", "Versatile", "Innate"];
            let optionsR = ["Low Cal", "High Cal", "Reactive", "Hybrid", "Recoil", "Innate"];

            let array = system.type == "Ranged" ? optionsR : optionsM;
            let index = array.findIndex(x => x == system.form);
            if (index == -1) index = 0;

            index++;
            if (index >= array.length) {
                index = 0;
            }

            system.form = array[index];

            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.wb-hand-type-button', (event) => {
            const system = this.document.toObject(false).system;
            let optionsM = ["Offensive 1H", "Offensive 2H", "Defensive 1H", "Defensive 2H"];
            let optionsR = ["Offensive 1H", "Offensive 2H"];

            let array = system.type == "Ranged" ? optionsR : optionsM;
            let index = array.findIndex(x => x == system.hand);
            if (index == -1) index = 0;

            index++;
            if (index >= array.length) {
                index = 0;
            }

            system.hand = array[index];

            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('change', '.sb-light-cost', (event) => {
            const system = this.document.toObject(false).system;
            system.light = Math.max(Number(event.currentTarget.value), 0);
            this.item.update({ system }, { render: true, diff: false });
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

            this.item.update({ system }, { render: true, diff: false });
        });
    }
}