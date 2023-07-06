import { Injectable } from '@nestjs/common';
import { rmSync, readdir } from 'fs'
import { join } from 'path'
import pino from 'pino'
import makeWASocket, {
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
  delay,
  AnyMessageContent,
  WASocket,
  proto
} from '@adiwajshing/baileys'
import { toDataURL } from 'qrcode'
import { Boom } from '@hapi/boom'
import { SessionWebSocket } from 'src/infra/websockets/session.ws';
import { MessageWebSocket } from 'src/infra/websockets/message.ws';
import response from './response';
import { IConnectionComponent } from './interfaces/connectionComponent.interface';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs/internal/lastValueFrom';
import { QueueService } from 'src/infra/queue/queue';
import { httpStatus } from 'src/infra/helpers/httpStatusEnum';
import  { useRedisAuthState } from 'baileys-redis-auth'
import * as redis from 'redis';

const client = redis.createClient({
    socket: {
        host: 'api.cliinic.cloud'
    }
});

(async () => {
  await client.connect();
})();

console.log("Connecting to the Redis");

client.on("ready", () => {
  console.log("Connected!");
  client.flushAll()
});

client.on("error", (err) => {
  console.log("Error in the Connection", err);
});

let sessions = new Map()
let retries = new Map()
let queue = new QueueService();

@Injectable()
export class WhatsAppService implements IConnectionComponent {

  constructor (
    private readonly sessionWebSocket: SessionWebSocket,
    private readonly messageWebSocket: MessageWebSocket,
    private readonly httpService: HttpService
  ) { }


  /**
   * TODO: need to declare each accessor level to each method, like:
   *
   * public
   * private
   * protected
   *
   * TODO: need to avaliate each scope method to implement extensor method, helper method or even in a base method
   *
   */

  sessionsDir (sessionId = '') {
    return join(__dirname, 'tokens', sessionId ? sessionId : '')
  }

  isSessionExists (sessionId: any) {
    return sessions.has(sessionId)
  }

  shouldReconnect (sessionId: string) {
    let maxRetries = parseInt(process.env.MAX_RETRIES) ?? 0;
    let attempts = retries.get(sessionId) ?? 0

    maxRetries = maxRetries < 1 ? 1 : maxRetries
    if (attempts < maxRetries) {
      ++attempts

      console.log('emit qr code...', { attempts, sessionId })
      retries.set(sessionId, attempts)

      return true
    }

    return false
  }

  async createSession (sessionId: string, isLegacy: boolean): Promise<any> {
    await this.connectQueueServer();

    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId + (isLegacy ? '.json' : '')

    const logger = pino({ level: 'warn' })
    const store = makeInMemoryStore({ logger })

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionsDir(sessionFile))

    const wa: WASocket = makeWASocket({
      version: [2, 2323, 4],
      auth: state,
      logger
    })

    if (!isLegacy) {
      store.readFromFile(this.sessionsDir(`${sessionId}_store.json`))
      store.bind(wa.ev)
    }

    sessions.set(sessionId, { ...wa, store, isLegacy })

    wa.ev.on('creds.update', saveCreds)

    wa.ev.on('chats.upsert', (chats) => {
      if (isLegacy) {
        store.chats.insertIfAbsent(...chats)
      }
    })
    wa.ev.on('connection.update', async (update) => {
      if (update.qr) {
        if (this.shouldReconnect(sessionId)) {
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "waiting" })
          this.sessionWebSocket.emitQrCodeEvent(sessionId, await toDataURL(update.qr));
        } else {
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "try again" })
          wa.ev.removeAllListeners('connection.update')
          retries.delete(sessionId)
          console.log('qr code timeout');
        }
      }

      // Gets connection status
      const { lastDisconnect, connection } = update;
      if (connection) logger.info("Connection Status: ", connection)
      let reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      // Handle reconnection
      if (connection === 'close') {

        if (reason === DisconnectReason.badSession) {
          logger.error(`Bad Session, Please Delete /auth and Scan Again`)
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "disconnected" });
          await client.set(sessionId + '-store', 'disconnected')
        } else if (reason === DisconnectReason.connectionClosed) {
          logger.warn("Connection closed, reconnecting....");
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "reconnecting" });
          await this.createSession(sessionId, false)
        } else if (reason === DisconnectReason.connectionLost) {
          logger.warn("Connection Lost from Server, reconnecting...");
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "reconnecting" });
          await this.createSession(sessionId, false)
        } else if (reason === DisconnectReason.connectionReplaced) {
          logger.error("Connection Replaced, Another New Session Opened, Please Close Current Session First");
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "disconnected" });
        } else if (reason === DisconnectReason.loggedOut) {
          logger.error(`Device Logged Out, Please Delete /auth and Scan Again.`)
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "disconnected" });

          await client.set(sessionId + '-store', 'disconnected')
        } else if (reason === DisconnectReason.restartRequired) {
          logger.info("Restart Required, Restarting...");
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "reconnecting" });
          await this.createSession(sessionId, false)
        } else if (reason === DisconnectReason.timedOut) {
          logger.warn("Connection TimedOut, Reconnecting...");
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "reconnecting" });
          await this.createSession(sessionId, false)

          await client.set(sessionId + '-store', 'reconnecting')
        } else {
          logger.warn(`Unknown DisconnectReason: ${reason}: ${connection}`);
          this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "reconnecting" });
          await this.createSession(sessionId, false)
        }
      } else if (connection === 'open') {
        this.sessionWebSocket.emitSessionStatus(sessionId, { connection: "connected" });
        logger.info('Opened connection');

        await client.set(sessionId + '-store', 'connected')
      }

    })
    // await lastValueFrom(this.httpService.post(`${process.env.WORKER_API_LOCATION}/worker/${sessionId}/start`));
    await this.queueConsumerMessages(sessionId);
    await this.listenMessages(sessionId);
  }

  async listenMessages (sessionId: string) {

    const wa: WASocket = sessions.get(sessionId);

    wa.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0]

      if (m.type === 'notify' && message.key.remoteJid.includes('@g.us') || message.key.fromMe) {
        this.messageWebSocket.emitOnMessage(sessionId, message);
        await this.publishQueue(sessionId, message)
        //await wa.sendReadReceipt(message.key.remoteJid, message.key.participant, [message.key.id])
      }
    })
  }

  async status (sessionId) {
    let statusConn = await client.get(sessionId + '-store')

		if (!statusConn)
			return response(httpStatus.NotFound, false, '', { status: "disconnected" })

		return response(httpStatus.Ok, true, '', { status: statusConn })
	}

  getSession (sessionId: string | null) {
    return sessions.get(sessionId) ?? null
  }

  async deleteSession (sessionId: string, isLegacy = false) {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId + (isLegacy ? '.json' : '')
    const storeFile = `${sessionId}_store.json`
    const rmOptions = { force: true, recursive: true }

    rmSync(this.sessionsDir(sessionFile), rmOptions)
    rmSync(this.sessionsDir(storeFile), rmOptions)


    await client.del(sessionId + '-store')
    sessions.delete(sessionId)
    retries.delete(sessionId)
  }

  getChatList (sessionId, isGroup = false) {
    const filter = isGroup ? '@g.us' : '@s.whatsapp.net'

    return this.getSession(sessionId).store.chats.filter((chat) => {
      return chat.id.endsWith(filter)
    })
  }

  async isExists (session: WASocket, jid: string, isGroup = false) {
    try {
      let result;

      if (isGroup) {
        result = await session.groupMetadata(jid)

        return Boolean(result.id)
      }

      result = await session.onWhatsApp(jid)

      return result.exists
    } catch {
      return false
    }
  }

  async sendMessage (sessionId: string, session: WASocket, receiver: string, message: AnyMessageContent, delayMs = 1000) {
    if (!session)
      return response(httpStatus.Unauthorized, false, 'disconnected')

    try {
      await delay(delayMs);

      let sendedMessage = await session.sendMessage(receiver, message)

      this.messageWebSocket.emitOnMessage(sessionId, sendedMessage);

      return sendedMessage;
    } catch (ex) {
      return response(httpStatus.internalServerError, false, 'Error during send message', ex)
    }
  }

  formatPhone (phone: string) {
    if (phone.endsWith('@s.whatsapp.net')) {
      return phone
    }

    let formatted = phone.replace(/\D/g, '')

    return (formatted += '@s.whatsapp.net')
  }

  formatGroup (group: string) {
    if (group.endsWith('@g.us')) {
      return group
    }

    let formatted = group.replace(/[^\d-]/g, '')

    return (formatted += '@g.us')
  }

  cleanup () {
    console.log('Running cleanup before exit.')

    sessions.forEach((session, sessionId) => {
      if (!session.isLegacy) {
        session.store.writeToFile(this.sessionsDir(`${sessionId}_store.json`))
      }
    })
  }

  init () {
    readdir(this.sessionsDir(), (err, files) => {
      if (err) {
        throw err
      }

      for (const file of files) {
        if ((!file.startsWith('md_') && !file.startsWith('legacy_')) || file.endsWith('_store')) {
          continue
        }

        const filename = file.replace('.json', '')
        const isLegacy = filename.split('_', 1)[0] !== 'md'
        const sessionId = filename.substring(isLegacy ? 7 : 3)

        this.createSession(sessionId, isLegacy)
      }
    })
  }

  async publishQueue (sessionId: string, data: any) {
    let messageInfo = {
      remoteJid: data.key.remoteJid,
      fromJid: sessionId,
      fromMe: data.key.fromMe,
      id: data.key.id,
      pushName: data.pushName,
      message: data.message,
      messageTimestamp: data.messageTimestamp
    }

    let msgToQueue = {
      properties: {
        content_type: "application/json"
      },
      routing_key: `receivedMessage_${sessionId}`,
      payload: JSON.stringify(messageInfo),
      payload_encoding: "string"
    }

    console.log(process.env.QUEUE_LOCATION, 'queue location');

    await lastValueFrom(
      this.httpService.post(process.env.QUEUE_LOCATION, msgToQueue, {
        auth: {
          username: process.env.QUEUE_USERNAME,
          password: process.env.QUEUE_PASSWORD
        }
      })
    );
  }

  async connectQueueServer () {
    await queue.connectToServer();
  }

  async queueConsumerMessages (sessionId: string) {


    await queue.consume(`sendMessage_${sessionId}`, async sendMessage => {
      console.log('mensagem consumida whatsapp');

      let data = this.parseMessageQueue(sendMessage.content.toString());

      if (!this.isSessionExists(data.sessionId)) {
        console.log(`error on consume message: sessionId ${data.sessionId} not found or disconnected`);
        return;
      }

      const wa: WASocket = sessions.get(data.sessionId);
      const jid = this.formatPhone(data.receiver);

      await this.sendMessage(data.sessionId, wa, jid, data.message, data.delayMs ? data.delayMs : 1000)
    })
  }

  parseMessageQueue (data: string) {
    return JSON.parse(data);
  }
}

