import { Injectable } from '@nestjs/common';
import { Channel, connect, Connection, Message } from 'amqplib';

@Injectable()
export class QueueService {

  private conn: Connection;
  private channel: Channel;

  async connectToServer(): Promise<any> {
    try {
      await this.start();
      return { status: 'connected' }
    } catch (error) {
      return { error }
    }
  }

  async start(): Promise<void> {
    console.log(process.env.QUEUE_CONSUMER_LOCATION, 'QUEUE_CONSUMER_LOCATION');

    this.conn = await connect(process.env.QUEUE_CONSUMER_LOCATION);
    this.channel = await this.conn.createChannel();
    console.log('queue thread connected');
  }

  async consume(queue: string, callback: (message: Message) => void) {
    console.log(queue, process.env.QUEUE_CONSUMER_LOCATION, 'QUEUE');
    return this.channel.consume(queue, (message) => {
      callback(message);
      this.channel.ack(message);
    })
  }
}
