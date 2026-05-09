export const abnoCards = [
    // kod
    {
        icon: 'Teardrops',
        name: 'Blades Whetted by Teardrops', // implemented
        type: 1,
        desc: '[/damageTypes/Pierce] Pierce attacks do 10 bonus damage on a maximum roll.'
    },
    {
        icon: 'Despair',
        name: 'Despair', // implemented
        type: -1,
        desc: 'All allies gain 1 [/status/Strength] Strength and 2 [/status/Fragile] Fragile when any ally enters bleedout.'
    },

    // judgement bird
    {
        icon: 'TiltedScale',
        name: 'Tilted Scale', // implemented
        type: 1,
        desc: 'Heal an ally for 2 HP when attacking the enemy with the highest HP.'
    },
    {
        icon: 'Sin',
        name: 'Weight of Sin', // implemented
        type: -1,
        desc: 'If self or an ally rolls the minimum dice value, take 5 SP damage and gain 2 [/status/Strength] Strength.'
    },

    // spider bud
    {
        icon: 'Alertness',
        name: 'Protective Mother', // implemented
        type: 1,
        desc: 'Gain 5 [/status/Aggro] Aggro. All enemies roll your [/status/Aggro] Aggro this round.'
    },
    {
        icon: 'Cocoon',
        name: 'Cocoon', // implemented
        type: -1,
        desc: "Perform Opportunity Attacks on ANY character who attempts to leave this character's range. Inflict 1 [/status/Paralysis] Paralysis on Clash Win."
    },

    // silent orchestra
    {
        icon: 'Finale',
        name: 'The Finale', // implemented
        type: 1,
        desc: 'On a Devastating Hit against a target with 10+ [/status/Devastation] Devastation, all enemies lose 1 light.'
    },
    {
        icon: 'Adoration',
        name: 'Fervent Adoration', // implemented
        type: -1,
        desc: 'ALL characters within 3 SQR of this character [/status/Panic] Panic for the next 3 rounds. This panic type is forced to be Fight.'
    },

    // skin prophet
    {
        icon: 'Fate',
        name: 'Visions of your Fate', // implemented
        type: 1,
        desc: 'This character gains a free [/damageTypes/Evade] Evade before taking unopposed attacks.'
    },
    {
        icon: 'Future',
        name: 'A Certain Future', // implemented
        type: -1,
        desc: 'Take 10 SP damage. This character may learn the full intentions of any character at the current time.'
    },

    // wrath
    {
        icon: 'Companion',
        name: 'Companion', // implemented
        type: 1,
        desc: 'Mark a target as the Companion if no current target exists. Triggering [/status/Devastation] Devastation on the Companion restores 10 HP, 10 ST, and 1 light to all allies.'
    },
    {
        icon: 'Wrath',
        name: 'Wrath', // implemented
        type: -1,
        desc: 'Gain 3 [/status/Strength] Strength every round. This character attacks nearby units indiscriminately.'
    },
];

export function findHoldersOfPage(page) {
    let holders = [];

    if (canvas.tokens != undefined) {
        for (let token of canvas.tokens.placeables) {
            if (token.actor == null) continue;
            if (token.actor.hasAbnoPage(page)) {
                holders.push(token.actor);
            }
        }
    }

    return holders;
}