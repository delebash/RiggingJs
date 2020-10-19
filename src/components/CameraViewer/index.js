import React from 'react';
import Camera from "../../core/camera";
import Grid from "@material-ui/core/Grid";
import DeviceSelect from "../DeviceSelect";
import EstimationSelect from "../EstimationSelect";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import IconButton from "@material-ui/core/IconButton";
import PlayIcon from "@material-ui/icons/PlayArrow";
import StopIcon from "@material-ui/icons/Stop";
import Card from "@material-ui/core/Card";
import CardHeader from "@material-ui/core/CardHeader";
import CardContent from "@material-ui/core/CardContent";
import MoreVertIcon from "@material-ui/icons/MoreVert";
import VideoCamIcon from "@material-ui/icons/Videocam";
import moment from "moment";
import {connect} from "react-redux";
import {bindActionCreators} from "redux";
import * as actions from "../../redux/actions/CameraViewerActions";
import VisUtil from "../../util/vis.util";
import GeometryUtil from "../../util/geometry.util";
import StreamData from '../../util/stream_data'
import * as posenet from '@tensorflow-models/posenet';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as handpose from '@tensorflow-models/handpose';

import * as tf from '@tensorflow/tfjs';

const websocketJoinRoom = 'webclient'
const requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
const cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
const math = window.math;

const defaultPoseNetArchitecture = 'ResNet50';
const defaultQuantBytes = 4;
const defaultMultiplier = 1.0;
const defaultStride = 16;
const defaultInputResolution = 200;
const nmsRadius = 30.0;
const minPoseConfidence = 0.15;
const minPartConfidence = 0.1;
const returnTensors = false;
const flipHorizontal = false;

let  handModel, ctx, canvas, rafID, that, stream, video

const videoHeight = 300
const videoWidth = 300
const fingerLookupIndices = {
    thumb: [0, 1, 2, 3, 4],
    indexFinger: [0, 5, 6, 7, 8],
    middleFinger: [0, 9, 10, 11, 12],
    ringFinger: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20]
};  // for rendering each finger as a polyline

class CameraViewer extends React.Component {

    constructor(props) {
        super(props);
        this.cam = null;
        that = this
        // models
        this.deviceSelectRef = React.createRef();
        this.estimationSelectRef = React.createRef();
        // canvas ref
        this.canvasRef = React.createRef();
        this.videoRef = React.createRef();
        // request animation
        this.requestAnimation = null;
    }

    componentDidMount = async () => {
        try {
            // StreamData.connect(websocketJoinRoom)
            // faceDetection = await faceLandmarksDetection.load(
            //     faceLandmarksDetection.SupportedPackages.mediapipeFacemesh);
            // handModel = await handpose.load()
            // posenetModel = await posenet.load({
            //     architecture: defaultPoseNetArchitecture,
            //     outputStride: defaultStride,
            //     inputResolution: defaultInputResolution,
            //     multiplier: defaultMultiplier,
            //     quantBytes: defaultQuantBytes
            // })
        } catch (e) {
            console.log(`error loading the model ${e.toString()}`);
        }
    };

    landmarksRealTime = async function (video) {
        async function frameLandmarks() {
            ctx.drawImage(
                video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width,
                canvas.height);
            const predictions = await handModel.estimateHands(video);
            if (predictions.length > 0) {
                const result = predictions[0].landmarks;
                that.drawKeypoints(result, predictions[0].annotations);
            }
            rafID = requestAnimationFrame(frameLandmarks);
        }

        await frameLandmarks();
    }

    drawPoint(y, x, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
    }

    drawKeypoints(keypoints) {
        const keypointsArray = keypoints;

        for (let i = 0; i < keypointsArray.length; i++) {
            const y = keypointsArray[i][0];
            const x = keypointsArray[i][1];
            this.drawPoint(x - 2, y - 2, 3);
        }

        const fingers = Object.keys(fingerLookupIndices);
        for (let i = 0; i < fingers.length; i++) {
            const finger = fingers[i];
            const points = fingerLookupIndices[finger].map(idx => keypoints[idx]);
            this.drawPath(points, false);
        }
    }

    drawPath(points, closePath) {
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

    loadStream = async () => {
        const video = this.videoRef.current
        stream = await navigator.mediaDevices.getUserMedia({
            'audio': false,
            'video': {
                facingMode: 'user',
            },
        });
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        })
    }

    // devicesList = async () => {
    //     try {
    //         let devices = [];
    //         const devicesList = await navigator.mediaDevices.enumerateDevices();
    //         for (let i = 0; i !== devicesList.length; ++i) {
    //             const deviceInfo = devicesList[i];
    //             if (deviceInfo.kind === 'videoinput') {
    //                 devices.push({
    //                     "id": deviceInfo.deviceId,
    //                     "label": deviceInfo.label || `camera ${i}`
    //                 });
    //             }
    //         }
    //         return devices;
    //
    //     } catch (e) {
    //         throw new Error("error listing the devices");
    //     }
    // }

    stop = async () => {
        return new Promise((resolve, reject) => {
            const tracks = stream.getTracks();
            tracks.forEach(function (track) {
                track.stop();
            });
            video.srcObject= null;
            return resolve();
        });
    }

    startCamera = async () => {
        let video;
        handModel = await handpose.load();
        video = await this.loadStream()

        canvas = this.canvasRef.current

        canvas.width = videoWidth;
        canvas.height = videoHeight;
        video.width = videoWidth;
        video.height = videoHeight;

        ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, videoWidth, videoHeight);
        ctx.strokeStyle = 'red';
        ctx.fillStyle = 'red';

        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        await this.landmarksRealTime(video);
    };

    stopCamera = async () => {
        await this.stop();
    };

    btnStartCamClickEvt = async () => {
        // await this.stopCamera();
        await this.startCamera();
    };

    btnStopCamClickEvt = async () => {
        await this.stopCamera();
    };

    render() {
        const wrapperStyle = {
            position: "relative",
            width: videoWidth,
            height: videoHeight
        };
        const wrapperCanvasStyle = {
            position: "absolute",
            top: 0,
            left: 0
        };
        return (
            <Card
                elevation={20}
                style={{
                    zIndex: 1,
                    position: "absolute",
                    top: 0,
                    left: 0
                }}
            >
                <CardHeader
                    style={{cursor: "move"}}
                    avatar={
                        <IconButton>
                            <VideoCamIcon fontSize="large"/>
                        </IconButton>
                    }
                    action={
                        <IconButton>
                            <MoreVertIcon/>
                        </IconButton>
                    }
                    title="Camera Viewer"
                    subheader={moment().format("MMM Do YY")}
                />
                <CardContent>
                    <Grid
                        container
                        spacing={3}
                        direction="column"
                        alignItems="center"
                        justify="center"
                        style={{minHeight: "50h"}}
                    >
                        <Grid item xs={12} style={{alignItems: "center"}}>
                            <video
                                ref={this.videoRef}
                                autoPlay
                                style={{
                                    transform: "scaleX(-1)",
                                    display: "none",
                                }}
                            />
                            <div style={wrapperStyle}>
                                <canvas
                                    ref={this.canvasRef}
                                    width={videoWidth}
                                    height={videoHeight}
                                    style={{
                                        ...wrapperCanvasStyle,
                                        ...{backgroundColor: "gray"},
                                    }}
                                />
                            </div>
                        </Grid>
                        <Grid item xs={12}>
                            <DeviceSelect ref={this.deviceSelectRef}/>
                        </Grid>
                        <Grid item xs={12}>
                            <EstimationSelect ref={this.estimationSelectRef}/>
                        </Grid>
                        <Grid item xs={12}>
                            <ButtonGroup
                                color="primary"
                                aria-label="contained primary button group"
                            >
                                <IconButton onClick={this.btnStartCamClickEvt}>
                                    <PlayIcon fontSize="large"/>
                                </IconButton>
                                <IconButton onClick={this.btnStopCamClickEvt}>
                                    <StopIcon fontSize="large"/>
                                </IconButton>
                            </ButtonGroup>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>
        );
    }
}

export default CameraViewer