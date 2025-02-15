// src/config/index.spec.ts
import { config, DEFAULTS, ENV_SCHEMA } from './config';
import { ValidationError, ValidationResult } from 'joi';

interface ValidEnv {
  name: string;
  'logger.level': string;
  nodeEnv: string;
}

describe('Configuration Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv }; // clone current environment
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return default configuration when no environment variables are set', () => {
    // Remove all config-dependent variables
    delete process.env.NODE_ENV;
    delete process.env.SERVICE_NAME;
    delete process.env.PORT;
    delete process.env.ATLASDB_HOST;
    delete process.env.ATLASDB_PORT;
    delete process.env.ATLASDB_USER;
    delete process.env.ATLASDB_PASSWORD;
    delete process.env.ATLASDB_DATABASE;
    delete process.env.KAFKA_BROKERS;
    delete process.env.KAFKA_CLIENT_ID;
    delete process.env.KAFKA_GROUP_ID;
    delete process.env.KAFKA_TOPICS;
    delete process.env.KAFKA_MANUAL_ACK;
    delete process.env.KAFKA_DLQ_RETRY_COUNT;
    delete process.env.NEW_RELIC_ENABLED;
    delete process.env.NEW_RELIC_KEY;
    delete process.env.EKS_REDIS_HOST;
    delete process.env.EKS_REDIS_PORT;
    delete process.env.HEALTH_PATH;

    const cfg = config();

    expect(cfg.nodeEnv).toBe('production');
    expect(cfg.name).toBe(DEFAULTS.name);
    expect(cfg.port).toBe(DEFAULTS.port);
    expect(cfg.mongoUrl).toContain('mongodb+srv://');

    expect(cfg.kafka.brokers).toEqual(
      DEFAULTS.kafka.brokers
        .split(',')
        .map((broker) => `${broker}:${DEFAULTS.kafka.port}`),
    );
    expect(cfg.kafka.clientId).toBe(DEFAULTS.kafka.clientId);
    expect(cfg.kafka.groupId).toBe(DEFAULTS.kafka.groupId);
    expect(cfg.kafka.topics).toEqual([]);
    expect(cfg.kafka.manualAck).toBe(DEFAULTS.kafka.manualAck);
    expect(cfg.kafka.dlqRetryCount).toBe(DEFAULTS.kafka.dlqRetryCount);

    expect(cfg.newRelic.enabled).toBe(false);
    expect(cfg.newRelic.key).toBe(DEFAULTS.newRelic.key);

    // For redis and eksRedis, when not set the parsing fallback returns NaN.
    expect(isNaN(cfg.redis.port)).toBe(false);
    expect(cfg.redis.host).toBe(DEFAULTS.redis.host);

    expect(cfg.healthPath).toBe(DEFAULTS.healthPath);
  });

  it('should override default values with provided environment variables (non-development)', () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVICE_NAME = 'custom-service';
    process.env.PORT = '4000';
    process.env.ATLASDB_HOST = 'atlas.mongodb.net';
    process.env.ATLASDB_PORT = '27017';
    process.env.ATLASDB_USER = 'user';
    process.env.ATLASDB_PASSWORD = 'pass';
    process.env.ATLASDB_DATABASE = 'db';
    process.env.KAFKA_BROKERS = 'broker1,broker2';
    process.env.KAFKA_CLIENT_ID = 'custom-client';
    process.env.KAFKA_GROUP_ID = 'custom-group';
    process.env.KAFKA_TOPICS = 'topic1,topic2';
    process.env.KAFKA_MANUAL_ACK = 'true';
    process.env.KAFKA_DLQ_RETRY_COUNT = '5';
    process.env.NEW_RELIC_ENABLED = 'true';
    process.env.NEW_RELIC_KEY = 'abc123';
    process.env.EKS_REDIS_HOST = 'eks.redis.host';
    process.env.EKS_REDIS_PORT = '6381';
    process.env.HEALTH_PATH = '/healthz';

    const cfg = config();

    expect(cfg.nodeEnv).toBe('production');
    expect(cfg.name).toBe('custom-service');
    expect(cfg.port).toBe(4000);
    // Since NODE_ENV is production (not development), use mongodb+srv protocol:
    expect(cfg.mongoUrl).toBe(
      `mongodb+srv://user:pass@atlas.mongodb.net/db?w=1`,
    );
    expect(cfg.kafka.brokers).toEqual(['broker1:9092', 'broker2:9092']);
    expect(cfg.kafka.clientId).toBe('custom-client');
    expect(cfg.kafka.groupId).toBe('custom-group');
    expect(cfg.kafka.topics).toEqual(['topic1', 'topic2']);
    expect(cfg.kafka.manualAck).toBe(true);
    expect(cfg.kafka.dlqRetryCount).toBe(5);
    expect(cfg.newRelic.enabled).toBe(true);
    expect(cfg.newRelic.key).toBe('abc123');
    expect(cfg.redis.host).toBe('eks.redis.host');
    expect(cfg.redis.port).toBe(6381);
    expect(cfg.healthPath).toBe('/healthz');
  });

  it('should override defaults with provided environment variables (development)', () => {
    process.env.NODE_ENV = 'development';
    process.env.SERVICE_NAME = 'dev-service';
    process.env.PORT = '3001';
    process.env.ATLASDB_HOST = 'dev.atlas.mongodb.net';
    process.env.ATLASDB_PORT = '27017';
    process.env.ATLASDB_USER = 'devuser';
    process.env.ATLASDB_PASSWORD = 'devpass';
    process.env.ATLASDB_DATABASE = 'devdb';

    const cfg = config();

    // In development, we use "mongodb" protocol.
    expect(cfg.mongoUrl).toBe(
      `mongodb://devuser:devpass@dev.atlas.mongodb.net:27017/devdb?authSource=admin`,
    );
  });

  it('should properly parse integer and boolean values', () => {
    process.env.PORT = '5000';
    process.env.KAFKA_DLQ_RETRY_COUNT = '10';
    process.env.KAFKA_MANUAL_ACK = 'false';

    const cfg = config();
    expect(cfg.port).toBe(5000);
    expect(cfg.kafka.dlqRetryCount).toBe(10);
    expect(cfg.kafka.manualAck).toBe(false);
  });

  it('should correctly split comma-separated lists for brokers and topics', () => {
    process.env.KAFKA_BROKERS = 'brokerA,brokerB';
    process.env.KAFKA_TOPICS = 'topicA,topicB,topicC';

    const cfg = config();
    expect(cfg.kafka.brokers).toEqual(['brokerA:9092', 'brokerB:9092']);
    expect(cfg.kafka.topics).toEqual(['topicA', 'topicB', 'topicC']);
  });

  it('should use default values when numeric or boolean environment variables are invalid', () => {
    process.env.PORT = 'invalid';
    process.env.KAFKA_DLQ_RETRY_COUNT = 'invalid';
    process.env.KAFKA_MANUAL_ACK = 'invalid';

    const cfg = config();
    expect(cfg.port).toBe(DEFAULTS.port);
    expect(cfg.kafka.dlqRetryCount).toBe(DEFAULTS.kafka.dlqRetryCount);
    expect(cfg.kafka.manualAck).toBe(DEFAULTS.kafka.manualAck);
  });

  describe('ENV_SCHEMA', () => {
    it('should validate a correct environment', () => {
      const validEnv = {
        NODE_ENV: 'production',
        SERVICE_NAME: 'my-service',
        PORT: 3000,
        ATLASDB_HOST: 'atlas.mongodb.net',
        ATLASDB_PORT: 27017,
        ATLASDB_USER: 'user',
        ATLASDB_PASSWORD: 'pass',
        ATLASDB_DATABASE: 'db',
        KAFKA_BROKERS: 'broker1:9092,broker2:9092',
        KAFKA_CLIENT_ID: 'client',
        KAFKA_GROUP_ID: 'group',
        KAFKA_MANUAL_ACK: true,
        KAFKA_TOPICS: 'topic1,topic2',
        KAFKA_DLQ_RETRY_COUNT: 3,
        NEW_RELIC_ENABLED: true,
        NEW_RELIC_KEY: 'key',
        EKS_REDIS_HOST: 'eks.redis.host',
        EKS_REDIS_PORT: 6379,
        HEALTH_PATH: '/health',
      };

      const result: ValidationResult<ValidEnv> = ENV_SCHEMA.validate(
        validEnv,
      ) as ValidationResult<ValidEnv>;

      // Provide explicit types for error and value during destructuring.
      const { error, value } = result as {
        error: ValidationError | undefined;
        value: ValidEnv;
      };
      expect(error).toBeUndefined();
      expect(value).toEqual(validEnv);
    });

    it('should fail validation if required variables are missing', () => {
      const invalidEnv = {
        NODE_ENV: 'production',
        SERVICE_NAME: 'my-service',
        PORT: 3000,
        // Missing ATLASDB_* variables
        KAFKA_BROKERS: 'broker1:9092,broker2:9092',
        NEW_RELIC_ENABLED: true,
        NEW_RELIC_KEY: 'key',
        REDIS_HOST: 'redis.host',
        REDIS_PORT: 6379,
        EKS_REDIS_HOST: 'eks.redis.host',
        EKS_REDIS_PORT: 6379,
        HEALTH_PATH: '/health',
      };

      const { error } = ENV_SCHEMA.validate(invalidEnv);
      expect(error).toBeDefined();
    });

    it('should fail validation if NODE_ENV is invalid', () => {
      const invalidEnv = {
        NODE_ENV: 'invalid',
        SERVICE_NAME: 'my-service',
        PORT: 3000,
        ATLASDB_HOST: 'atlas.mongodb.net',
        ATLASDB_PORT: 27017,
        ATLASDB_USER: 'user',
        ATLASDB_PASSWORD: 'pass',
        ATLASDB_DATABASE: 'db',
        KAFKA_BROKERS: 'broker1:9092,broker2:9092',
        NEW_RELIC_ENABLED: true,
        NEW_RELIC_KEY: 'key',
        REDIS_HOST: 'redis.host',
        REDIS_PORT: 6379,
        EKS_REDIS_HOST: 'eks.redis.host',
        EKS_REDIS_PORT: 6379,
        HEALTH_PATH: '/health',
      };

      const { error } = ENV_SCHEMA.validate(invalidEnv);
      expect(error).toBeDefined();
    });
  });
});
