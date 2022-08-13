import { Injectable } from "@nestjs/common";

@Injectable()
export class ConfigurationService {
    GetEnvConfiguration() {
        return {
            node_env: process.env.NODE_ENV,
            host: process.env.HOST,
            port: process.env.PORT,
            max_retries: process.env.MAX_RETRIES,
            reconnect_interval: process.env.RECONNECT_INTERVAL,
            api_port: process.env.API_PORT,
        }
    }
}