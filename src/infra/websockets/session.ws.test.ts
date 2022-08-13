import { io } from "socket.io-client";

function socketConnect() {
    const socket = io(process.env.HOST + process.env.API_PORT);
    socket.connect();

    if(socket) {
        console.log('socket connected');
    }

    socket
        .on('session.qrcode', (msg) => {
            console.log(msg, 'qrcode received');
        })
        .on("connect_error", (err) => console.log("connect err ", err));
}

export default socketConnect;