import actionTypes from "../action_types/CameraViewerActionTypes"

export function updateFaceMeshKeypoints(points) {
    return {
        type: actionTypes.UPDATE_FACEMESH_KEYPOINTS,
        payload: points
    }
}

export function updatePosenetKeypoints(value) {
    return {
        type: actionTypes.UPDATE_POSENET_KEYPOINTS,
        payload: value
    }
}

export function updateHandposeKeypoints(points) {
    return {
        type: actionTypes.UPDATE_HAND_KEYPOINTS,
        payload: points
    }
}

