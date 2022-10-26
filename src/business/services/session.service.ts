import { Injectable } from "@nestjs/common";
import { httpStatus } from "src/infra/helpers/httpStatusEnum";
import response from "./response";
import { WhatsAppService } from "./whatsapp.service";

@Injectable()
export class SessionService {
    constructor(
        private readonly whatsAppService: WhatsAppService
    ) {

    /**
    * TODO: need to declare each accessor level to each method, like:
    *
    * public
    * private
    * protected
    * 
    */
        
    }
    find(res) {
        var exists = this.whatsAppService.isSessionExists(res.id);
        if (!exists)
            return response(httpStatus.NotFound, false, 'Session not found.')
            
        return response(httpStatus.Ok, true, 'Session found.')
    }
    
    status(sessionId) {
        const states = ['connecting', 'connected', 'disconnecting', 'disconnected']
    
        const session = this.whatsAppService.getSession(sessionId)

        if (!session)
            return response(httpStatus.Ok, true, '', { status: "disconnected" })

        let state = states[session.ws.readyState]
    
        state =
            state === 'connected' && typeof (session.isLegacy ? session.state.legacy.user : session.user) !== 'undefined'
                ? 'authenticated'
                : state
    
        return response(httpStatus.Ok, true, '', { status: state })
    }
    
    async add(req: CreateSessionRequestDto) {
        const { sessionId, isLegacy } = req
    
        if (this.whatsAppService.isSessionExists(sessionId)) {
            return response(httpStatus.Conflict, false, 'Session already exists, please use another id.')
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
    
        return response(httpStatus.Ok, true, 'The session has been successfully deleted.', sessionId)
    }
}