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
import VisUtil from "../../util/vis.util";
import StreamData from '../../util/stream_data'
import * as posenet from '@tensorflow-models/posenet';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as handpose from '@tensorflow-models/handpose';


const websocketJoinRoom = 'webclient'
const requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
const cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;


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
const videoWidth = 300
const videoHeight = 300

class CameraViewer extends React.Component {

    constructor(props) {
        super(props);
        this.cam = null;
        // models
        this.faceLandmarksDetectionModel = null;
        this.posenetModel = null;
        this.handModel = null;
        this.deviceSelectRef = React.createRef();
        this.estimationSelectRef = React.createRef();
        // canvas ref
        this.videoCanvasRef = React.createRef();
        this.videoRef = React.createRef();
        // canvas contexts
        this.videoCanvasCtx = null;
        // request animation
        this.requestAnimation = null;
    }

    componentDidMount = async () => {
        try {
            StreamData.connect(websocketJoinRoom)
            this.faceLandmarksDetection = await faceLandmarksDetection.load(
                faceLandmarksDetection.SupportedPackages.mediapipeFacemesh);
            this.handModel = await handpose.load({detectionConfidence:1.0})
            this.posenetModel = await posenet.load({
                architecture: defaultPoseNetArchitecture,
                outputStride: defaultStride,
                inputResolution: defaultInputResolution,
                multiplier: defaultMultiplier,
                quantBytes: defaultQuantBytes
            })
        } catch (e) {
            console.log(`error loading the model ${e.toString()}`);
        }
        this.videoCanvasCtx = this.videoCanvasRef.current.getContext('2d');
    };

    makePredictions = async (estimationId, videoCanvasCtx, video, videoWidth, videoHeight, canvas) => {

        videoCanvasCtx.drawImage(
            video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width,
            canvas.height);

        let predictions = ""
        let landmarks = ""
        let annotations = ""

        //Estimate Faces
        if ((estimationId === "Face" || estimationId === "Full Body")) {
            predictions = await this.faceLandmarksDetectionModel.estimateFaces(
                video,
                returnTensors,
                flipHorizontal
            )
        }

        //Estimate Hand
        if ((estimationId === "Hand" || estimationId === "Full Body")) {
            predictions = await this.handModel.estimateHands(
                video,
                flipHorizontal
            );
        }
        //Estimate Pose
        if ((estimationId === "Pose" || estimationId === "Full Body")) {
            predictions = await this.posenetModel.estimatePoses(video, {
                decodingMethod: 'single-person',
                maxDetections: 1,
                scoreThreshold: minPartConfidence,
                nmsRadius: nmsRadius
            })
        }

        if (predictions && predictions.length > 0) {
            landmarks = predictions[0].landmarks;
            annotations = predictions[0].annotations
            if (this.cam.isRunning) {
                VisUtil.drawKeypoints(this.videoCanvasCtx, landmarks, annotations);
            }
        }
    }

    /**
     * start the camera stream
     * @returns {Promise<void>}
     */
    startCamera = async () => {
        const deviceId = this.deviceSelectRef.current.selectedId();

        if (Camera.isSupported()) {
            const video = document.querySelector('video');
            this.cam = new Camera(video, videoHeight, videoWidth);
            await this.cam.start(deviceId);
            let renderVideo = async () => {
                try {
                    let estimationId = this.estimationSelectRef.current.selectedId();
                    let canvas = this.videoCanvasRef.current;
                    if (this.cam.isRunning) {
                        canvas.width = videoWidth;
                        canvas.height = videoHeight;
                        video.width = videoWidth;
                        video.height = videoHeight;

                        this.videoCanvasCtx = canvas.getContext('2d');
                        this.videoCanvasCtx.clearRect(0, 0, videoWidth, videoHeight);
                        this.videoCanvasCtx.strokeStyle = 'red';
                        this.videoCanvasCtx.fillStyle = 'red';
                        this.videoCanvasCtx.translate(canvas.width, 0);
                        this.videoCanvasCtx.scale(-1, 1);

                        await this.makePredictions(estimationId, this.videoCanvasCtx, video, videoWidth, videoHeight, canvas);

                    } else {
                        cancelAnimationFrame(this.requestAnimation); // kill animation
                        return;
                    }
                } catch (e) {
                    console.log("render interrupted" + e.toString());
                }
                this.requestAnimation = requestAnimationFrame(renderVideo);
            };
            await renderVideo();
        } else {
            throw new Error("Camera in not supported, please try with another browser");
        }
    };
    /**
     * stop the camera stream
     * @returns {Promise<void>}
     */
    stopCamera = async () => {
        if (this.cam && this.cam.isRunning) {
            await this.cam.stop();
        }
    };

    btnStartCamClickEvt = async () => {
        await this.stopCamera();
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
                                    ref={this.videoCanvasRef}
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