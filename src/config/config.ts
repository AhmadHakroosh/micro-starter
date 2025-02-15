import * as Joi from 'joi';

export const DEFAULTS = {
  nodeEnv: 'production',
  name: 'cloud-[YOUR_SERVICE_NAME]-service',
  port: 3000,
  mongoUrl: 'mongodb://localhost:27017/[YOUR_DB_NAME]',
  kafka: {
    brokers: 'localhost',
    port: 9092,
    clientId: 'cloud-[YOUR_SERVICE_NAME]-service',
    groupId: 'cloud-[YOUR_SERVICE_NAME]-group',
    topics: [],
    manualAck: false,
    dlqRetryCount: 3,
    heartbeatInterval: 5000,
    sessionTimeout: 10000,
  },
  newRelic: {
    enabled: false,
    key: '******',
  },
  redis: {
    host: 'localhost',
    port: 6379,
  },
  healthPath: '/health',
  logger: {
    level: 'info',
  },
};

export const config = () => ({
  nodeEnv: process.env.NODE_ENV || DEFAULTS.nodeEnv,
  name: process.env.SERVICE_NAME || DEFAULTS.name,
  port: parseInt(process.env.PORT || '0', 10) || DEFAULTS.port,
  mongoUrl:
    process.env.NODE_ENV !== 'development'
      ? `mongodb+srv://${encodeURIComponent(process.env.ATLASDB_USER!)}:${encodeURIComponent(process.env.ATLASDB_PASSWORD!)}` +
        `@${process.env.ATLASDB_HOST}/${process.env.ATLASDB_DATABASE}?w=1`
      : `mongodb://${process.env.ATLASDB_USER}:${process.env.ATLASDB_PASSWORD}` +
        `@${process.env.ATLASDB_HOST}:${process.env.ATLASDB_PORT}/${process.env.ATLASDB_DATABASE}?authSource=admin`,

  kafka: {
    brokers: process.env.KAFKA_BROKERS
      ? process.env.KAFKA_BROKERS.split(',').map(
          (broker) =>
            `${broker}:${process.env.KAFKA_PORT || DEFAULTS.kafka.port}`,
        )
      : DEFAULTS.kafka.brokers
          .split(',')
          .map((broker) => `${broker}:${DEFAULTS.kafka.port}`),
    clientId: process.env.KAFKA_CLIENT_ID || DEFAULTS.kafka.clientId,
    groupId: process.env.KAFKA_GROUP_ID || DEFAULTS.kafka.groupId,
    topics: process.env.KAFKA_TOPICS ? process.env.KAFKA_TOPICS.split(',') : [],
    manualAck: process.env.KAFKA_MANUAL_ACK
      ? process.env.KAFKA_MANUAL_ACK === 'true'
      : DEFAULTS.kafka.manualAck,
    dlqRetryCount:
      parseInt(process.env.KAFKA_DLQ_RETRY_COUNT || '0', 10) ||
      DEFAULTS.kafka.dlqRetryCount,
    heartbeatInterval:
      parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '0', 10) ||
      DEFAULTS.kafka.heartbeatInterval,
    sessionTimeout:
      parseInt(process.env.KAFKA_SESSION_TIMEOUT || '0', 10) ||
      DEFAULTS.kafka.sessionTimeout,
  },

  newRelic: {
    enabled: process.env.NEW_RELIC_ENABLED
      ? process.env.NEW_RELIC_ENABLED === 'true'
      : DEFAULTS.newRelic.enabled,
    key: process.env.NEW_RELIC_KEY || DEFAULTS.newRelic.key,
  },

  redis: {
    host: process.env.EKS_REDIS_HOST || DEFAULTS.redis.host,
    port:
      parseInt(process.env.EKS_REDIS_PORT || '0', 10) || DEFAULTS.redis.port,
  },

  healthPath: process.env.HEALTH_PATH || DEFAULTS.healthPath,

  logger: {
    level: (process.env.LOG_LEVEL || DEFAULTS.logger.level).toLowerCase(),
  },
});

export const ENV_SCHEMA = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').required(),
  SERVICE_NAME: Joi.string().required(),
  PORT: Joi.number().required(),

  ATLASDB_HOST: Joi.string().required(),
  ATLASDB_PORT: Joi.number().required(),
  ATLASDB_USER: Joi.string().required(),
  ATLASDB_PASSWORD: Joi.string().required(),
  ATLASDB_DATABASE: Joi.string().required(),

  KAFKA_BROKERS: Joi.string().required(),
  KAFKA_PORT: Joi.number().optional(),
  KAFKA_CLIENT_ID: Joi.string().optional(),
  KAFKA_GROUP_ID: Joi.string().optional(),
  KAFKA_MANUAL_ACK: Joi.boolean().optional(),
  KAFKA_TOPICS: Joi.string().optional(),
  KAFKA_DLQ_RETRY_COUNT: Joi.number().optional(),
  KAFKA_HEARTBEAT_INTERVAL: Joi.number().optional(),
  KAFKA_SESSION_TIMEOUT: Joi.number().optional(),

  NEW_RELIC_ENABLED: Joi.boolean().required(),
  NEW_RELIC_KEY: Joi.string().required(),

  EKS_REDIS_HOST: Joi.string().required(),
  EKS_REDIS_PORT: Joi.number().required(),

  HEALTH_PATH: Joi.string().required(),

  LOG_LEVEL: Joi.string()
    .valid('info', 'debug', 'warn', 'error', 'INFO', 'DEBUG', 'WARN', 'ERROR')
    .optional(),
});
