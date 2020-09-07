import websocket_client from './websocket_client';


let toRoom = "pythonclient"

export default class StreamData {

    static connect(myRoom) {
        websocket_client.connect()
        websocket_client.joinRoom(myRoom)
    }


    static sendData(data) {
        websocket_client.to(toRoom).emit('message', data);
    }

}
