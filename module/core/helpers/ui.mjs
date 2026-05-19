import { generateUUID } from "../../pmttrpg.mjs";

export function getContainer(overlay = false) {
    let container = new PIXI.Container();
    container.id = generateUUID();

    if (overlay) {
        canvas.overlay.addChild(container);
    }
    else {
        canvas.app.stage.addChild(container);
    }
    return container;
}

export async function getSprite(path, width, height, pos) {
    let texture = await getTexture(`systems/pmttrpg/assets/${path}`);

    let sprite = new PIXI.Sprite(texture);
    sprite.id = generateUUID();
    sprite.width = width;
    sprite.height = height;
    sprite.position.set(pos.x - (width / 2), pos.y - (height / 2));

    return sprite;
}

export function removeObject(element, overlay = false) {
    if (overlay) {
        canvas.overlay.removeChild(element);
    }
    else {
        canvas.app.stage.removeChild(element);
    }
}

export async function spawnDynamicUI(create, tick, overlay = false, freq = 1000 / 60) {
    let container = getContainer(overlay);

    let data = {};
    data.root = container;
    data.age = 0;
    data.delta = freq / 1000;
    await create(data);
    data.destroy = () => {
        clearInterval(interval);
        removeObject(data.root, overlay);
    };

    let interval = setInterval(async () => {
        await tick(data);
        data.age += freq;
    }, freq);

    return data;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function lerpColor(colorA, colorB, t) {
    const r1 = (colorA >> 16) & 0xFF;
    const g1 = (colorA >> 8) & 0xFF;
    const b1 = colorA & 0xFF;

    const r2 = (colorB >> 16) & 0xFF;
    const g2 = (colorB >> 8) & 0xFF;
    const b2 = colorB & 0xFF;

    const r = Math.round(lerp(r1, r2, t));
    const g = Math.round(lerp(g1, g2, t));
    const b = Math.round(lerp(b1, b2, t));

    return (r << 16) | (g << 8) | b;
}

let assetCache = {};

export async function getTexture(path) {
    if (assetCache[path] != null) {
        return assetCache[path];
    }

    let texture = await foundry.canvas.loadTexture(path);
    assetCache[path] = texture;
    return texture;
}