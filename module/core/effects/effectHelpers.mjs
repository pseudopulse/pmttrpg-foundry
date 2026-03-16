import { outfitEffects } from "./outfitEffects.mjs";
import { weaponEffects } from "./weaponEffects.mjs";
import { skillEffects } from "./skillEffects.mjs";
import { augmentEffects } from "./augmentEffects.mjs";

export function handleEffectRemoveButton(event, effects) {
    let index = event.currentTarget.id.split("-")[2];
    effects.splice(index, 1);

    for (let i = 0; i < effects.length; i++) {
        effects[i].index = i;
    }
}

export function getEffectsArray(type) {
    switch (type.toLowerCase()) {
        case "weapon":
            return weaponEffects;
        case "skill":
            return skillEffects;
        case "outfit":
            return outfitEffects;
        case "augment":
        case "augments":
            return augmentEffects;
        default:
            return null;
    }
}

export function handleEffectAddButton(event, effects, type) {
    effects.push({
        name: getEffectsArray(type)[0].name,
        trigger: getEffectsArray(type)[0].validTriggers,
        count: 0,
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

            if (Math.abs(effect.count) > def.maxCount) {
                effect.count = effect.count < 0 ? -def.maxCount : def.maxCount;
            }

            if (effect.count < 0 && !def.negativeAllowed) {
                effect.count = 0;
            }
        }
    }
}