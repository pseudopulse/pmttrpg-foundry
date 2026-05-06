export function enrichClashData(str) {
    if (str.startsWith("\n")) {
        str = str.substring(1)
    }
    str = merge(str);
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

function merge(text) {
  const lines = text.split('\n');
  if (lines.length == 0) {
    lines = [text];
  }

  const map = {};
  const swapMap = {};
  let toReplace = [];
  let alreadyDone = [];
  let result = "";
  let swapIndex = 0;
  let parser = new DOMParser();

  for (let line of lines) {
    let cleanLine = parser.parseFromString(line, "text/html");
    let span = cleanLine.querySelector("span");
    let text = "";
    if (span) {
        text = span.textContent;
        span.remove();
    }
    cleanLine = text + cleanLine.body.textContent;

    let num = cleanLine.match(/\d+/);
    if (num) {
        num = num[0];
        let purged = cleanLine.replace(/\d+/, ``);
        if (line.includes("</span>")) {
            let substr = line.substring(0, line.indexOf("</span>", 0) + "</span>".length);
            line = substr + cleanLine.replace(/\d+/, `%/${swapIndex}%`).replace(`${text}`, '');
        }
        else {
            line = line.replace(/\d+/, `%/${swapIndex}%`);
        }

        if (!alreadyDone.find(x => x == purged)) {
            alreadyDone.push(purged);
            map[swapIndex] = num;
            swapMap[purged] = swapIndex;
            toReplace.push(swapIndex);
            swapIndex++;
            result = result + line + "\n";
        }
        else {
            map[swapMap[purged]] = Number(map[swapMap[purged]]) + Number(num);
        }
    }
    else {
        result = result + line + "\n";
    }
  }

  for (let index of toReplace) {
    result = result.replace(`%/${index}%`, map[index]);
  }

  if (result.endsWith("\n")) {
    result = result.replace(/\n$/, '');
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
    context.minRoll = Math.max(1 + context.dicePower, 0);
    context.maxRoll = Math.max(context.diceMax + context.dicePower, 0)

    let rollColor = "cm-col-standard";
    if (context.result >= context.maxRoll) {
        rollColor = "cm-col-max";
    }
    if (context.result <= context.minRoll) {
        rollColor = "cm-col-min";
    }
    const content = await renderTemplate("systems/pmttrpg/templates/dialog/clash-message.hbs", {
        actor: actor,
        rollContext: context,
        enrichedClashData: enrichClashData(context.getDescription()),
        skillName: context.modifiers != null && context.modifiers.item != null ? context.modifiers.item.name : null,
        skill: context.modifiers != null && context.modifiers.item != null,
        rollColor: rollColor,
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