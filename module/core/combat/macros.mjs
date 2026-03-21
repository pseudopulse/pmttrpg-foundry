export const macroList = {};

export async function registerEffectMacro(name, call, img = "icons/Placeholder.png") {
  if (macroList[name] == null) {
    macroList[name] = call;
  }

  let exec = `game.pmttrpg.macroList["${name}"](canvas.tokens.controlled[0].actor);`
  let macro = game.macros.find(x => x.name == name && x.command == exec);

  if (macro == null) {
    macro = await Macro.create({
      name: name,
      type: 'script',
      img: `systems/pmttrpg/assets/${img}`,
      command: exec,
      author: game.user
    });
  }
  else {
    macro.img = `systems/pmttrpg/assets/${img}`;
  }

  macro.ownership.default = 3;
  macro.ownership[game.user.id] = 3;

  await game.user.assignHotbarMacro(macro, getNextOpenSlot());
}

function getNextOpenSlot() {
  return Number(game.user.getHotbarMacros().filter(x => x.macro != null).length) + 1;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== 'Item') return;
  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    return ui.notifications.warn(
      'You can only create macro buttons for owned Items'
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.boilerplate.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command: command,
      flags: { 'boilerplate.itemMacro': true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}