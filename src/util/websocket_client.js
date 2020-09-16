import io from 'socket.io-client';

const url = 'ws://localhost:5000'
let connectionOptions = {
    "force new connection": true,
    "reconnection": true,
    "reconnectionDelay": 1000,                  //starts with 2 secs delay, then 4, 6, 8, until 60 where it stays forever until it reconnects
    "reconnectionDelayMax": 5000,             //1 minute maximum delay between connections
    "reconnectionAttempts": 5,         //to prevent dead clients, having the user to having to manually reconnect after a server restart.
    "timeout": 10000,                           //before connect_error and connect_timeout are emitted.
    "transports": ["websocket"]                //forces the transport to be only websocket. Server needs to be setup as well/
}

const socket = io(url, connectionOptions);

export default class websocket_client {
    static joinRoom(room) {
        socket.emit('room', room)
    }

    static sendData(data, toRoom) {

        if (toRoom.length > 1) {
            socket.emit('data', data, toRoom);
        } else {
            socket.emit('data', data)
        }
    }

    static connect() {
        socket.on('connect', function () {
            console.log('Connected ' + socket.id)

            //Messages from server room
            socket.on('message', function (message) {
                console.log('Server sent message  ' + message)
            });

            //Received form server
            socket.on('connect_timeout', function (timeout) {
                console.log('connection timeout  ' + timeout)
            })

            socket.on('connect_error', function (error) {
                console.log('connection error  ' + error)
            });

            socket.on('connect_failed', function () {
                console.log('Connection Failed');
            });

            socket.on('error', function (error) {
                console.log('error  ' + error)
            });

            socket.on('disconnect', function (reason) {
                if (reason === 'io server disconnect') {
                    console.log('Server sent disconnect')
                } else {
                    console.log('disconnected')
                }
            });
        });
    }
}