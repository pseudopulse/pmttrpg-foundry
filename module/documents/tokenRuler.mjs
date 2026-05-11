import { getHazardAtTile, getHazardCountBetweenTwoPoints, HazardType } from "../core/combat/hazards.mjs";
import { getActorToken, getTokenCenter } from "../pmttrpg.mjs";

let display = null;

export class PTTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {
    _preMove(token) {

    }

    _postMove(token) {

    }

    _getWaypointStyle(waypoint) {
        let style = super._getWaypointStyle(waypoint);
        style.color = this.getRulerColor(waypoint);
        return style;
    }

    _getSegmentStyle(waypoint) {
        let style = super._getSegmentStyle(waypoint);
        style.color = this.getRulerColor(waypoint);
        return style;
    }

    _getGridHighlightStyle(waypoint) {
        let style = super._getGridHighlightStyle(waypoint);
        style.color = this.getRulerColor(waypoint);
        return style;
    }

    getRulerColor(waypoint) {
        if (this.token == null || this.token.actor == null) {
            return 0x40ff11;
        }

        let actor = this.token.actor;
        let movement = actor.system.movement;
        let token = this.token;

        if (actor.getRiding()) {
            actor = actor.getMountedActor();
            movement = actor.system.movement;
            token = getActorToken(actor);
        }

        let difficultTerrainMoved = waypoint.center ? getHazardCountBetweenTwoPoints(HazardType.DIFFICULT_TERRAIN, getTokenCenter(token), waypoint.center) : 0;
        
        let cost = Math.floor(this.distanceBetween(token.transform.position, waypoint) / canvas.grid.size);
        cost += difficultTerrainMoved;

        if (cost > movement && (game.combat != null && game.combat.isActive)) {
            return 0xaa0000;
        }
        else {
            return 0x40ff11;
        }
    }

    distanceBetween(v1, v2) {
        return Math.hypot(v2.x - v1.x, v2.y - v1.y);
    }
}