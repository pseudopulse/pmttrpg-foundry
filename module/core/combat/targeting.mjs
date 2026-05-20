import { getDistance, getTokenCenter, gridDistanceBetween } from "../../pmttrpg.mjs";
import { getSprite, lerpColor, spawnDynamicUI } from "../helpers/ui.mjs";
import { getCombatantTokens } from "./combatState.mjs";

let targetingCursorOn = false;
let currentStyleElement = null;

/**
* @param {TargetingOptions} options
*/
export async function requestTargeting(type, options = {}) {
    return new Promise(async (resolve, reject) => {
        let results = [];
        let resolved = false;
        let lastRightClick = 0;

        let uiObjects = [];

        if (type == TargetType.MULTI_TOKEN) {
            game.user._onUpdateTokenTargets([]);
        }

        let finish = () => {
            if (resolved) return;
            if (results.length == 0) { resolve(null); }
            else if (results.length == 1 && (type != TargetType.MULTI_GRID && type != TargetType.MULTI_TOKEN)) { resolve(results[0]); }
            else { resolve(results); }
            
            document.removeEventListener("click", clickHandler, true);
            document.removeEventListener("contextmenu", rightClickHandler, true);
            document.removeEventListener("dblclick", doubleClickHandler, true);
            disableTargetingCursor();
            resolved = true;
            ui.notifications.remove(notif);

            if (type == TargetType.MULTI_TOKEN) {
                game.user._onUpdateTokenTargets([]);
            }

            for (let element of uiObjects) {
                element.destroy();
            }
        };

        let notification = null;
        switch (type) {
            case TargetType.TOKEN:
                notification = `Left Click on a Token to target. Double Right Click to end targeting mode without selecting.`;
                break;
            case TargetType.MULTI_TOKEN:
                notification = `Left Click on a Token to toggle targeting. Double Right Click to confirm selection.`;
                break;
            case TargetType.GRID:
                notification = `Left Click on a Grid Space to target. Double Right Click to end targeting mode without selecting.`;
                break;
            case TargetType.MULTI_GRID:
                notification = `Left Click on a Grid Space to toggle targeting. Double Right Click to confirm selection.`;
                break;
            default:
                notification = `You shouldn't be seeing this.`;
                break;
        }

        let notif = ui.notifications.info(notification, { permanent: true });

        options = Object.assign(new TargetingOptions(), options);

        // cancel on double right click
        let rightClickHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();

            const now = Date.now();

            if (now - lastRightClick < 500) {
                finish();
            }

            lastRightClick = now;
        }

        let clickHandler = async (event) => {
            if (event.button != 0) return;
            event.preventDefault();
            event.stopPropagation();

            let point = screenToWorld(event.clientX, event.clientY);

            if (type == TargetType.TOKEN || type == TargetType.MULTI_TOKEN) {
                let selected = getCombatantTokens().find(x => {
                    if (x.actor == null) return;
                    if (!options.tokenFilter(x)) return;
                    let bounds = x.mesh._canvasBounds;

                    if (options.enforceRange && options.originToken != null) {
                        if (getDistance(options.originToken, x) > options.ranges.length > 0 ? options.ranges.sort((a, b) => b - a)[0] : options.maxRange) {
                            return false;
                        }
                    }

                    if (options.requireLOS && options.originToken) {
                        if (options.originToken.checkCollision({ x: point.x, y: point.y })) {
                            return false;
                        }
                    }

                    return point.x > bounds.minX && point.x < bounds.maxX &&
                    point.y > bounds.minY && point.y < bounds.maxY;
                });

                if (selected != null) { // multi-target selection          
                    if (type == TargetType.MULTI_TOKEN) {
                        if (!results.includes(selected)) {
                            results.push(selected);
                            
                            // create the targeting indicator and store it
                            uiObjects.push(await spawnDynamicUI(
                                async (data) => {
                                    data.sprite = await getSprite(options.targetIcon, 128, 128, { x: selected.document.x, y: selected.document.y });
                                    data.root.addChild(data.sprite);
                                    data.scale = 1 * (canvas.grid.size / 256);
                                    data.scaleDirection = 1;
                                    data.target = selected;
                                },
                                async (data) => {
                                    if (data.scale > 1.1) { data.scaleDirection = -0.2; }
                                    else if (data.scale < 0.9) { data.scaleDirection = 0.2; };

                                    data.scale += data.delta * data.scaleDirection;
                                    data.sprite.scale.x = data.scale;
                                    data.sprite.scale.y = data.scale;

                                    data.sprite.position.set(
                                        data.target.document.x - ((data.sprite.width / 2) * data.scale),
                                        data.target.document.y - ((data.sprite.height / 2) * data.scale),
                                    );
                                },
                            ));
                            
                            if (results.length > options.maxSelections) {
                                results.splice(0, 1);
                            }
                        }
                        else {
                            // destroy the indicator early if we unselect
                            let element = uiObjects.find(x => x.target == selected);
                            uiObjects = uiObjects.filter(x => x != element);
                            element.destroy();
                            
                            results = results.filter(x => x != selected);
                        }
                    } else { // single-target selection
                        results.push(selected);
                        finish();
                    }
                }
            }

            if (type == TargetType.GRID || type == TargetType.MULTI_GRID) {
                let gridPoint = canvas.grid.getCenterPoint(point);

                if (options.enforceRange && options.originToken != null) {
                    if (Math.round(gridDistanceBetween(getTokenCenter(options.originToken), gridPoint)) > options.maxRange) {
                        return;
                    }
                }

                if (options.requireLOS && options.originToken) {
                    if (options.originToken.checkCollision({ x: gridPoint.x, y: gridPoint.y })) {
                        return;
                    }
                }

                if (type == TargetType.MULTI_GRID) {
                    if (!results.find(x => x.x == gridPoint.x && x.y == gridPoint.y)) {
                        results.push(gridPoint);
                        if (results.length > options.maxSelections) {
                            results.splice(0, 1);
                        }

                        gridSpaceTargeter.update(results);
                    }
                    else {
                        results = results.filter(x => !(x.x == gridPoint.x && x.y == gridPoint.y));

                        gridSpaceTargeter.update(results);
                    }
                } else {
                    results.push(gridPoint);
                    finish();
                }
            }
        }

        let doubleClickHandler = (event) => {
            event.preventDefault();
            event.stopPropagation();
        }

        document.addEventListener("click", clickHandler, true);
        document.addEventListener("dblclick", doubleClickHandler, true);
        document.addEventListener("contextmenu", rightClickHandler, true);
        enableTargetingCursor();

        let gridSpaceTargeter = null;
        if (type == TargetType.MULTI_GRID) {
            const dirs = [
                { dx: 0, dy: -1, side: "top" },
                { dx: 1, dy: 0, side: "right" },
                { dx: 0, dy: 1, side: "bottom" },
                { dx: -1, dy: 0, side: "left" }
            ];
            gridSpaceTargeter = await spawnDynamicUI(
                async (data) => {
                    let bg = new PIXI.Graphics();
                    bg.alpha = 0.7;
                    data.root.addChild(bg);
                    data.bg = bg;
                    data.tiles = [];
                    data.cells = new Set();
                    data.update = (results) => {
                        data.cells = new Set();
                        for (let point of results) {
                            let gridPoint = canvas.grid.getSnappedPosition(point.x - canvas.grid.size, point.y - canvas.grid.size);

                            const x = Math.round(gridPoint.x / canvas.grid.size);
                            const y = Math.round(gridPoint.y / canvas.grid.size);

                            data.cells.add(`${x},${y}`);      
                        }
                    }
                },
                async (data) => {
                    data.bg.clear();
                    data.bg.lineStyle(40 * getZoom(), 0xFFFF00, 1);

                    for (let cell of data.cells) {
                        let [x, y] = cell.split(",").map(Number);
                        x *= canvas.grid.size;
                        y *= canvas.grid.size;
                        
                        for (let dir of dirs) {
                            let neighbor = `${x / canvas.grid.size + dir.dx},${y / canvas.grid.size + dir.dy}`;
                            if (!data.cells.has(neighbor)) {
                                if (dir.side == "top" || dir.side == "bottom") {
                                    data.bg.moveTo(x, y + (dir.side == "top" ? 0 : canvas.grid.size));
                                    data.bg.lineTo(x + canvas.grid.size, y + (dir.side == "top" ? 0 : canvas.grid.size));
                                }
                                else {
                                    data.bg.moveTo(x + (dir.side == "left" ? 0 : canvas.grid.size), y);
                                    data.bg.lineTo(x + (dir.side == "left" ? 0 : canvas.grid.size), y + canvas.grid.size);
                                }
                            }
                        }
                    }
                }, false, 1000 / 30
            );

            uiObjects.push(gridSpaceTargeter);
        }

        // handle range indicators
        if (options.originToken != null && (options.ranges.length > 0 || options.maxRange > 0)) {
            uiObjects.push(await spawnDynamicUI(
                async (data) => {
                    let highestRange = options.ranges.length > 0 ? options.ranges.sort((a, b) => b - a)[0] : options.maxRange;
                    highestRange += 1;
                    let bg = new PIXI.Graphics();
                    bg.alpha = 0.7;

                    let mask = new PIXI.Graphics();
                    bg.mask = mask;

                    data.root.addChild(bg);
                    data.root.addChild(mask);

                    data.bg = bg;
                    data.mask = mask;
                    data.range = highestRange;
                    data.ranges = [];

                    let alreadyDone = [];
                    options.ranges.push(highestRange - 1);
                    if (options.ranges.length > 0) {
                        for (let range of options.ranges) {
                            if (alreadyDone.includes(range)) {
                                continue;
                            }
                            alreadyDone.push(range);
                            
                            let rangeData = {};
                            let indicator = new PIXI.Graphics();
                            data.root.addChild(indicator);
                            
                            rangeData.indicator = indicator;
                            rangeData.range = range + 1;
                            rangeData.color = lerpColor(0xFF0000, 0x00FF00, 1 - (range / 20));

                            let labels = options.rangeLabels[range];
                            if (labels != null) {
                                let labelText = "";
                                for (let name of labels) {
                                    labelText = labelText + " " + name + ",";
                                }
                                labelText = labelText.substring(0, labelText.length - 1);

                                let label = new PIXI.Text(labelText, {
                                    resolution: 15,
                                    blurWidth: 0,
                                    alpha: 1,
                                    stroke: "#000000",
                                    fill: `#${rangeData.color.toString(16).padStart(6, "0")}`,
                                });

                                rangeData.label = label;

                                data.root.addChild(label);
                            }

                            data.ranges.push(rangeData);
                        }
                    }
                },
                async (data) => {
                    let root = data.root;
                    let bg = data.bg;
                    let mask = data.mask;
                    let screen = { x: canvas.screenDimensions[0], y: canvas.screenDimensions[1] };

                    let center = getTokenCenter(options.originToken);
                    let pos = worldToScreen(center.x, center.y);

                    bg.clear();
                    bg.beginFill(0x000000);
                    bg.drawRect(-1e6, -1e6, 2e6, 2e6);
                    bg.endFill();
                    bg.alpha = 0.7;

                    mask.clear();
                    mask.beginFill(0xffffff);
                    mask.drawRect(-1e6, -1e6, 2e6, 2e6);
                    mask.endFill();
                    mask.beginHole();
                    mask.drawCircle(pos.x, pos.y, 210 * getZoom() * data.range * (canvas.grid.size / 256));
                    mask.endHole();
                    mask.endFill();

                    bg.cullable = false;
                    mask.cullable = false;

                    if (options.requireLOS) {
                        let radius = canvas.grid.size * data.range - (canvas.grid.size / 2);
                        let size = canvas.grid.size;
                        
                        let xMin = Math.floor((center.x - radius) / size) * size;
                        let xMax = Math.floor((center.x + radius) / size) * size;

                        let yMin = Math.floor((center.y - radius) / size) * size;
                        let yMax = Math.floor((center.y + radius) / size) * size;

                        mask.beginFill(0xff0000);

                        for (let x = xMin; x <= xMax; x += size) {
                            for (let y = yMin; y <= yMax; y += size) {
                                let dx = x - center.x;
                                let dy = y - center.y;

                                if (dx * dx + dy * dy <= radius * radius) {
                                    let valid = options.originToken.checkCollision({ x: x, y: y });

                                    if (valid) {
                                        let p = worldToScreen(x - (size / 2), y - (size / 2));
                                        mask.drawRect(p.x, p.y, size * getZoom(), size * getZoom());
                                    }
                                }
                            }
                        }

                        mask.endFill();
                    }

                    for (let range of data.ranges) {
                        let indicator = range.indicator;
                        let radius = (210 * getZoom() * range.range * (canvas.grid.size / 256));
                        
                        indicator.clear();
                        indicator.lineStyle(15 * getZoom(), range.color, 1);
                        indicator.arc(pos.x, pos.y, radius, Math.PI, (Math.PI * 4) + Math.PI / 2);

                        if (range.label != null) {
                            let label = range.label;
                            label.resolution = 5;
                            label.style.strokeThickness = 0;
                            label.style.fontSize = 25 * getZoom() * range.range;
                            label.position.set(pos.x - label.width / 2, pos.y - (radius + (20 * getZoom() * range.range)) - label.height / 2);
                            label.dirty = true;
                        }
                    }
                },
                true // this is an overlay
            ));
        }
    });
}

function getZoom() {
    return canvas.stage.scale.x;
}

function screenToWorld(x, y) {
    let transform = canvas.app.stage.worldTransform;
    x = (x - transform.tx) / canvas.stage.scale.x;
    y = (y - transform.ty) / canvas.stage.scale.y;
    
    return { x: x, y: y }; 
}

function worldToScreen(x, y) {
    let transform = canvas.app.stage.worldTransform;

    x = (x * canvas.stage.scale.x) + transform.tx;
    y = (y * canvas.stage.scale.y) + transform.ty;

    return { x: x, y: y };
}

export const TargetType = {
    TOKEN: 0,
    GRID: 1,
    MULTI_TOKEN: 2,
    MULTI_GRID: 3
};

function enableTargetingCursor() {
    if (targetingCursorOn) return;
    targetingCursorOn = true;

    let url = "systems/pmttrpg/assets/icons/TargetIcon.png";
    let width = 48;
    let height = 48;
    
    let head = document.head || document.getElementsByTagName('head')[0];
    let style = document.createElement('style');

    head.appendChild(style);

    style.type = 'text/css';
    style.textContent = 
    `
    * {
        cursor: url(${url}) ${width / 2} ${height / 2}, auto !important;
    }
    `;

    currentStyleElement = style;
}

function disableTargetingCursor() {
    if (!targetingCursorOn) return;
    targetingCursorOn = false;

    if (currentStyleElement != null) {
        currentStyleElement.remove();
    }
}

export class TargetingOptions {
    constructor() {
        this.tokenFilter = (x) => {
            return true;
        }
        this.maxSelections = 9999999;
        this.targetIcon = "damageTypes/Attack.png"
        this.originToken = null;
        this.maxRange = -1;
        this.ranges = [];
        this.rangeLabels = {};
        this.enforceRange = false;
        this.requireLOS = false;
    }
}