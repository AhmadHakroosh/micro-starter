declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    SERVICE_NAME?: string;
    PORT?: string;

    ATLASDB_HOST?: string;
    ATLASDB_PORT?: string;
    ATLASDB_USER?: string;
    ATLASDB_PASSWORD?: string;
    ATLASDB_DATABASE?: string;

    KAFKA_BROKERS?: string;
    KAFKA_PORT?: string;
    KAFKA_CLIENT_ID?: string;
    KAFKA_GROUP_ID?: string;
    KAFKA_MANUAL_ACK?: string;
    KAFKA_TOPICS?: string;
    KAFKA_DLQ_RETRY_COUNT?: string;
    KAFKA_HEARTBEAT_INTERVAL?: string;
    KAFKA_SESSION_TIMEOUT?: string;
    
    NEW_RELIC_ENABLED?: string;
    NEW_RELIC_KEY?: string;

    EKS_REDIS_HOST?: string;
    EKS_REDIS_PORT?: string;

    HEALTH_PATH?: string;

    LOG_LEVEL?: 'info' | 'debug' | 'warn' | 'error' | 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  }
}
