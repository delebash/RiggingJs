import websocket_client from './websocket_client';




export default class StreamData {

    static connect(myRoom) {
        websocket_client.connect()
        websocket_client.joinRoom(myRoom)
    }


    static sendData(data) {
        let toRoom = "pythonclient"
        // websocket_client.to(toRoom).emit('message', data);
        websocket_client.sendData(toRoom,data)
    }

}
