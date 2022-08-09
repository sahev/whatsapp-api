import { MessageBody, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({ cors: true }) 
export class MessageWebSocket {
    @WebSocketServer() server: Server;
    
    emitOnMessage(@MessageBody() data: {}): void {
      this.server.emit(`on.message`, data);
    }
}