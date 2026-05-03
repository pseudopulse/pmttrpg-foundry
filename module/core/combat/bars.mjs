import { libWrapper } from "../../../lib/libwrapper_shim.js";

CONFIG.barPos = [-49, -35];
CONFIG.maskPos = [100, 104];
CONFIG.barPosAlt = [149, -35];
CONFIG.maskPosAlt = [100, 104];
CONFIG.barWH = [200, 200];
CONFIG.barScale = 1;
CONFIG.sanityWH = [45, 45];
CONFIG.sanityPos = [27, 105];

export function handleBarReplacement() {
    libWrapper.register("pmttrpg", "CONFIG.Token.objectClass.prototype._drawBar", drawBar, "MIXED");
    libWrapper.register("pmttrpg", "CONFIG.Token.objectClass.prototype.drawBars", drawBars, "OVERRIDE");
}

async function drawBars() {
    this.bars.removeChildren();

    let holder = new PIXI.Container();
    holder.name = "BarHolder";
    let tex = this.document.texture;
    let w = this.document.width;
    let h = this.document.height;
    let bounds = this.mesh.canvasBounds;

    let grid = canvas.grid.size / 100;

    holder.scale.x = tex.scaleX * (w) * grid;
    holder.scale.y = tex.scaleY * (h) * grid;

    holder.position.set(
        0 - ((-100 / 2) * (1 - (tex.scaleX)) * grid),
        -10 - (-50 * (1 - (tex.scaleY)) * grid)
    );

    holder.position.x += ((-50 * (1 - tex.scaleX)) * (1 - w) * grid);
    holder.position.y += ((-25 * (1 - tex.scaleX)) * (1 - h) * grid);

    this.bars.addChild(holder);

    if (!game.combat || !game.combat.isActive) return;

    await this._drawBar(0, getBar(this, "HP", 0, 0, holder), {
        attribute: "attributes.health",
        max: this.actor.system.attributes.health.max,
        value: this.actor.system.attributes.health.value,
    });

    await this._drawBar(0, getBar(this, "ST", 0, 0, holder), {
        attribute: "attributes.stagger",
        max: this.actor.system.attributes.stagger.max,
        value: this.actor.system.attributes.stagger.value,
    });

    await this._drawBar(0, getBar(this, "SP", 0, 0, holder), {
        attribute: "attributes.sanity",
        max: this.actor.system.attributes.sanity.max,
        value: this.actor.system.attributes.sanity.value,
    });
}

function getBar(token, id, posX, posY, holder) {
    let bar = new PIXI.Container();
    bar.name = id;
    bar.position.set(posX, posY);

    holder.addChild(bar);

    return bar;
}

async function drawBar(wrapped, number, bar, data) {
    if (data.attribute == "attributes.health") {
        addBars(bar, data, "HP");
        return;
    }

    if (data.attribute == "attributes.stagger") {
        addBars(bar, data, "ST");
        return;
    }

    if (data.attribute == "attributes.sanity") {
        drawSanity(bar, data);
        return;
    }
}

async function drawSanity(bar, data) {
    let texture = await foundry.canvas.loadTexture(
        "systems/pmttrpg/assets/bars/Sanity.png"
    );

    let icon = new PIXI.Sprite(texture);
    icon.width = CONFIG.sanityWH[0] * CONFIG.barScale;
    icon.height = CONFIG.sanityWH[1] * CONFIG.barScale;

    icon.position.set(
            CONFIG.sanityPos[0] * CONFIG.barScale,
            CONFIG.sanityPos[1] * CONFIG.barScale
    );

    bar.addChild(icon);

    drawLabel(bar, data.value, 50 * CONFIG.barScale, 127 * CONFIG.barScale, 0x9bb3f3, 20, 2);
}

// #72020a - hp bg
// #ff3c34 - hp fg
// #61580b - st bg
// #ecfb64 - st fg
// #9bb3f3 - sp num

async function addBars(bar, data, type) {
    bar.removeChildren();

    let perct = Math.clamp((data.value / data.max), 0, 1);

    let texture = await foundry.canvas.loadTexture(
        "systems/pmttrpg/assets/bars/BarSprite.png"
    );

    let fg = new PIXI.Sprite(texture);
    let bg = new PIXI.Sprite(texture);

    const w = CONFIG.barWH[0] * CONFIG.barScale;
    const h = CONFIG.barWH[1] * CONFIG.barScale;

    fg.width = w;
    fg.height = h;

    bg.width = w;
    bg.height = h;

    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);

    const radius = w / 2;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI / 2) * (perct);

    mask.moveTo(0, 0);
    mask.arc(0, 0, radius * 1.25, startAngle, endAngle);
    mask.lineTo(0, 0);
    mask.endFill();
    mask.width *= 0.75;
    mask.height *= 0.435;

    if (type == "HP") {
        bar.position.set(
            CONFIG.barPos[0] * CONFIG.barScale,
            CONFIG.barPos[1] * CONFIG.barScale
        );

        mask.position.set(
            CONFIG.maskPos[0] * CONFIG.barScale,
            CONFIG.maskPos[1] * CONFIG.barScale
        );

        mask.angle = 180;
    }

    if (type == "ST") {
        bar.position.set(
            CONFIG.barPosAlt[0] * CONFIG.barScale,
            CONFIG.barPosAlt[1] * CONFIG.barScale
        );
        bar.scale.x = -1;

        mask.position.set(
            CONFIG.maskPosAlt[0] * CONFIG.barScale,
            CONFIG.maskPosAlt[1] * CONFIG.barScale
        );

        mask.angle = -180;
    }

    let bgCol = type == "HP" ? 0x72020a : 0x61580b;
    let fgCol = type == "HP" ? 0xff3c34 : 0xecfb64;

    fg.tint = fgCol;
    bg.tint = bgCol;

    bar.addChild(bg);
    bar.addChild(fg);
    bar.addChild(mask);
    fg.mask = mask;

    drawLabel(bar, data.value, bar.width * 0.175 * bar.scale.x, bar.height * 0.75, fgCol);
}

function drawLabel(bar, text, posX, posY, col, size = 25, width = 3) {
    let barText = new PIXI.Text(text, {
        resolution: 15,
        strokeThickness: width * CONFIG.barScale,
        blurWidth: 0,
        fontSize: size * CONFIG.barScale,
        fill: `#${col.toString(16).padStart(6, "0")}`,
        stroke: "#000000",
        alpha: 1
    });

    barText.name = bar.name + "-text";
    barText.x = posX;
    barText.y = posY;
    barText.anchor.set(0.5);

    barText.resolution = 3;
    
    if (bar.scale.x == -1) barText.scale.x *= -1;
    
    bar.addChild(barText);
}