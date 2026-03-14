import { weaponEffects } from "./core/effects/weaponEffects.mjs";
import { PTActor } from "./documents/actor.mjs";
import { getRollContextFromData, PTItem } from "./documents/item.mjs";
import { PTActorSheet } from "./sheets/actor.mjs";
import { PTItemSheet } from "./sheets/item.mjs";
import { handler, sendNetworkMessage, registerMessages } from "./core/helpers/netmsg.mjs";
import { roundChange, turnChange, updateCombatant } from "./core/combat/combatState.mjs";
import { getEffectsArray } from "./core/effects/effectHelpers.mjs";
import { RollContext } from "./core/combat/rollContext.mjs";
import { enrichClashData } from "./core/helpers/clash.mjs";
// import Hooks from "@client/helpers/hooks.mjs";

Hooks.once("init", () => {
  // debug
  // CONFIG.debug.hooks = true;

  //
  registerMessages();

  // actor stuff
  CONFIG.Actor.documentClass = PTActor;
  CONFIG.Actor.types = ["character"];

  CONFIG.Actor.trackableAttributes = {
    character: {
      bar: ["health", "stagger", "sanity"],
      value: ["xp"]
    },
  };

  Actors.unregisterSheet('core', ActorSheet);
  Actors.registerSheet('pmttrpg', PTActorSheet, 
    {
      types: ["character"], 
      makeDefault: true, 
      label: 'PMTTRPG.SheetLabels.Actor'
    }
  );

  // item stuff
  CONFIG.Item.documentClass = PTItem;
  CONFIG.Item.types = ["weapon", "tool", "skill", "outfit"];

  Items.unregisterSheet('core', ItemSheet);
  Items.registerSheet('pmttrpg', PTItemSheet,
    {
      types: ["weapon", "tool", "skill", "outfit"],
      makeDefault: true,
      label: 'PMTTRPG.SheetLabels.Item'
    }
  )

  // combat
  CONFIG.Combat.initiative = {
    formula: '1d6 + @abilities.Justice.value',
    decimals: 2
  };
  CONFIG.ActiveEffect.legacyTransferral = false;

  // handlebar utils
  Handlebars.registerHelper({
    eq: (v1, v2) => v1 === v2,
    ne: (v1, v2) => v1 !== v2,
    lt: (v1, v2) => v1 < v2,
    gt: (v1, v2) => v1 > v2,
    lte: (v1, v2) => v1 <= v2,
    gte: (v1, v2) => v1 >= v2,
    and() {
        return Array.prototype.every.call(arguments, Boolean);
    },
    or() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    },
    effect(name, type) {
      return getEffectsArray(type).find(x => x.name == name);

      return null;
    },
    rctx(item) {
      let ctx = getRollContextFromData(item);
      ctx.item = item;
      return ctx;
    },
    drctx(item, type) {
      return getRollContextFromData(item, true, type);
    },
    reslook(item, type, cat) {
      switch (type) {
        case "Slash":
          return cat == "Stg" ? item.slashResST : item.slashRes;
        case "Pierce":
          return cat == "Stg" ? item.pierceResST : item.pierceRes;
        case "Blunt":
          return cat == "Stg" ? item.bluntResST : item.bluntRes;
        default:
          return 1;
      }
    },
    ctxc(ctx1, ctx2) {
      if (ctx1.result == "X" || ctx1.result < ctx2.result) {
        return "cm-clash-lose";
      }

      if (ctx1.result > ctx2.result || ctx2.result == "X") {
        return "cm-clash-win";
      }

      return "cm-clash-draw";
    },
    gst(system, name) {
      let status = system.statusEffects.find(x => x.name == name);

      if (status != null) {
        return status;
      }

      return {
        name: name,
        count: 0,
        nextRoundCount: 0
      }
    },
    uts(text) {
      return text.replace("_", " ");
    },
    checkCosts(actor, costs, light = 0) {
      for (const cost of costs) {
        if (actor.getStatusCount(cost.status) < cost.cost) {
          return false;
        }

        return true;
      }
    },
    recycleable(actor) {
      return actor.system.recycleAction != null;
    },
    getRecycleContext(action) {
      let ctx = fixRollContext(action.context);
      return {
        context: ctx,
        item: action.source,
        type: action.type,
        description: enrichClashData(ctx.getDescription())
      };
    }
  });

  Handlebars.registerPartial('ptEffect', '{{> systems/pmttrpg/templates/item/parts/effect.hbs}}')
  Handlebars.registerPartial('ptWeaponBlock', '{{> systems/pmttrpg/templates/item/parts/weapon-block.hbs}}')
  Handlebars.registerPartial('ptOutfitBlock', '{{> systems/pmttrpg/templates/item/parts/outfit-block.hbs}}')
  Handlebars.registerPartial('ptSkillBlock', '{{> systems/pmttrpg/templates/item/parts/skill-block.hbs}}')
  Handlebars.registerPartial('ptSkillCosts', '{{> systems/pmttrpg/templates/item/parts/skill-costs.hbs}}')
  Handlebars.registerPartial('ptConditionalCosts', '{{> systems/pmttrpg/templates/item/parts/conditional-costs.hbs}}')
  return preloadHandlebarsTemplates();
});

export function fixRollContext(context) {
  let ctx = new RollContext();
  Object.assign(ctx, context);
  ctx.fix();
  return ctx;
}

Hooks.on(`createChatMessage`, (message, action, id) => {
  if (message.title == "NETMSGFLAG") {
    handler[message.flavor](JSON.parse(message.content));
  }
});

Hooks.on(`renderChatMessageHTML`, (message, html, context) => {
  if (message.title == "NETMSGFLAG") {
    hideChatMessage(html);
  }
});

Hooks.on(`combatRound`, async (combat, data, options) => {
  await roundChange(combat, data.round, data.turn);
});

Hooks.on(`combatTurn`, async (combat, data, options) => {
  await turnChange(combat, data.round, data.turn);
});

Hooks.on(`combatStart`, async (combat, data) => {
  await roundChange(combat, data.round, data.turn);
});

Hooks.on(`updateCombatant`, async (combatant, data, options, id) => {
  await updateCombatant(combatant, data, id);
});


/**
 * @param {HTMLElement} html
 */
function hideChatMessage(html) {
  while (html.firstChild != null) {
    html.removeChild(html.firstChild);
  }

  html.remove();
  html.style.setProperty("display", "none", "important");
}

export function findItemOwner(item) {
  for (const token of canvas.tokens.placeables) {
    if (token.actor == null) continue;
      for (const aItem of token.actor.items) {
        if (aItem._id == item._id) {
          return token.actor;
        }
      }
  }

  for (const actor of game.actors) {
    for (const aItem of actor.items) {
      if (aItem._id == item._id) {
        return actor;
      }
    }
  }

  return null;
}

export function searchByObject(actor) {
    if (canvas.tokens != undefined) {
      for (let token of canvas.tokens.placeables) {
        if (token.actor == null) continue;
        if (token.actor._id == actor._id) {
            return token.actor;
        }
      }
    }

    return game.actors.get(actor._id);
}

export function searchForActor(id) {
    if (canvas.tokens != undefined) {
      for (let token of canvas.tokens.placeables) {
        if (token.actor == null) continue;
        if (token.actor._id == id) {
            return token.actor;
        }
      }
    }

    return game.actors.get(id);
}

export function roughSizeOfObject(object) {
  const objectList = [];
  const stack = [object];
  let bytes = 0;

  while (stack.length) {
    const value = stack.pop();

    switch (typeof value) {
      case 'boolean':
        bytes += 4;
        break;
      case 'string':
        bytes += value.length * 2;
        break;
      case 'number':
        bytes += 8;
        break;
      case 'object':
        if (!objectList.includes(value)) {
          objectList.push(value);
          for (const prop in value) {
            if (value.hasOwnProperty(prop)) {
              stack.push(value[prop]);
            }
          }
        }
        break;
    }
  }

  return bytes;
}

const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    'systems/pmttrpg/templates/actor/parts/actor-stats.hbs',
    'systems/pmttrpg/templates/actor/parts/actor-weapons.hbs',
    'systems/pmttrpg/templates/actor/parts/actor-outfits.hbs',
    'systems/pmttrpg/templates/actor/parts/actor-skills.hbs',
    'systems/pmttrpg/templates/actor/parts/actor-status.hbs',
    'systems/pmttrpg/templates/actor/parts/actor-combat.hbs',
    'systems/pmttrpg/templates/actor/parts/actor-augments.hbs',
    //
    'systems/pmttrpg/templates/item/parts/effect.hbs',
    'systems/pmttrpg/templates/item/parts/resist-type.hbs',
    'systems/pmttrpg/templates/item/parts/skill-costs.hbs',
    'systems/pmttrpg/templates/item/parts/conditional-costs.hbs',
    //
    'systems/pmttrpg/templates/dialog/clash-response.hbs',
    'systems/pmttrpg/templates/dialog/clash-message.hbs',
    'systems/pmttrpg/templates/dialog/clash-result.hbs',
    'systems/pmttrpg/templates/dialog/clash-effects.hbs',
    //
    'systems/pmttrpg/templates/item/parts/weapon-block.hbs',
    'systems/pmttrpg/templates/item/parts/skill-block.hbs',
    'systems/pmttrpg/templates/item/parts/outfit-block.hbs',
  ]);
};