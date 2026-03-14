import { roughSizeOfObject } from "../pmttrpg.mjs";
import { statusList } from "../core/status/statusEffects.mjs";
import { validate, handleEffectAddButton, handleEffectCounterChange, handleEffectRemoveButton, handleEffectTriggerChange, handleEffectTypeChange, getEffectsArray } from "../core/effects/effectHelpers.mjs";

//
export class PTActorSheet extends ActorSheet {
    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["pmttrpg", "sheet", "actor"],
            width: 600,
            height: 600,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "stats" }, { navSelector: ".sheet-tabs2", contentSelector: ".sheet-body2", initial: "weapons" }]
        });
    }

    /** @override */
    get template() {
        return `systems/pmttrpg/templates/actor/actor.hbs`;
    }

    async getData() {
        const context = super.getData();
        const actorData = this.document.toObject(false);
        context.system = actorData.system;
        context.flags = actorData.flags;

        context.statusList = statusList;

        this.prepareItems(context);

        console.log(this.document.name);
        console.log(roughSizeOfObject(this.document));

        return context;
    }

    prepareItems(context) {
        const weapons = [];
        const outfits = [];
        const skills = [];
        const augments = [];

        for (let i of context.items) {
            if (i.type === 'weapon') {
                weapons.push(i);
            }
            else if (i.type === 'outfit') {
                outfits.push(i);
            }
            else if (i.type === 'skill') {
                skills.push(i);
            }
            else if (i.type === 'augment') {
                augments.push(i);
            }
        }

        context.weapons = weapons;
        context.outfits = outfits;
        context.skills = skills;
        context.augments = augments;
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.on('click', '.item-create', this._onItemCreate.bind(this));
        html.on('click', '.rollable', this._onRoll.bind(this));

        // Render the item sheet for viewing/editing prior to the editable check.
        html.on('click', '.item-edit', (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'));
            item.sheet.render(true);
        });

        // Delete Inventory Item
        html.on('click', '.item-delete', (ev) => {
            const li = $(ev.currentTarget).parents('.item');
            const item = this.actor.items.get(li.data('itemId'));
            item.delete();
            li.slideUp(200, () => this.render(false));
        });

        html.on('change', '.ast-cur', (ev) => {
            const element = ev.currentTarget;
            this.actor.setStatus(element.closest('.ast-st-holder').dataset.status, element.value);
        })

        html.on('change', '.ast-nxt', (ev) => {
            const element = ev.currentTarget;
            this.actor.setStatusNext(element.closest('.ast-st-holder').dataset.status, element.value);
        })

        html.on('click', '.dispo-entry', (ev) => {
            const system = this.actor.toObject(false).system;
            system.disposition = ev.currentTarget.textContent;
            this.actor.update({ system }, { diff: false, render: true });
        });

        html.on('change', '.emotion-input', (ev) => {
            ev.preventDefault();
            const system = this.actor.toObject(false).system;
            system.emotion = ev.currentTarget.value;
            this.actor.update({ system }, { diff: false, render: true });
        });

        // Drag events for macros.
        if (this.actor.isOwner) {
            let handler = (ev) => this._onDragStart(ev);
            html.find('li.item').each((i, li) => {
                if (li.classList.contains('inventory-header')) return;
                li.setAttribute('draggable', true);
                li.addEventListener('dragstart', handler, false);
            });
        }
    }

    processData(func) {
        func(this);
    }

    async _onItemCreate(event) {
        event.preventDefault();
        const header = event.currentTarget;
        // Get the type of item to create.
        const type = event.currentTarget.dataset.type;
        // Grab any data associated with this control.
        const data = duplicate(header.dataset);
        // Initialize a default name.
        const name = `New ${type.capitalize()}`;
        // Prepare the item object.
        const itemData = {
            name: name,
            type: type,
            system: data,
        };
        // Remove the type from the dataset since it's in the itemData.type prop.
        delete itemData.system['type'];

        // Finally, create the item!
        return await Item.create(itemData, { parent: this.actor });
    }

    _onRoll(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const dataset = element.dataset;

        // Handle item rolls.
        if (dataset.rollType) {
            if (dataset.rollType == 'item') {
                const itemId = element.closest('.item').dataset.itemId;
                const item = this.actor.items.get(itemId);
                if (item) return item.roll();
            }
        }

        // Handle rolls that supply the formula directly.
        if (dataset.roll) {
            let label = dataset.label ? `[ability] ${dataset.label}` : '';
            let roll = new Roll(dataset.roll, this.actor.getRollData());
            roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flavor: label,
                rollMode: game.settings.get('core', 'rollMode'),
            });
            return roll;
        }
    }
}