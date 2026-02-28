// import { ItemSheet } from "@client/applications/sheets/_module.mjs";
import { validate, handleEffectAddButton, handleEffectCounterChange, handleEffectRemoveButton, handleEffectTriggerChange, handleEffectTypeChange } from "../core/effects/effectHelpers.mjs";
import { weaponEffects } from "../core/effects/weaponEffects.mjs";
import { RollContext } from "../core/combat/rollContext.mjs";
import { enrichClashData } from "../core/helpers/clash.mjs";
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
        console.log("returning template: " + `systems/pmttrpg/templates/item/item-${this.item.type}.hbs`)
        return `systems/pmttrpg/templates/item/item-${this.item.type}.hbs`;
    }

    /*
    -- implement damage being dealt
        -- add outfits and resistances
    -- implement rolls in chat with correct buttons
        -- need buttons for clash win / lose / dealing damage
        -- chat message already displays
    -- fix issue with auto-targeting when responding to a clash
    -- fix clash response buttons not closing the ui
    -- add clash response button to go unopposed
    -- fix nextRound error in weaponEffects.mjs (double-edged triggers it)
    */

    async getData() {
        const context = super.getData();
        const itemData = this.document.toObject(false);

        // Enrich description info for display
        // Enrichment turns text like `[[/r 1d20]]` into buttons
        context.enrichedDescription = await TextEditor.enrichHTML(
        this.item.system.description,
        {
            // Whether to show secret blocks in the finished html
            secrets: this.document.isOwner,
            // Necessary in v11, can be removed in v12
            async: true,
            // Data to fill in for inline rolls
            rollData: this.item.getRollData(),
            // Relative UUID resolution
            relativeTo: this.item,
        }
        );

        // Add the item's data to context.data for easier access, as well as flags.
        context.system = itemData.system;
        context.flags = itemData.flags;

        context.effectsList = weaponEffects;

        context.rollContext = new RollContext();
        if (this.type == "weapon") {
            context.rollContext.damageType = context.system.damageType;
        }
        context.rollContext.addEffectsList(context.system.effects, this.capitalizeFirstLetter(this.type));
        context.rollContext.processEffects();

        context.enrichedClashData = await TextEditor.enrichHTML(
            enrichClashData(context.rollContext.getDescription()),
            {
                // Whether to show secret blocks in the finished html
                secrets: this.document.isOwner,
                // Necessary in v11, can be removed in v12
                async: true,
                // Data to fill in for inline rolls
                rollData: this.item.getRollData(),
                // Relative UUID resolution
                relativeTo: this.item,
            }
        );

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
            handleEffectAddButton(event, system.effects);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('change', '.effect-counter', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectCounterChange(event, system.effects);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.effect-type', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectTypeChange(event, system.effects);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.effect-trigger', (event) => {
            const system = this.document.toObject(false).system;
            handleEffectTriggerChange(event, system.effects);
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.wb-typeBtn', (event) => {
            const system = this.document.toObject(false).system;
            system.damageType = event.currentTarget.id;
            this.item.update({ system }, { render: true, diff: false });
        });

        html.on('click', '.wb-attack-type-button', (event) => {
            const system = this.document.toObject(false).system;
            if (system.type == "Melee") {
                system.type = "Ranged";
            }
            else {
                system.type = "Melee";
            }
            this.item.update({ system }, { render: true, diff: false });
        });
    }
}