import { weaponEffects } from "./core/effects/weaponEffects.mjs";
import { PTActor } from "./documents/actor.mjs";
import { getRollContextFromData, PTItem } from "./documents/item.mjs";
import { PTActorSheet } from "./sheets/actor.mjs";
import { PTItemSheet } from "./sheets/item.mjs";
import { handler, sendNetworkMessage, registerMessages } from "./core/helpers/netmsg.mjs";
import { roundChange, turnChange, updateCombatant } from "./core/combat/combatState.mjs";
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
      switch (type) {
        case "Weapon":
          return weaponEffects.find(x => x.name == name);
        case "Outfit":
          return outfitEffects.find(x => x.name == name);
        default:
          break;
      }

      return null;
    },
    rctx(item) {
      return getRollContextFromData(item);
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
    }
  });

  Handlebars.registerPartial('ptEffect', '{{> systems/pmttrpg/templates/item/parts/effect.hbs}}')
  Handlebars.registerPartial('ptWeaponBlock', '{{> systems/pmttrpg/templates/item/parts/weapon-block.hbs}}')
  Handlebars.registerPartial('ptOutfitBlock', '{{> systems/pmttrpg/templates/item/parts/outfit-block.hbs}}')
  return preloadHandlebarsTemplates();
});

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

Hooks.on(`combatRound`, (combat, data, options) => {
  roundChange(combat, data.round, data.turn);
});

Hooks.on(`combatTurn`, (combat, data, options) => {
  turnChange(combat, data.round, data.turn);
});

Hooks.on(`combatStart`, (combat, data) => {
  turnChange(combat, data.round, data.turn);
});

Hooks.on(`updateCombatant`, (combatant, data, options, id) => {
  updateCombatant(combatant, data, id);
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


const preloadHandlebarsTemplates = async function () {
  return loadTemplates([
    'systems/pmttrpg/templates/actor/parts/actor-stats.hbs',
    'systems/pmttrpg/templates/actor/parts/actor-weapons.hbs',
    'systems/pmttrpg/templates/item/parts/effect.hbs',
    'systems/pmttrpg/templates/dialog/clash-response.hbs',
    'systems/pmttrpg/templates/dialog/clash-message.hbs',
    'systems/pmttrpg/templates/item/parts/weapon-block.hbs',
    'systems/pmttrpg/templates/item/parts/outfit-block.hbs',
    'systems/pmttrpg/templates/item/parts/resist-type.hbs',
  ]);
};