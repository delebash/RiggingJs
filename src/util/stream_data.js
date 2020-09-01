import io from 'socket.io-client';
const socket = io('http://localhost:5000');
export default class StreamData {
    static getData(points, bone) {
        this.sendData({bone,points})
    }
    static connect(){
        socket.on('connect', function(){
            console.log('a user connected');

        });
    }
    static sendData(data){
        socket.emit('msg', data);
    }

}
// socket.on('connect', function(){
//     console.log('a user connected');
// });
// socket.on('event', function(data){
//
// });
// socket.on('disconnect', function(){
//
// });