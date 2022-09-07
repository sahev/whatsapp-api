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
        var exists = this.whatsAppService.isSessionExists(res.id);
        if (!exists)
            return response(404, false, 'Session not found.')
            
        return response(200, true, 'Session found.')
    }
    
    status(sessionId) {
        const states = ['connecting', 'connected', 'disconnecting', 'disconnected']
    
        const session = this.whatsAppService.getSession(sessionId)

        if (!session)
            return response(200, true, '', { status: "disconnected" })

        let state = states[session.ws.readyState]
    
        state =
            state === 'connected' && typeof (session.isLegacy ? session.state.legacy.user : session.user) !== 'undefined'
                ? 'authenticated'
                : state
    
        return response(200, true, '', { status: state })
    }
    
    async add(req: CreateSessionRequestDto) {
        const { sessionId, isLegacy } = req
    
        if (this.whatsAppService.isSessionExists(sessionId)) {
            return response(409, false, 'Session already exists, please use another id.')
        }
    
        return await this.whatsAppService.createSession(sessionId, isLegacy)
    }
    
    async delete(sessionId: string) {
        const session = this.whatsAppService.getSession(sessionId)
    
        try {
            await session.logout()
        } catch {
        } finally {
            this.whatsAppService.deleteSession(sessionId, session.isLegacy)
        }
    
        return response(200, true, 'The session has been successfully deleted.', sessionId)
    }
}