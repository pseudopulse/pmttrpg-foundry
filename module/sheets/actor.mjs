import { findActorsOfTeam, getBloodfeast, roughSizeOfObject, setBloodfeast } from "../pmttrpg.mjs";
import { statusList } from "../core/status/statusEffects.mjs";
import { validate, handleEffectAddButton, handleEffectCounterChange, handleEffectRemoveButton, handleEffectTriggerChange, handleEffectTypeChange, getEffectsArray } from "../core/effects/effectHelpers.mjs";
import { MarkNames } from "../core/status/mark.mjs";
import { findByID, sendNetworkMessage } from "../core/helpers/netmsg.mjs";
import { pollUserInputConfirm, pollUserInputText } from "../core/helpers/dialog.mjs";

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
        context.actor = this.document;

        context.statusList = statusList.filter(x => x.hidden == false);

        let marks = [];
        for (let mark of context.system.outgoingMarks) {
            marks.push({
                name: MarkNames[mark.id],
                id: mark.id,
                target: findByID(mark.target),
            });
        }
        
        context.outgoingMarks = marks;
        context.hasOutgoingMarks = marks.length > 0;

        let marks2 = [];
        for (let mark of context.system.incomingMarks) {
            marks2.push({
                name: MarkNames[mark.id],
                id: mark.id,
                source: findByID(mark.target),
            });
        }
        
        context.incomingMarks = marks2;
        context.hasIncomingMarks = marks2.length > 0;

        context.availableBloodfeast = getBloodfeast();

        //

        context.linkedActorName = "None";
        let options = [];
        let team = findActorsOfTeam(this.document);
        for (let member of team) {
            options.push({
                id: member.system.id,
                name: member.name,
            })
        }

        if (this.document.system.settings.linkedActor != null) {
            let curTarget = findByID(this.document.system.settings.linkedActor);

            if (curTarget) {
                context.linkedActorName = curTarget.name;
            }
        }

        context.actorOptions = options;

        context.isGM = game.user.isGM;

        this.prepareItems(context);

        return context;
    }

    prepareItems(context) {
        const weapons = [];
        const outfits = [];
        const skills = [];
        const augments = [];
        const tools = [];

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
            else if (i.type === 'tool') {
                tools.push(i);
            }
        }

        context.weapons = weapons;
        context.outfits = outfits;
        context.skills = skills;
        context.tools = tools;
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
            this.actor.update({ system }, { diff: true, render: true });
        });

        html.on('click', '.ac-ocDeclare', (ev) => {
            const system = this.actor.toObject(false).system;
            system.overchargeDeclared = true;
            this.actor.update({ system }, { diff: true, render: true });
        });

        html.on('click', '.as-reset-button', async (ev) => {
            await this.actor.resetStats();
        });

        html.on('click', '.as-status-reset-button', async (ev) => {
            await this.actor.resetStatus();
        });

        html.on('click', '.dispo-entry-2', (ev) => {
            const system = this.actor.toObject(false).system;
            system.secondaryDisposition = ev.currentTarget.textContent;
            this.actor.update({ system }, { diff: true, render: true });
        });

        html.on('click', '.ase-link-option', (ev) => {
            const system = this.actor.toObject(false).system;
            system.settings.linkedActor = ev.currentTarget.dataset.id;
            this.actor.update({ system }, { diff: true, render: true });
        });

        html.on('click', '.ac-mark-remove', (ev) => {
            ev.preventDefault();
            let target = ev.currentTarget.closest('.ac-mark-holder').dataset.target;
            let mark = ev.currentTarget.closest('.ac-mark-holder').dataset.id;

            sendNetworkMessage("REMOVE_MARK", { 
                source: this.actor.system.id,
                mark: mark,
                target: target
            });
        });

        html.on('click', '.aw-active-toggle', (ev) => {
            const target = ev.currentTarget.closest('.item');
            const item = this.actor.items.get(target.dataset.itemId);
            item.update({ "system.active": ev.currentTarget.checked }, { diff: true, render: false });
        });

        html.on('click', '.ao-active-toggle', (ev) => {
            const target = ev.currentTarget.closest('.item');
            const item = this.actor.items.get(target.dataset.itemId);
            this.actor.update({ "system.currentOutfitId": item.id }, { diff: true, render: false });
            this.actor.outfit = item;

            html.find('.ao-active-toggle').each((x, element) => {
                if (element.closest('.item').dataset.itemId != item.id) {
                    element.checked = false;
                }
            });
        });

        html.on('click', '.aa-active-toggle', (ev) => {
            const target = ev.currentTarget.closest('.item');
            const item = this.actor.items.get(target.dataset.itemId);
            this.actor.update({ "system.currentAugmentId": item.id }, { diff: true, render: false });
            this.actor.augment = item;

            html.find('.aa-active-toggle').each((x, element) => {
                if (element.closest('.item').dataset.itemId != item.id) {
                    element.checked = false;
                }
            });
        });

        html.find('.ao-active-toggle').each((x, element) => {
            const target = element.closest('.item');
            const item = this.actor.items.get(target.dataset.itemId);
            element.checked = this.actor.system.currentOutfitId == item.id;
        });

        html.find('.aa-active-toggle').each((x, element) => {
            const target = element.closest('.item');
            const item = this.actor.items.get(target.dataset.itemId);
            element.checked = this.actor.system.currentAugmentId == item.id;
        });

        html.find('.aw-active-toggle').each((x, element) => {
            const target = element.closest('.item');
            const item = this.actor.items.get(target.dataset.itemId);
            element.checked = item.system.active;
        });

        html.on('change', '.as-bloodfeast-edit', async (ev) => {
            let bloodfeast = Number(ev.currentTarget.value);
            if (!isNaN(bloodfeast)) {
                await setBloodfeast(bloodfeast)
            }
        });

        html.find('.ase-setting-toggle').each((x, element) => {
            element.checked = this.actor.system.settings[element.id];
        });

        html.on('click', '.ase-setting-toggle', (ev) => {
            const system = this.actor.toObject(false).system;
            system.settings[ev.currentTarget.id] = ev.currentTarget.checked;
            this.actor.update({ system }, { diff: true, render: false });
        });

        if (this.actor.isOwner) {
            let handler = (ev) => this._onDragStart(ev);
            html.find('li.item').each((i, li) => {
                if (li.classList.contains('inventory-header')) return;
                li.setAttribute('draggable', true);
                li.addEventListener('dragstart', handler, false);
            });
        }

        html.on('click', '.ase-export', async (ev) => {
            let holder = {};

            let system = this.actor.toObject(false).system;
            system.id = null;
            holder["system"] = system;

            let items = [];

            for (let item of this.actor.items) {
                items.push({
                    name: item.name,
                    type: item.type,
                    system: item.toObject(false).system
                });
            }

            holder["items"] = items;

            await game.clipboard.copyPlainText(JSON.stringify(holder));
            ui.notifications.info("Sheet data copied!");
        });

        html.on('click', '.ase-import', async (ev) => {
            if (!(await pollUserInputConfirm(game.user, "This will overwrite all of the data on this sheet. Are you sure?"))) {
                return;
            }

            let text = await pollUserInputText(game.user, 'Paste sheet data below.', 'paste here');
            let data = JSON.parse(text);

            if (!data.system || !data.items) {
                ui.notifications.error("Clipboard content is not exported sheet data.");
                return;
            }

            await this.actor.update({ system: data.system }, { diff: true, render: false });

            for (let item of this.actor.items) {
                await item.delete();
            }

            for (let item of data.items) {
                await Item.create(item, { parent: this.actor });
            }

            ui.notifications.info("Imported successfully!");
        });
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

                if (item && this.actor.getCanUseItem(item)) {
                    return item.roll();
                }
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