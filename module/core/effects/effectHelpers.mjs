import { weaponEffects } from "./weaponEffects.mjs";

export function handleEffectRemoveButton(event, effects) {
    let index = event.currentTarget.id.split("-")[1];
    effects.splice(index, 1);

    for (let i = 0; i < effects.length; i++) {
        effects[i].index = i;
    }
}

export function handleEffectAddButton(event, effects) {
    effects.push({
        name: "Inflict Burn",
        trigger: "Clash Win",
        count: 0,
        index: effects.length
    });
}

export function handleEffectCounterChange(event, effects, category = "Weapon") {
    let index = event.currentTarget.id.split("-")[1];
    effects[index].count = event.currentTarget.value;
    validate(effects, category);
}

export function handleEffectTypeChange(event, effects, category = "Weapon") {
    console.log(event.currentTarget.id);
    let index = event.currentTarget.id.split("-")[1];
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
        let def = null;
        switch (category) {
            case "Weapon":
                def = weaponEffects.find(x => x.name == effect.name);
                break;
            default:
                break;
        }

        if (def != null) {
            if (!def.validTriggers.find(x => x == effect.trigger)) {
                console.log("trigger " + effect.trigger + " does not exist in " + def.validTriggers);
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