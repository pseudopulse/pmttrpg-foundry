import { findByID, getActorUser, sendNetworkMessage } from "../helpers/netmsg.mjs";
import { requestTargeting, TargetType } from "../combat/targeting.mjs";
import { getActorToken, getTokenCenter, gridDistanceBetween, searchByObject } from "../../pmttrpg.mjs";
import { RollContext } from "./rollContext.mjs";

export async function requestForcedMovement(source, target, origin, range, canDealDamage = true, increasable = true, teleport = false) {
    if (increasable) {
        let modifier = target.outfitEffectCount("Heavy Material");

        range = Math.max(range + modifier, 0);
    }

    if (range <= 0) {
        return -1;
    }

    let point = await pollUserGetGridSpace(source, target, origin, range);

    if (point == null) {
        return -1;
    }

    let token = getActorToken(target);
    let distance = Math.max(Math.floor(gridDistanceBetween(getTokenCenter(getActorToken(target)), point)) - 1, 0);
    point.x -= (token.document.width * canvas.grid.size) / 2;
    point.y -= (token.document.height * canvas.grid.size) / 2;

    await token.document.setFlag("pmttrpg", "ignoreNextMovementCheck", true);
    await token.document.update({ x: point.x, y: point.y }, { render: true, diff: false });
    await token.document.move(
    {
        x: point.x, y: point.y,
    },
    {
        animate: !teleport,
        constrainOptions: {
            ignoreWalls: true
        }
    })

    if (canDealDamage) {
        let unspent = range - distance;

        if (unspent > 0) {
            let ctx = new RollContext();
            ctx.actor = source;
            ctx.target = target;

            await target.takeForceDamage(unspent, ctx);
        }
    }

    return distance;
}

export async function pollUserGetGridSpace(user, target, origin, range) {
    if (user != game.user) {
        return await getActorUser(user).query("pmttrpg.pollUserGetGridSpace", {
            target: target,
            origin: origin,
            range: range
        });
    };

    return await requestTargeting(TargetType.GRID, {
        originToken: getActorToken(origin),
        maxRange: range,
        enforceRange: true,
        requireLOS: true,
    })
}