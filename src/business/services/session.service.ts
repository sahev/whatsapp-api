import { Injectable } from "@nestjs/common";
import response from "./response";
import { WhatsAppService } from "./whatsapp.service";

@Injectable()
export class SessionService {
    constructor(
        private readonly whatsAppService: WhatsAppService
    ) {
        
    }
    find(res) {
        return response(res, 200, true, 'Session found.')
    }
    
    status(req, res) {
        const states = ['connecting', 'connected', 'disconnecting', 'disconnected']
    
        const session = this.whatsAppService.getSession(res.locals.sessionId)
        let state = states[session.ws.readyState]
    
        state =
            state === 'connected' && typeof (session.isLegacy ? session.state.legacy.user : session.user) !== 'undefined'
                ? 'authenticated'
                : state
    
        response(res, 200, true, '', { status: state })
    }
    
    async add(req: CreateRequestDto, res = '') {
        const { id, isLegacy } = req
    
        if (this.whatsAppService.isSessionExists(id)) {
            return response(res, 409, false, 'Session already exists, please use another id.')
        }
    
        return await this.whatsAppService.createSession(id, isLegacy, res)
    }
    
    async del(req, res) {
        const { id } = req.params
        const session = this.whatsAppService.getSession(id)
    
        try {
            await session.logout()
        } catch {
        } finally {
            this.whatsAppService.deleteSession(id, session.isLegacy)
        }
    
        response(res, 200, true, 'The session has been successfully deleted.')
    }
}