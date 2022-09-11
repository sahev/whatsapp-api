import { Injectable } from '@nestjs/common';
import { rmSync, readdir } from 'fs'
import { join } from 'path'
import pino from 'pino'
import makeWASocket, {
  useMultiFileAuthState,
  makeInMemoryStore,
  DisconnectReason,
  delay,
  AnyWASocket,
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

const sessions = new Map()
const retries = new Map()
const queue = new QueueService();

@Injectable()
export class WhatsAppService implements IConnectionComponent {

  constructor(
    private readonly sessionWebSocket: SessionWebSocket,
    private readonly messageWebSocket: MessageWebSocket,
    private readonly httpService: HttpService
  ) { }

  sessionsDir(sessionId = '') {
    return join(__dirname, 'tokens', sessionId ? sessionId : '')
  }

  isSessionExists(sessionId: any) {
    return sessions.has(sessionId)
  }

  shouldReconnect(sessionId: string) {
    let maxRetries = process.env.MAX_RETRIES ?? 0;
    let attempts = retries.get(sessionId) ?? 0

    maxRetries = maxRetries < 1 ? 1 : maxRetries

    if (attempts < maxRetries) {
      ++attempts

      console.log('Reconnecting...', { attempts, sessionId })
      retries.set(sessionId, attempts)

      return true
    }

    return false
  }

  async createSession(sessionId: string, isLegacy = false) {

    await this.connectQueueServer();

    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId + (isLegacy ? '.json' : '')

    const logger = pino({ level: 'warn' })
    const store = makeInMemoryStore({ logger })

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionsDir(sessionFile))

    const waConfig = {
      auth: state,
      logger,
    }

    const wa: AnyWASocket = makeWASocket(waConfig)

    if (!isLegacy) {
      store.readFromFile(this.sessionsDir(`${sessionId}_store.json`))
      store.bind(wa.ev)
    }

    sessions.set(sessionId, { ...wa, store, isLegacy })

    wa.ev.on('creds.update', saveCreds)

    wa.ev.on('chats.set', ({ chats }) => {
      if (isLegacy) {
        store.chats.insertIfAbsent(...chats)
      }
    })

    wa.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update

      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut &&
          (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.connectionReplaced;

        if (shouldReconnect) {
          this.createSession(sessionId, false)
          this.sessionWebSocket.emitSessionStatus({ connection: "reconnecting" });
        } else {
          this.sessionWebSocket.emitSessionStatus({ connection: "disconnected" });
          this.deleteSession(sessionId);
        }
      } else if (connection === 'open') {
        this.sessionWebSocket.emitSessionStatus({ connection: "connected" });
      }
      if (update.qr) {
        this.sessionWebSocket.emitSessionStatus({ connection: "waiting" });
        this.sessionWebSocket.emitQrCodeEvent(await toDataURL(update.qr));
      }
    })

    await lastValueFrom(this.httpService.post(`${process.env.WORKER_API_LOCATION}/worker/${sessionId}/start`));
    await this.queueConsumerMessages(sessionId);
    await this.listenMessages(sessionId);
       
  }

  async listenMessages(sessionId: string) {

    const wa: WASocket = sessions.get(sessionId);

    wa.ev.on('messages.upsert', async (m) => {
      const message = m.messages[0]
      if (m.type === 'notify') {
        this.messageWebSocket.emitOnMessage(message);
        await this.publishQueue(sessionId, message)
        // await wa.sendReadReceipt(message.key.remoteJid, message.key.participant, [message.key.id])
      }
    })
  }

  getSession(sessionId: string | null) {
    return sessions.get(sessionId) ?? null
  }

  deleteSession(sessionId: string, isLegacy = false) {
    const sessionFile = (isLegacy ? 'legacy_' : 'md_') + sessionId + (isLegacy ? '.json' : '')
    const storeFile = `${sessionId}_store.json`
    const rmOptions = { force: true, recursive: true }

    rmSync(this.sessionsDir(sessionFile), rmOptions)
    rmSync(this.sessionsDir(storeFile), rmOptions)

    sessions.delete(sessionId)
    retries.delete(sessionId)
  }

  getChatList(sessionId, isGroup = false) {
    const filter = isGroup ? '@g.us' : '@s.whatsapp.net'

    return this.getSession(sessionId).store.chats.filter((chat) => {
      return chat.id.endsWith(filter)
    })
  }

  async isExists(session: WASocket, jid: string, isGroup = false) {
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

  async sendMessage(session: WASocket, receiver: string, message: AnyMessageContent, delayMs = 1000) {
    if (!session)
      return response(401, false, 'disconnected')

    try {
      await delay(delayMs);

      let sendedMessage = await session.sendMessage(receiver, message)

      this.messageWebSocket.emitOnMessage(sendedMessage);

      return sendedMessage;
    } catch (ex) {
      return response(500, false, 'Error during send message', ex)
    }
  }

  formatPhone(phone: string) {
    if (phone.endsWith('@s.whatsapp.net')) {
      return phone
    }

    let formatted = phone.replace(/\D/g, '')

    return (formatted += '@s.whatsapp.net')
  }

  formatGroup(group: string) {
    if (group.endsWith('@g.us')) {
      return group
    }

    let formatted = group.replace(/[^\d-]/g, '')

    return (formatted += '@g.us')
  }

  cleanup() {
    console.log('Running cleanup before exit.')

    sessions.forEach((session, sessionId) => {
      if (!session.isLegacy) {
        session.store.writeToFile(this.sessionsDir(`${sessionId}_store.json`))
      }
    })
  }

  init() {
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

  async publishQueue(sessionId: string, data: any) {
    console.log('mensagem publicada whatsapp');
    
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

    await lastValueFrom(
      this.httpService.post(process.env.QUEUE_LOCATION, msgToQueue, {
        auth: {
          username: process.env.QUEUE_USERNAME,
          password: process.env.QUEUE_PASSWORD
        }
      })
    );
  }

  async connectQueueServer() {
    await queue.connectToServer();
  }

  async queueConsumerMessages(sessionId: string) {


    await queue.consume(`sendMessage_${sessionId}`, async sendMessage => {   
      console.log('mensagem consumida whatsapp');
         
      let data = this.parseMessageQueue(sendMessage.content.toString());

      if (!this.isSessionExists(data.sessionId)) {
        console.log(`error on consume message: sessionId ${data.sessionId} not found or disconnected`);
        return;
      }

      const wa: WASocket = sessions.get(data.sessionId);
      const jid = this.formatPhone(data.receiver);

      await this.sendMessage(wa, jid, data.message, data.delayMs ? data.delayMs : 1000)
    })
  }

  parseMessageQueue(data: string) {
    return JSON.parse(data);
  }
}

