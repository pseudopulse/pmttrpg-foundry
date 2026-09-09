import { getActorToken, getPlayerActor, getTokenCenter } from "../../pmttrpg.mjs";
import { getAttackOptions, getSkillOptions } from "../helpers/dialog.mjs";
import { findByID } from "../helpers/netmsg.mjs";
import { getSprite, spawnDynamicUI } from "../helpers/ui.mjs";
import { getCombatantTokens } from "./combatState.mjs";

export function quickHUDHooks() {
    let clickHandler = async (event) => {
        let point = screenToWorld(event.clientX, event.clientY);

        let selected = getCombatantTokens().find(x => {
            if (x.actor == null) return false;
            let bounds = x.mesh._canvasBounds;
            return point.x > bounds.minX && point.x < bounds.maxX &&
                point.y > bounds.minY && point.y < bounds.maxY;
        });

        if (selected != null) {
            renderTokenHUD(selected);
        }
        else {
            closeTokenHUD();
        }
    }

    document.addEventListener("contextmenu", clickHandler);
}

let activeHUD = null;

function getCenter(x, y, width, height) {
    return { x: x + ((width * canvas.grid.sizeX) / 2), y: y + ((height * canvas.grid.sizeX) / 2)}
}

async function renderTokenHUD(token) {
    if (activeHUD != null) {
        activeHUD.destroy();
    }

    let center = getCenter(token.document.x, token.document.y, token.document.width, token.document.height);
    center.y -= token.document.height * (canvas.grid.sizeX / 6);
    let offset = 170 * (canvas.grid.sizeX / 100);
    let totalButtons = 0;
    
    let instance = await spawnDynamicUI(
        async (data) => {
            data.buttons = {};
            data.root.position = center;

            CONFIG.button = data.root;

            let button = async (action, sprite, trigger) => {
                let pos = radial(totalButtons - 1, offset, totalButtons);
                data.buttons[action] = new PIXI.Container();
                data.root.addChild(data.buttons[action]);
                let bgCircle = new PIXI.Graphics();
                data.buttons[action].addChild(bgCircle);
                data.buttons[action].position = add(pos, { x: -32, y: 8});
                data.buttons[action].scale.x = 0.5;
                data.buttons[action].scale.y = 0.5;
                bgCircle.clear();
                bgCircle.beginFill("rgba(255, 255, 255, 1)", 1);
                bgCircle.drawCircle(64, 64, 48 * (canvas.grid.sizeX / 100) * 1.3);
                bgCircle.beginFill("rgba(43, 43, 43, 1)", 1);
                bgCircle.drawCircle(64, 64, 42 * (canvas.grid.sizeX / 100) * 1.3);
                bgCircle.endFill();
                let b = await getSprite(sprite, 32, 32, { x: 32 * 1.28, y: 32 * 1.28});
                data.buttons[action].addChild(b);
                b.scale.x = 0.6;
                b.scale.y = 0.6;

                data.buttons[action].interactive = true;

                data.buttons[action].on("pointerenter", () => {
                    data.buttons[action].scale.x = 0.6;
                    data.buttons[action].scale.y = 0.6;
                    data.buttons[action].position = add(pos, { x: -32 * 1.1, y: 8 * 0.75 });
                })

                data.buttons[action].on("pointerleave", () => {
                    data.buttons[action].scale.x = 0.5;
                    data.buttons[action].scale.y = 0.5;
                    data.buttons[action].position = add(pos, { x: -32, y: 8 });
                })

                data.buttons[action].on("pointertap", () => {
                    trigger();
                })
            }
            
            
            let character = getPlayerActor();

            if (character != null) {
                character = findByID(character.system.id);
            }
            
            if (character != null) {
                let marks = await character.getAvailableMarks();
                if (token.actor != character) {
                    totalButtons++;
                    await button("Attack", "damageTypes/Attack.png", async () => {
                        character.setTarget(token);
                        await getAttackOptions(character, false);
                        closeTokenHUD();
                    });
                    
                    if (marks.length > 0) {
                        totalButtons++;
                        await button("Mark", "icons/Mark.png", async () => {
                            character.setTarget(token);
                            await character.handleApplyMark();
                            closeTokenHUD();
                        });
                    }

                    await button("Skill", "icons/Unstagger.png", async () => {
                        character.setTarget(token);
                        await getSkillOptions(character);
                        closeTokenHUD();
                    });
                }
            }
        },
        async (data) => {

        },
    )

    activeHUD = instance;
}

function closeTokenHUD() {
    if (activeHUD) {
        activeHUD.destroy();
    }
}

function radial(index, distance, total) {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;

    return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance
    };
}

function add(x, y) {
    return { x: x.x + y.x, y: x.y + y.y };
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