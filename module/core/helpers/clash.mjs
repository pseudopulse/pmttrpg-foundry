export function enrichClashData(str) {
    const parts = str.split("\n");
    let result = "";

    for (const part of parts) {
        result = result + `<p>${part}</p>\n`
    }

    let icons = result.match(/\[.*?\]/g);
    if (icons != null) {
        for (const match of icons) {
            let index = match.replace("[", "").replace("]", "");
            if (!index.startsWith("/")) {
                continue;
            }

            result = result.replace(match, `<img class="inline-status" src="systems/pmttrpg/assets${index}.png" width="24" height="24" />`);
        }
    }

    return result;
}

export function checkDraw(ctx1, ctx2) {
    return (ctx1.result == ctx2.result) && (ctx1.type != "Block" && ctx1.type != "Evade") && (ctx2.type != "Block" && ctx2.type != "Evade");
}

export async function createResultMessage(ctx1, ctx2) {
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-result.hbs", {
        enrichedClashData: checkDraw(ctx1, ctx2) ? "Draw! Roll again." : enrichClashData(""),
        ctx1: ctx1,
        ctx2: ctx2,
    });

    ChatMessage.create({
        user: game.user._id,
        content: content,
        speaker: ChatMessage.getSpeaker()
    });
}

export async function createEffectsMessage(subject, effectsData) {
    if (effectsData.trim().length === 0) {
        return;
    }

    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-effects.hbs", {
        effectsData: enrichClashData(effectsData),
        subject: subject
    });

    ChatMessage.create({
        user: game.user._id,
        content: content,
        speaker: ChatMessage.getSpeaker()
    });
}

export async function createClashMessage(actor, context) {
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-message.hbs", {
        actor: actor,
        rollContext: context,
        enrichedClashData: enrichClashData(context.getDescription()),
        skillName: context.modifiers != null && context.modifiers.item != null ? context.modifiers.item.name : null,
        skill: context.modifiers != null && context.modifiers.item != null
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