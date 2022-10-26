import { Injectable } from '@nestjs/common';
import { Channel, connect, Connection, Message } from 'amqplib';

@Injectable()
export class QueueService {

  private conn: Connection;
  private channel: Channel;
  private uri = process.env.QUEUE_CONSUMER_LOCATION

  async connectToServer(): Promise<any> {
    try {
      await this.start();
      return { status: 'connected' }
    } catch (error) {
      return { error }
    }
  }

  async start(): Promise<void> {
    this.conn = await connect(this.uri);    
    this.channel = await this.conn.createChannel();
    console.log('queue thread connected');
  }

  async consume(queue: string, callback: (message: Message) => void) {
    return this.channel.consume(queue, (message) => {
      callback(message);
      this.channel.ack(message);
    })
  }
}