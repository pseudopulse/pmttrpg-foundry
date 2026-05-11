import { sendNetworkMessage } from "../helpers/netmsg.mjs";
import { spawnDynamicUI } from "../helpers/ui.mjs";
import { loadHazards, updateHazards } from "../../pmttrpg.mjs";
import { createEffectsMessage } from "../helpers/clash.mjs";


/** @type {Hazard[]} activeHazards */
let activeHazards = [];

CONFIG.hazards = getHazardAtTile

export function getHazardAtTile(tile) {
    let point = getGridPoint(tile);

    for (let hazard of activeHazards) {
        if (!hazard.affectedTiles) continue;
        for (let affectedTile of hazard.affectedTiles) {
            let tilePoint = getGridPoint(affectedTile);

            if (tilePoint.x == point.x && tilePoint.y == point.y) {
                return hazard.type;
            }
        }
    }

    return HazardType.NONE;
}

export async function loadAllHazards() {
    let hazards = loadHazards();
    activeHazards = [];
    
    for (let hazardData of hazards) {
        await addHazardInternal(hazardData.type, hazardData.duration, hazardData.source, hazardData.affectedTiles);
    }
}

export function getHazardsBetweenTwoPoints(a, b) {
    let hazards = [];
    let angle = Math.atan2(b.y - a.y, b.x - a.x);

    for (let i = 0; i < Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / canvas.grid.size) + 1; i++) {
        let point = {
            x: a.x + (i * canvas.grid.size * Math.cos(angle)),
            y: a.y + (i * canvas.grid.size * Math.sin(angle)),
        };

        if (getHazardAtTile(point) != HazardType.NONE) {
            hazards.push(getHazardAtTile(point));
        }
    }

    return hazards;
}

export function getHazardsBetweenTwoPointsFull(a, b) {
    let hazards = [];
    let angle = Math.atan2(b.y - a.y, b.x - a.x);

    for (let i = 0; i < Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / canvas.grid.size) + 1; i++) {
        let point = {
            x: a.x + (i * canvas.grid.size * Math.cos(angle)),
            y: a.y + (i * canvas.grid.size * Math.sin(angle)),
        };

        if (getHazardAtTile(point) != HazardType.NONE) {
            hazards.push({
                point: getGridPoint(point),
                type: getHazardAtTile(point),
            });
        }
    }

    return hazards;
}

export function getHazardCountBetweenTwoPoints(hazard, pointA, pointB) {
    return getHazardsBetweenTwoPoints(pointA, pointB).filter(h => h === hazard).length;
}

export async function handleHazardMovement(token, from, to) {
    let hazards = getHazardsBetweenTwoPointsFull(from, to);
    let alreadyTriggered = token.actor.system.alreadyTriggeredHazards || [];

    let statusInflictions = {};
    let lines = [];

    let anyCleansingGasTriggered = alreadyTriggered.some(x => getHazardAtTile(x) == HazardType.CLEANSING_GAS);

    for (let hazard of hazards) {
        if (!alreadyTriggered.find(x => x.x == hazard.point.x && x.y == hazard.point.y)) {
            alreadyTriggered.push(hazard.point);
        }
        else {
            continue;
        }

        let status = getStatusForHazard(hazard.type);
        if (status != "None") {
            let total = await doRoll("1d6");
            await token.actor.applyStatus(status, total);
            statusInflictions[status] = (statusInflictions[status] || 0) + total;
        }
        else if (hazard.type == HazardType.CLEANSING_GAS) {
            if (!anyCleansingGasTriggered) {
                let roll = await doRoll(`2d6+${token.actor.system.abilities.Fortitude.value}-2`);
                
                if (roll <= 6) {
                    let damage = await doRoll(`4d6`);
                    await token.actor.takeDamage(0, null, 0, damage, 0, false);
                    lines.push(`Rolls ${roll} and takes ${damage} ST damage from the Cleansing Gas!`);
                }
                else if (roll <= 9) {
                    let damage = await doRoll(`2d6`);
                    await token.actor.takeDamage(0, null, 0, damage, 0, false);
                    lines.push(`Rolls ${roll} and takes ${damage} ST damage from the Cleansing Gas!`);
                }
                else {
                    lines.push(`Resists the Cleansing Gas with a roll of ${roll}!`);
                }
            }
        }
    }

    for (let [status, value] of Object.entries(statusInflictions)) {
        lines.push(`Gains ${value} [/status/${status}] ${status} from ${HazardNames[getHazardForStatus(status)]}!`);
    }

    createEffectsMessage(token.actor.name, format(lines));

    await token.actor.update({ "system.alreadyTriggeredHazards": alreadyTriggered }, { diff: false, render: true });
}

async function doRoll(formula) {
    let roll = new Roll(formula);
    let res = await roll.evaluate();

    return res.total;
}

function format(lines) {
    let desc = "";
    for (const str of lines) {
        desc = desc + `${str}\n`;
    }

    return desc;
}

export async function addHazardInternal(type, rounds, source, affectedTiles) {
    let hazard = new Hazard(type, rounds, source);
    hazard.affectedTiles = affectedTiles;
    activeHazards.push(hazard);

    if (game.user.isActiveGM) {
        await updateHazards(activeHazards);
    }

    hazard.display = await spawnDynamicUI(
        async (data) => {
            let bg = new PIXI.Graphics();
            bg.alpha = 0.3;
            data.root.addChild(bg);
            data.bg = bg;
            let lines = new PIXI.Graphics();
            data.root.addChild(lines);
            data.lines = lines;
            data.bg.eventMode = 'static';
            data.bg.interactive = false;
            data.bg.hitArea = new PIXI.Rectangle(0, 0, 0, 0);

            data.tiles = [];
            data.cells = new Set();
            for (let point of affectedTiles) {
                let gridPoint = canvas.grid.getSnappedPosition(point.x - canvas.grid.size, point.y - canvas.grid.size);

                const x = Math.round(gridPoint.x / canvas.grid.size);
                const y = Math.round(gridPoint.y / canvas.grid.size);

                data.cells.add(`${x},${y}`);
            }
        },
        async (data) => {
            data.lines.clear();
            data.lines.lineStyle(20 * getZoom(), HazardColors[hazard.type], 1);
            data.bg.clear();
            data.bg.beginFill(HazardColors[hazard.type], 1);

            for (let cell of data.cells) {
                let [x, y] = cell.split(",").map(Number);
                x *= canvas.grid.size;
                y *= canvas.grid.size;

                data.bg.drawRect(x, y, canvas.grid.size, canvas.grid.size);

                for (let dir of dirs) {
                    let neighbor = `${x / canvas.grid.size + dir.dx},${y / canvas.grid.size + dir.dy}`;
                    if (!data.cells.has(neighbor)) {
                        if (dir.side == "top" || dir.side == "bottom") {
                            data.lines.moveTo(x, y + (dir.side == "top" ? 0 : canvas.grid.size));
                            data.lines.lineTo(x + canvas.grid.size, y + (dir.side == "top" ? 0 : canvas.grid.size));
                        }
                        else {
                            data.lines.moveTo(x + (dir.side == "left" ? 0 : canvas.grid.size), y);
                            data.lines.lineTo(x + (dir.side == "left" ? 0 : canvas.grid.size), y + canvas.grid.size);
                        }
                    }
                }
            }
        }, false, 1000 / 30
    );

    const dirs = [
        { dx: 0, dy: -1, side: "top" },
        { dx: 1, dy: 0, side: "right" },
        { dx: 0, dy: 1, side: "bottom" },
        { dx: -1, dy: 0, side: "left" }
    ];
};

export async function addHazard(type, rounds, source, affectedTiles) {
    sendNetworkMessage("CREATE_HAZARD", {
        type: type,
        rounds: rounds,
        source: source,
        affectedTiles: affectedTiles,
    });
}

export async function roundEndInternal() {
    for (let i = 0; i < activeHazards.length; i++) {
        let hazard = activeHazards[i];
        hazard.duration--;

        if (hazard.duration <= 0) {
            if (hazard.display) {
                hazard.display.destroy();
            }
        }
    }

    activeHazards = activeHazards.filter(hazard => hazard.duration > 0);
    await updateHazards(activeHazards);
}

export async function roundEnd() {
    sendNetworkMessage("ROUND_END_HAZARD", {});
}

export function getGridPoint(point) {
    point = canvas.grid.getCenterPoint(point);

    return {
        x: Math.floor(point.x / canvas.grid.size),
        y: Math.floor(point.y / canvas.grid.size),
    };
}

export function getWorldPoint(point) {
    return {
        x: point.x * canvas.grid.size,
        y: point.y * canvas.grid.size,
    };
}

function getZoom() {
    return canvas.stage.scale.x;
}

class Hazard {
    constructor(type, rounds, source) {
        this.type = type;
        this.duration = rounds;
        this.source = source;
        this.affectedTiles = [];
        this.display = null;
    }
}

export function getStatusForHazard(type) {
    return HazardStatusEffects[type] || "None";
}

export function getHazardForStatus(status) {
    for (let [hazard, eff] of Object.entries(HazardStatusEffects)) {
        if (eff == status) {
            return parseInt(hazard);
        }
    }

    return HazardType.NONE;
}

export const HazardType = {
    NONE: -1,
    TOXIC_FUMES: 0,
    EXPOSED_FIRE: 1,
    CLEANSING_GAS: 2,
    BROKEN_GLASS: 3,
    CHILLING_FROST: 4,
    EXHAUST_FUMES: 5,
    TEAR_GAS: 6,
    DIFFICULT_TERRAIN: 7,
    SLIPPERY_TERRAIN: 8,
};

export const HazardNames = {
    [HazardType.NONE]: "None",
    [HazardType.TOXIC_FUMES]: "Toxic Fumes",
    [HazardType.EXPOSED_FIRE]: "Exposed Fire",
    [HazardType.CLEANSING_GAS]: "Cleansing Gas",
    [HazardType.BROKEN_GLASS]: "Broken Glass",
    [HazardType.CHILLING_FROST]: "Chilling Frost",
    [HazardType.EXHAUST_FUMES]: "Exhaust Fumes",
    [HazardType.TEAR_GAS]: "Tear Gas",
    [HazardType.DIFFICULT_TERRAIN]: "Difficult Terrain",
    [HazardType.SLIPPERY_TERRAIN]: "Slippery Terrain",
}

export const HazardStatusEffects = {
    [HazardType.TOXIC_FUMES]: "Poison",
    [HazardType.EXPOSED_FIRE]: "Burn",
    [HazardType.CLEANSING_GAS]: "None",
    [HazardType.BROKEN_GLASS]: "Bleed",
    [HazardType.CHILLING_FROST]: "Frostbite",
    [HazardType.EXHAUST_FUMES]: "Smoke",
    [HazardType.TEAR_GAS]: "None",
    [HazardType.DIFFICULT_TERRAIN]: "None",
    [HazardType.SLIPPERY_TERRAIN]: "None",
};

// #00FF00 - Toxic Fumes
// #ff7300ff - Exposed Fire
// #72ff8aff - Cleansing Gas
// #ff0000ff - Broken Glass
// #00ffddff - Chilling Frost
// #555555 - Exhaust Fumes
// #def848ff - Tear Gas
// #3c3746ff - Difficult Terrain
// #a1e9ffff - Slippery Terrain

export const HazardColors = {
    [HazardType.TOXIC_FUMES]: 0x00FF00,
    [HazardType.EXPOSED_FIRE]: 0xff7300,
    [HazardType.CLEANSING_GAS]: 0x72ff8a,
    [HazardType.BROKEN_GLASS]: 0xff0000,
    [HazardType.CHILLING_FROST]: 0x00ffdd,
    [HazardType.EXHAUST_FUMES]: 0x555555,
    [HazardType.TEAR_GAS]: 0xdef848,
    [HazardType.DIFFICULT_TERRAIN]: 0x3c3746,
    [HazardType.SLIPPERY_TERRAIN]: 0xa1e9ff,
};