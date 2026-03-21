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
        
        let cost = Math.floor(this.distanceBetween(this.token.transform.position, waypoint) / 100);

        if (cost > movement) {
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