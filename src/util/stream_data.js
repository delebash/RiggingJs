import websocket_client from './websocket_client';

export default class StreamData {
    static connect(myRoom) {
        websocket_client.connect()
        websocket_client.joinRoom(myRoom)
    }

    static send_data(data, toRoom) {
        websocket_client.sendData(data, toRoom)
    }
}
