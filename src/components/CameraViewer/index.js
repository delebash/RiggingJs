import React from 'react';
import Camera from "../../core/camera";
import Grid from "@material-ui/core/Grid";
import DeviceSelect from "../DeviceSelect";
import EstimationSelect from "../EstimationSelect";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import IconButton from "@material-ui/core/IconButton";
import PlayIcon from "@material-ui/icons/PlayArrow";
import StopIcon from "@material-ui/icons/Stop";
import Draggable from "react-draggable";
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
import * as posenet from '@tensorflow-models/posenet';
import * as facemesh from '@tensorflow-models/facemesh';
import * as handpose from '@tensorflow-models/handpose';
import * as tf from '@tensorflow/tfjs';

const requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
const cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame;
const math = window.math;

const defaultPoseNetArchitecture = 'MobileNetV1';
const defaultQuantBytes = 2;
const defaultMultiplier = 1.0;
const defaultStride = 16;
const defaultInputResolution = 200;
const nmsRadius = 30.0;
const minPoseConfidence = 0.15;
const minPartConfidence = 0.1;
const returnTensors = false;
const flipHorizontal = false;


class CameraViewer extends React.Component {

    constructor(props) {
        super(props);
        this.cam = null;
        // models
        this.facemeshModel = null;
        this.posenetModel = null;
        this.handModel = null;
        this.deviceSelectRef = React.createRef();
        this.estimationSelectRef = React.createRef();
        // canvas ref
        this.videoCanvasRef = React.createRef();
        this.drawCanvasRef = React.createRef();
        this.videoRef = React.createRef();
        // canvas contexts
        this.videoCanvasCtx = null;
        this.drawCanvasCtx = null;
        // request animation
        this.requestAnimation = null;
    }

    computeHeadPoseEstimation(face) {
        const {origin, rotationMatrix} = GeometryUtil.computeHeadPoseEstimation(face);
        VisUtil.drawAxis(this.drawCanvasCtx, origin, rotationMatrix);
        const {pitch, yaw, roll} = math.rotationMatrixToEulerAngles(rotationMatrix);
        this.updateHeadRotation({
            pitch,
            yaw,
            roll
        });
    }

    componentDidMount = async () => {
        try {

            this.facemeshModel = await facemesh.load({maxFaces: 1})
            this.handModel = await handpose.load()
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
        this.drawCanvasCtx = this.drawCanvasRef.current.getContext('2d');
    };

    /**
     * update the face mesh keypoints at the redux store
     * @param value: new coordinates
     */
    updateFaceMeshKeypoints = (value) => {
        const {actions} = this.props;
        actions.updateFaceMeshKeypoints1(value);
    };

    /**
     * update the hand keypoints at the redux store
     * @param value: new coordinates
     */
    updateHandposeKeypoints = (value) => {
        const {actions} = this.props;
        actions.updateHandposeKeypoints1(value);
    };

    /**
     * update the pose net keypoints at the redux store
     * @param value: new coordinates
     */
    updatePosenetKeypoints = (value) => {
        const {actions} = this.props;
        actions.updatePosenetKeypoints1(value);
    };



    /**
     * grab the current frame and pass it into the facemesh model
     */
    makePredictions = async (estimationId) => {

        try {
            const {videoWidth, videoHeight} = this.props;
            const canvas = this.videoCanvasRef.current;
            const video = this.videoRef.current;
            const inputFrame = tf.browser.fromPixels(canvas);
            let faces
            let poses
            let hands

            //Estimate Faces
            if ((estimationId === "Face" || estimationId === "Full Body")) {
                faces = await this.facemeshModel.estimateFaces(
                    inputFrame,
                    returnTensors,
                    flipHorizontal
                )
            }

            //Estimate Hand
            if ((estimationId === "Hand" || estimationId === "Full Body")) {
                hands = await this.handModel.estimateHands(
                    inputFrame,
                    flipHorizontal
                );
            }

            //Estimate Pose
            if ((estimationId === "Pose" || estimationId === "Full Body")) {
                poses = await this.posenetModel.estimatePoses(inputFrame, {
                    decodingMethod: 'single-person',
                    maxDetections: 1,
                    scoreThreshold: minPartConfidence,
                    nmsRadius: nmsRadius
                })
            }

            // clear canvas
            this.drawCanvasCtx.clearRect(0, 0, videoWidth, videoHeight);

            //draw facemesh predictions
            if ((estimationId === "Face" || estimationId === "Full Body")) {

                if (faces && faces.length > 0) {
                    this.updateFaceMeshKeypoints(faces[0]);
                    if (this.cam.isRunning) {
                        this.drawCanvasCtx.save();
                        this.drawCanvasCtx.translate(0, 0);
                        VisUtil.drawFace(this.drawCanvasCtx, faces[0],"yellow");
                        this.updateFaceMeshKeypoints(faces[0]);
                    }
                } else {
                    this.updateFaceMeshKeypoints(null);
                }
            }

            this.drawCanvasCtx.restore();

            //draw posenet predictions
            if ((estimationId === "Pose" || estimationId === "Full Body")) {

                if (poses && poses.length > 0) {
                    if (this.cam.isRunning) {
                        this.drawCanvasCtx.save();
                        this.drawCanvasCtx.translate(0, 0);
                        VisUtil.drawPose(this.drawCanvasCtx, poses[0],
                            minPoseConfidence, minPartConfidence, 1, "green");
                        this.updatePosenetKeypoints(poses[0]);
                    }
                } else {
                    this.updatePosenetKeypoints(null);

                }
            }

            this.drawCanvasCtx.restore();

            //draw hand predictions
            if ((estimationId === "Hand" || estimationId === "Full Body")) {

                if (hands && hands.length > 0) {
                    if (this.cam.isRunning) {
                        this.drawCanvasCtx.save();
                        this.drawCanvasCtx.translate(0, 0);
                      //  this.drawCanvasCtx.scale(-1, 1);
                        VisUtil.drawHand(this.drawCanvasCtx, hands[0],1,"red");
                        this.updateHandKeypoints(hands[0]);
                    }
                } else {
                    this.updateHandKeypoints(null);

                }
            }

            this.drawCanvasCtx.restore();

        } catch (e) {
            console.log(`error making the predictions ${e}`);
        }
    }
    /**
     * start the camera stream
     * @returns {Promise<void>}
     */
    startCamera = async () => {
        const {videoWidth, videoHeight} = this.props;
        const deviceId = this.deviceSelectRef.current.selectedId();

        const canvas = this.videoCanvasRef.current;

        if (Camera.isSupported()) {
            const video = document.querySelector('video');
            this.cam = new Camera(video, videoHeight, videoWidth);
            await this.cam.start(deviceId);
            let renderVideo = async () => {
                try {
                    let estimationId = this.estimationSelectRef.current.selectedId();
                    if (this.cam.isRunning) {
                        this.videoCanvasCtx.clearRect(0, 0, videoWidth, videoHeight);
                        this.videoCanvasCtx.save();
                        this.videoCanvasCtx.translate(videoWidth, 0);
                        this.videoCanvasCtx.scale(-1, 1);
                        this.videoCanvasCtx.drawImage(video, 0, 0, videoWidth, videoHeight);
                        this.videoCanvasCtx.restore();
                        //make inference

                        await this.makePredictions(estimationId);
                    } else {
                        this.updateFaceMeshKeypoints(null);
                        // this.updateHeadRotation(null);
                        this.updatePosenetKeypoints(null)
                        this.updateHandKeypoints(null);
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
        const {videoWidth, videoHeight, actions} = this.props;
        await this.stopCamera();
    };

    render() {
        const {videoWidth, videoHeight} = this.props;
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
                                <canvas
                                    ref={this.drawCanvasRef}
                                    width={videoWidth}
                                    height={videoHeight}
                                    style={wrapperCanvasStyle}
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

CameraViewer.defaultProps = {
    videoWidth: 300,
    videoHeight: 300
};
const mapStateToProps = (store, ownProps) => {
    return {}
};
const mapDispatchToProps = (dispatch) => {
    return {actions: bindActionCreators(actions, dispatch)}
};
export default connect(mapStateToProps, mapDispatchToProps)(CameraViewer);

