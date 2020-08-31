import actionTypes from "../action_types/CameraViewerActionTypes"

export function updateFaceMeshKeypoints1(points) {
    return {
        type: actionTypes.UPDATE_FACEMESH_KEYPOINTS,
        payload: points
    }
}

export function updatePosenetKeypoints1(value) {
    return {
        type: actionTypes.UPDATE_POSENET_KEYPOINTS,
        payload: value
    }
}

export function updateHandposeKeypoints1(points) {
    return {
        type: actionTypes.UPDATE_HAND_KEYPOINTS,
        payload: points
    }
}

