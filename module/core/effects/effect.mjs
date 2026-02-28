export class Effect {
    constructor(name, apply, description, validTriggers = ["Clash Win", "Clash Lose", "On Use", "Always Active"], negativeAllowed = true, maxCount = 5, dontFormat = false) {
        this.name = name;
        this.apply = apply;
        this.description = description;
        this.validTriggers = validTriggers;
        this.negativeAllowed = negativeAllowed;
        this.maxCount = maxCount;
        this.dontFormat = dontFormat;
    }
}