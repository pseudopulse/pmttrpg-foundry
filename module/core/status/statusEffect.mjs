import { PTActor } from "../../documents/actor.mjs"

export class StatusEffect {
    /**
     * @callback trigger
     * @param {PTActor} actor
     */

    /**
     * @param {string} name 
     * @param {Number} triggerType 
     * @param {trigger} activation
     */
    constructor(name, triggerType, activation, decay) {
        this.name = name;
        this.triggerType = triggerType;
        this.activation = activation;
        this.decay = decay;
    }
}

export const Triggers = {
    END: 1,
    START: 2,
    ACTION: 3,
    HIT: 4,
    BURST: 5,
    NONE: 6
}