import { RollContext } from "../combat/rollContext.mjs";
import { enrichClashData } from "../helpers/clash.mjs";

export function createAlertBox(alert) {
    const dialog = new Dialog({
        title: "",
        content: alert,
        buttons: {
            button1: {
                label: "OK",
                icon: `<i class="fas fa-check"></i>`
            }
        }
    }).render(true);
}

/**
    * @param {RollContext} context 
    */
export async function createClashResponse(actor, context) {
    const desc = context.getDescription();
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-response.hbs", {
        items: actor.items,
        rollContext: context,
        enrichedClashData: enrichClashData(desc),
        actor: actor
    });

    const dialog = new Dialog({
        title: "",
        content: content,
        buttons: {},
        render: (html) => {
            $("#crw-outfits").hide();
            $(document).on('click', '.rollable', (event) => {
                const element = event.currentTarget;
                const dataset = element.dataset;

                const itemId = element.closest('.item').dataset.itemId;
                const actorId = element.closest('.cr-form').dataset.actorId;
                const item = game.actors.find(x => x._id == actorId).items.get(itemId);
                item.roll(false);
                dialog.close();
            });

            $(document).on('click', '.crw-tab-button', (event) => {
                const element = event.currentTarget;
                console.log(element);

                console.log(element.textContent);

                if (element.textContent == "Weapons") {
                    $("#crw-outfits").hide();
                    $("#crw-weapons").show();
                }

                if (element.textContent == "Outfits") {
                    $("#crw-outfits").show();
                    $("#crw-weapons").hide();
                }
            });
        }
    }, {
        width: 800,
        height: 500,
    }).render(true);
}
