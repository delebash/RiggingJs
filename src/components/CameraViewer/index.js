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
import StreamData from '../../util/stream_data'
import * as posenet from '@tensorflow-models/posenet';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import * as handpose from '@tensorflow-models/handpose';
import '@tensorflow/tfjs-backend-webgl';

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
let videoWidth = 300;
let videoHeight = 300;
let ctx, canvas, faceLandmarksDetectionModel, posenetModel, handModel, deviceId, videoElement, cam

class CameraViewer extends React.Component {

    constructor(props) {
        super(props);

        this.deviceSelectRef = React.createRef();
        this.estimationSelectRef = React.createRef();
        this.canvasRef = React.createRef();
        this.videoRef = React.createRef();

    }

    componentDidMount = async () => {
        try {
            StreamData.connect(websocketJoinRoom)
            // let faceLandmarksDetection = await faceLandmarksDetection.load(
            //     faceLandmarksDetection.SupportedPackages.mediapipeFacemesh);
            handModel = await handpose.load()
            posenetModel = await posenet.load({
                architecture: defaultPoseNetArchitecture,
                outputStride: defaultStride,
                inputResolution: defaultInputResolution,
                multiplier: defaultMultiplier,
                quantBytes: defaultQuantBytes
            })
        } catch (e) {
            console.log(`error loading the model ${e.toString()}`);
        }
        // this.videoCanvasCtx = this.videoCanvasRef.current.getContext('2d');

    };


    /**
     * grab the current frame and pass it into the facemesh model
     */



    makePredictions = async (deviceId, video) => {

        async function frameLandmarks() {
            ctx.drawImage(
                video, 0, 0, videoWidth, videoHeight, 0, 0, canvas.width,
                canvas.height);
            const predictions = await handModel.estimateHands(video);
            if (predictions.length > 0) {
                VisUtil.drawKeypoints(ctx, predictions);
            }
            requestAnimationFrame(frameLandmarks);
        }

       await frameLandmarks();

    }


    /**
     * start the camera stream
     * @returns {Promise<void>}
     */
    startCamera = async () => {
        deviceId = this.deviceSelectRef.current.selectedId();
        videoElement = document.querySelector('video');
        ctx = this.canvasRef.current.getContext('2d');

        handModel = await handpose.load({maxContinuousChecks:'infinity', detectionConfidence: 1.0
            ,iouThreshold : 0.3, scoreThreshold : 0.75});

        cam = new Camera(videoElement, videoHeight, videoWidth)
        let video = await cam.start(deviceId);
        canvas = this.canvasRef.current

        videoWidth = video.videoWidth;
        videoHeight = video.videoHeight;

        canvas.width = videoWidth;
        canvas.height = videoHeight;
        video.width = videoWidth;
        video.height = videoHeight;

        ctx.clearRect(0, 0, videoWidth, videoHeight);
        ctx.strokeStyle = 'red';
        ctx.fillStyle = 'red';

        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        await this.makePredictions(deviceId, video);
    }


    /**
     * stop the camera stream
     * @returns {Promise<void>}
     */
    stopCamera = async () => {
        if (cam && cam.isRunning) {
            await cam.stop();
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


// makePredictions = async (estimationId, video) => {
//
//     // try {
//     let faces
//     let poses
//     let hands
//
//     //Estimate Faces
//     // if ((estimationId === "Face" || estimationId === "Full Body")) {
//     //     faces = await this.faceLandmarksDetectionModel.estimateFaces(
//     //         inputFrame,
//     //         returnTensors,
//     //         flipHorizontal
//     //     )
//     // }
//
//     //Estimate Hand
//     if ((estimationId === "Hand" || estimationId === "Full Body")) {
//         hands = await this.handModel.estimateHands(video);
//     }
//
//     //Estimate Pose
//     // if ((estimationId === "Pose" || estimationId === "Full Body")) {
//     //     poses = await this.posenetModel.estimatePoses(inputFrame, {
//     //         decodingMethod: 'single-person',
//     //         maxDetections: 1,
//     //         scoreThreshold: minPartConfidence,
//     //         nmsRadius: nmsRadius
//     //     })
//     // }
//     //
//     // // clear canvas
//     // this.drawCanvasCtx.clearRect(0, 0, videoWidth, videoHeight);
//     //
//     // //draw facemesh predictions
//     // if ((estimationId === "Face" || estimationId === "Full Body")) {
//     //
//     //     if (faces && faces.length > 0) {
//     //         this.updateFaceMeshKeypoints(faces[0]);
//     //         if (this.cam.isRunning) {
//     //             this.drawCanvasCtx.save();
//     //             this.drawCanvasCtx.translate(0, 0);
//     //             VisUtil.drawFace(this.drawCanvasCtx, faces[0],"yellow");
//     //             this.updateFaceMeshKeypoints(faces[0]);
//     //         }
//     //     } else {
//     //         this.updateFaceMeshKeypoints(null);
//     //     }
//     // }
//     //
//     // this.drawCanvasCtx.restore();
//     //
//     // //draw posenet predictions
//     // if ((estimationId === "Pose" || estimationId === "Full Body")) {
//     //
//     //     if (poses && poses.length > 0) {
//     //         if (this.cam.isRunning) {
//     //             this.drawCanvasCtx.save();
//     //             this.drawCanvasCtx.translate(0, 0);
//     //             VisUtil.drawPose(this.drawCanvasCtx, poses[0],
//     //                 minPoseConfidence, minPartConfidence, 1, "green");
//     //             this.updatePosenetKeypoints(poses[0]);
//     //         }
//     //     } else {
//     //         this.updatePosenetKeypoints(null);
//     //
//     //     }
//     // }
//     //
//     // this.drawCanvasCtx.restore();
//
//     //draw hand predictions
//     //     if ((estimationId === "Hand" || estimationId === "Full Body")) {
//     //
//     //         if (hands && hands.length > 0) {
//     //             if (this.cam.isRunning) {
//     //                 // this.drawCanvasCtx.save();
//     //                 // this.drawCanvasCtx.translate(0, 0);
//     //                 //  this.drawCanvasCtx.scale(-1, 1);
//     //                 VisUtil.drawHand(video, this.drawCanvasCtx, hands, 1, "red", videoHeight, videoWidth);
//     //             }
//     //         } else {
//     //
//     //         }
//     //     }
//     //
//     //     this.drawCanvasCtx.restore();
//     //
//     // } catch (e) {
//     //     console.log(`error making the predictions ${e}`);
//     // }
// }

// async setupCamera() {
//     if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
//         throw new Error(
//             'Browser API navigator.mediaDevices.getUserMedia not available');
//     }
//
//     const video = document.getElementById('video');
//     const stream = await navigator.mediaDevices.getUserMedia({
//         'audio': false,
//         'video': {
//             facingMode: 'user',
//             // Only setting the video to a specified size in order to accommodate a
//             // point cloud, so on mobile devices accept the default size.
//             width: mobile ? undefined : VIDEO_WIDTH,
//             height: mobile ? undefined : VIDEO_HEIGHT
//         },
//     });
//     video.srcObject = stream;
//
//     return new Promise((resolve) => {
//         video.onloadedmetadata = () => {
//             resolve(video);
//         };
//     });
// }

//
// async loadVideo() {
//     const video = await cam, start
//     ();
//     video.play();
//     return video;
// }


// const deviceId = this.deviceSelectRef.current.selectedId();
//
// if (Camera.isSupported()) {
//     const videoElement = document.querySelector('video');
//     this.cam = new Camera(videoElement, videoHeight, videoWidth);
//     let video = await this.cam.start(deviceId);
//     video.width = videoWidth;
//
//     await this.makePredictions(deviceId, video);

//     video.height = videoHeight;
//
//     let renderVideo = async () => {
//         try {
//             let estimationId = this.estimationSelectRef.current.selectedId();
//             if (this.cam.isRunning) {
//                 this.videoCanvasCtx.clearRect(0, 0, videoWidth, videoHeight);
//                 this.videoCanvasCtx.save();
//                 this.videoCanvasCtx.translate(videoWidth, 0);
//                 this.videoCanvasCtx.scale(-1, 1);
//                 this.videoCanvasCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
//                 this.videoCanvasCtx.restore();
//                 //make inference
//
//                 await this.makePredictions(estimationId, video);
//             } else {
//                 cancelAnimationFrame(this.requestAnimation); // kill animation
//                 return;
//             }
//         } catch (e) {
//             console.log("render interrupted" + e.toString());
//         }
//         this.requestAnimation = requestAnimationFrame(renderVideo);
//     };
//     await renderVideo();
// } else {
//     throw
//     new
//
//     Error(
//
//     "Camera in not supported, please try with another browser"
// )
//     ;
// }
// }