interface SendMessageDTO {
    sessionId: string,
    receiver: string;
    message: {
        text: string
    };
    delayMs: number;
}