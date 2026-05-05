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
