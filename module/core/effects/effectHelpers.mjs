import { outfitEffects } from "./outfitEffects.mjs";
import { weaponEffects } from "./weaponEffects.mjs";
import { skillEffects } from "./skillEffects.mjs";
import { augmentEffects } from "./augmentEffects.mjs";
import { bulletList } from "./bullets.mjs";
import { techniqueList } from "./techniques.mjs";

export function handleEffectRemoveButton(event, effects) {
    let index = event.currentTarget.id.split("-")[2];
    effects.splice(index, 1);

    for (let i = 0; i < effects.length; i++) {
        effects[i].index = i;
    }
}

export function getEffectsArray(type) {
    switch (String(type).toLowerCase()) {
        case "weapon":
            return weaponEffects;
        case "skill":
        case "tool":
            return skillEffects;
        case "outfit":
            return outfitEffects;
        case "augment":
        case "augments":
            return augmentEffects;
        case "bullet":
            return bulletList;
        case "technique":
            return techniqueList;
        default:
            return null;
    }
}

export function handleEffectAddButton(event, effects, type) {
    effects.push({
        name: getEffectsArray(type)[0].name,
        trigger: getEffectsArray(type)[0].validTriggers,
        count: 1,
        index: effects.length
    });
}

export function handleEffectCounterChange(event, effects, category = "Weapon") {
    let index = event.currentTarget.id.split("-")[2];
    effects[index].count = event.currentTarget.value;
    validate(effects, category);
}

export function handleEffectTypeChange(event, effects, category = "Weapon") {
    let index = event.currentTarget.id.split("-")[2];
    effects[index].name = event.currentTarget.textContent;
    validate(effects, category);
}

export function handleEffectTriggerChange(event, effects, category = "Weapon") {
    let index = event.currentTarget.id.split("-")[1];
    effects[index].trigger = event.currentTarget.textContent;
    validate(effects, category);
}

export function handleNegativeText(text, altText, count) {
    if (count < 0) {
        return altText.replace("%", Math.abs(count));
    }

    return text.replace("%", count);
}

export function validate(effects, category) {
    for (const effect of effects) {
        let def = getEffectsArray(category).find(x => x.name == effect.name);

        if (def != null) {
            if (!def.validTriggers.find(x => x == effect.trigger)) {
                effect.trigger = def.validTriggers[0];
            }

            if (Math.abs(effect.count) > def.maxCount && !game.user.isGM) {
                effect.count = effect.count < 0 ? -def.maxCount : def.maxCount;
            }

            if (effect.count < 0 && !def.negativeAllowed) {
                effect.count = 0;
            }
        }
        else {
            effect.name = null;
        }
    }

    effects = effects.filter(x => x.name != null);

    return effects;
}