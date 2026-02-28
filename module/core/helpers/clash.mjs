export function enrichClashData(str) {
    const parts = str.split("\n");
    let result = "";

    for (const part of parts) {
        result = result + `<p>${part}</p>\n`
    }

    console.log("clash data is");
    console.log(result);

    return result;
}

export async function createClashMessage(actor, context) {
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-message.hbs", {
        actor: actor,
        rollContext: context,
        enrichedClashData: enrichClashData(context.getDescription())
    });

    ChatMessage.create({
        user: game.user._id,
        content: content,
        speaker: ChatMessage.getSpeaker()
    });
}

export function initializeListeners() {
    $(document).on('click', '.clash-message-win-button', () => {

    });

    $(document).on('click', '.clash-message-lose-button', () => {
        
    });
}

function genericBurstHandler(status) {
    $(document).on('click', `.clash-message-${status.toLower()}-button`, () => {
        
    });
}