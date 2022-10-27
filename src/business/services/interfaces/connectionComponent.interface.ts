export declare interface IConnectionComponent {
    createSession(sessionId: string, isLegacy: boolean): Promise<any>;
}