import { io } from "socket.io-client";

function socketConnect() {
    const socket = io("http://localhost:3000/");
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