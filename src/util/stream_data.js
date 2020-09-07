import websocket_client from './websocket_client';

let myRoom = "webclient"
let toRoom = "pythonclient"
let connected

export default class StreamData {

    static connect() {
        websocket_client.joinRoom(myRoom)
        connected = websocket_client.connect()
    }


    static sendData(data) {
       if (connected === true){
             websocket_client.to(toRoom).emit('message', data);
       }
    }

}
