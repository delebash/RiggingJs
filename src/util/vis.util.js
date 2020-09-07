import {TriangulationUtil} from "./triangulation.util"
import * as posenet from '@tensorflow-models/posenet';
import StreamData from "./stream_data";

const math = window.math;
const fingerLookupIndices = {
    thumb: [0, 1, 2, 3, 4],
    indexFinger: [0, 5, 6, 7, 8],
    middleFinger: [0, 9, 10, 11, 12],
    ringFinger: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20],
};

export default class VisUtil {

    static drawPath(ctx, points, closePath) {
        const region = new Path2D();
        region.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            region.lineTo(point[0], point[1]);
        }
        if (closePath) {
            region.closePath();
        }
        ctx.stroke(region);
    }

    static toTuple({y, x}) {
        return [y, x];
    }

    static drawText(ctx,text, x,y, s, color) {
        ctx.font = `${s}px Arial`;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
    }

    static drawPoint(ctx,x,y, r, color) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
    }

    static drawMesh(ctx, face) {
        let keypoints = face.scaledMesh;
        for (let i = 0; i < TriangulationUtil.length / 3; i++) {
            const points = [
                TriangulationUtil[i * 3], TriangulationUtil[i * 3 + 1],
                TriangulationUtil[i * 3 + 2]
            ].map(index => keypoints[index]);
            this.drawPath(ctx, points, true);
        }
    }

    static drawSilhouette(ctx, face){
        let annotations = face.annotations;
        const silhouette = annotations["silhouette"];
        for (let i = 0; i < silhouette.length; i++) {
            this.drawText(ctx, i, silhouette[i][0], silhouette[i][1], 8, "black");
        }
    }


    static drawAxis(ctx, origin, rotationMatrix){
        let limitX = math.subtract(origin, math.multiply(math.squeeze(math.row(rotationMatrix, 0)), 100.0)).toArray();
        this.drawArrow([origin[1], origin[0]], [limitX[1], limitX[0]], "red", 1.0, ctx, 3);
        let limitY = math.add(origin, math.multiply(math.squeeze(math.row(rotationMatrix, 1)), 100.0)).toArray();
        this.drawArrow([origin[1], origin[0]], [limitY[1], limitY[0]], "green", 1.0, ctx, 3);
        let limitZ = math.subtract(origin, math.multiply(math.squeeze(math.row(rotationMatrix, 2)), 100.0)).toArray();
        this.drawArrow([origin[1], origin[0]], [limitZ[1], limitZ[0]], "blue", 1.0, ctx, 3);
    }

    /**
     * Draws a line on a canvas, i.e. a joint
     */
    static drawSegment([ay, ax], [by, bx], color, scale, ctx, lineWidth=2) {
        ctx.beginPath();
        ctx.moveTo(ax * scale, ay * scale);
        ctx.lineTo(bx * scale, by * scale);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.stroke();
    }

    /**
     * Draw an arrow
     */
    static drawArrow([ay, ax], [by, bx], color, scale, ctx, lineWidth=2) {

        var headlen = 10; // length of head in pixels
        var dx = bx - ax;
        var dy = by - ay;
        var angle = Math.atan2(dy, dx);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx - headlen * Math.cos(angle - Math.PI / 6), by - headlen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - headlen * Math.cos(angle + Math.PI / 6), by - headlen * Math.sin(angle + Math.PI / 6));
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.stroke();
    }

    /**
     * Draws a pose skeleton by looking up all adjacent keypoints/joints
     */
    static drawSkeleton(keypoints, minConfidence, ctx, scale = 1, color) {
        const adjacentKeyPoints =
            posenet.getAdjacentKeyPoints(keypoints, minConfidence);
        adjacentKeyPoints.forEach((keypoints) => {
            this.drawSegment(
                this.toTuple(keypoints[0].position), this.toTuple(keypoints[1].position), color,
                scale, ctx);
        });
    }

    /**
     * Draw pose keypoints onto a canvas
     */
    static  drawKeypoints(keypoints, minConfidence, ctx, scale = 1, color) {
        for (let i = 0; i < keypoints.length; i++) {
            const keypoint = keypoints[i];
            if (keypoint.score < minConfidence) {
                continue;
            }
            const {y, x} = keypoint.position;
            this.drawPoint(ctx, x * scale, y * scale, 3, color);
        }
    }

    static drawPose(ctx, pose, minPoseConfidence, minPartConfidence, scale=1, color="red") {
        const {score, keypoints} = pose;
        if (score >= minPoseConfidence) {
            this.drawKeypoints(keypoints, minPartConfidence, ctx, scale, color);
            this.drawSkeleton(keypoints, minPartConfidence, ctx, scale, color);
        }
    }

    static drawFace(ctx, face,color) {
        var mesh = face.scaledMesh;
        ctx.fillStyle = color;
        for (let i = 0; i < mesh.length; i++) {
            var [x, y, z] = mesh[i];
            ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        }
    }


    static drawHand(ctx, hand,scale, color,pointSize) {
        let keypoints  = hand.landmarks
        this.drawHandKeypoints(ctx,keypoints,color,scale, pointSize)
    }

    static drawHandPoint(ctx,y, x, r,color, pointSize) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fillStyle = "blue";
        ctx.fill();

    }
    static drawHandKeypoints(ctx,keypoints,color,scale, pointSize) {
        let data ={}
        const keypointsArray = keypoints;
        const fingers = Object.keys(fingerLookupIndices);
        for (let i = 0; i < fingers.length; i++) {
            const finger = fingers[i];
            const points = fingerLookupIndices[finger].map(idx => keypoints[idx]);
            //Send Data to be streamed
            data.points = points
            data.finger = finger
            StreamData.sendData(data)
            this.drawHandPath(ctx,points, false,color);
        }
        for (let i = 0; i < keypointsArray.length; i++) {
            const y = keypointsArray[i][0];
            const x = keypointsArray[i][1];
            this.drawHandPoint(ctx, x * scale, y * scale, 2, color, pointSize);
            //this.drawHandPoint(ctx,x - 2, y - 2, 3,color);
        }
    }

      static drawHandPath(ctx, points, closePath,color) {
        const region = new Path2D();
        region.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            const point = points[i];
            region.lineTo(point[0], point[1]);
        }

        if (closePath) {
            region.closePath();
        }
        ctx.strokeStyle = color;
        ctx.stroke(region);
    }
}
