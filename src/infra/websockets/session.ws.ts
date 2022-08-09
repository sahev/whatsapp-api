import { MessageBody, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({ cors: true }) 
export class SessionWebSocket {
    @WebSocketServer() server: Server;
    
    emitQrCodeEvent(@MessageBody() data: {}): void {
      console.log('qr code emit');
      this.server.emit("session.qrcode", data);
    }

    emitSessionStatus(@MessageBody() data: {}): void {
      this.server.emit("session.status", data);
    }
}