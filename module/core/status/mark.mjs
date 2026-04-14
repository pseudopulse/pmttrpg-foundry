export class Mark {
    constructor(source, target, id) {
        this.source = source;
        this.target = target;
        this.id = id;
    }
}

export const MARKS = {
    None: 0,
    Aid: 1,
    Analysis: 2,
    Assassination: 3,
    Encirclement: 4,
    Exploitation: 5,
    Fanaticism: 6,
    Subjugation: 7,
    Tending: 8,
    Sniper: 9,
    Commander: 10,
    Crippling: 11,
    Puppeteer: 12,
};

export const MarkNames = {};
MarkNames[MARKS.Aid] = "Target for Aid";
MarkNames[MARKS.Analysis] = "Target for Analysis";
MarkNames[MARKS.Assassination] = "Target for Assassination";
MarkNames[MARKS.Encirclement] = "Target for Encirclement";
MarkNames[MARKS.Exploitation] = "Target for Exploitation";
MarkNames[MARKS.Fanaticism] = "Target for Fanaticism";
MarkNames[MARKS.Subjugation] = "Target for Subjugation";
MarkNames[MARKS.Tending] = "Target for Tending";
MarkNames[MARKS.Sniper] = "Sniper's Mark";
MarkNames[MARKS.Commander] = "Commander's Mark";
MarkNames[MARKS.Crippling] = "Crippling Mark";
MarkNames[MARKS.Puppeteer] = "Puppeteer's Mark";