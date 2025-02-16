// kafka.producer.service.spec.ts
import { KafkaProducerService } from './kafka-producer.service';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { Logger } from '@nestjs/common';
import { KAFKA_TOPIC } from '@kafka/interfaces';

// Fake implementations for our topic and schema.
const fakeTopic = 'TEST_TOPIC';
interface TestTopicMessage {
  foo: string;
}
type FakeMessagePayload = { key: string; value: TestTopicMessage };

jest.mock('@kafka/interfaces', () => ({
  KAFKA_TOPIC_MESSAGE: { TEST_TOPIC: {} },
  // MESSAGE_SCHEMA is an object keyed by topic, with each value having a validate function.
  MESSAGE_SCHEMA: {
    TEST_TOPIC: {
      validate: (value: any, options: any) => {
        // For testing, if value.foo is a string, it's valid; otherwise, return an error.
        if (typeof value.foo === 'string') {
          return { error: undefined };
        }
        return { error: { stack: 'ValidationError: "foo" must be a string' } };
      },
    },
  },
}));

describe('KafkaProducerService', () => {
  let service: KafkaProducerService;
  let fakeConfigService: Partial<ConfigService>;
  let fakeProducer: Partial<Producer>;
  let kafkaProducerSpy: jest.SpyInstance;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Create a fake ConfigService.
    fakeConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'kafka.clientId': 'test-client',
          'kafka.brokers': ['broker:9092'],
        };
        return config[key];
      }),
    };

    // Create a fake producer with stubbed methods.
    fakeProducer = {
      connect: jest.fn().mockResolvedValue(undefined),
      send: jest.fn().mockResolvedValue('sent-result'),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    // Spy on Kafka.prototype.producer so that when the service creates a producer,
    // we return our fakeProducer.
    kafkaProducerSpy = jest
      .spyOn(Kafka.prototype, 'producer')
      .mockReturnValue(fakeProducer as Producer);

    // Create the service.
    service = new KafkaProducerService(fakeConfigService as ConfigService);

    // Spy on the logger methods.
    loggerLogSpy = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => {});
    loggerErrorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    kafkaProducerSpy.mockRestore();
  });

  describe('onModuleInit', () => {
    it('should connect and log a connection message', async () => {
      await service.onModuleInit();
      expect(fakeProducer.connect).toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Kafka Producer connected',
        KafkaProducerService.name,
      );
    });
  });

  describe('sendMessage', () => {
    const validMessage: FakeMessagePayload = {
      key: 'key1',
      value: { foo: 'bar' },
    };

    const invalidMessage: FakeMessagePayload = {
      key: 'key2',
      value: { foo: 123 } as any, // invalid because foo is not a string
    };

    it('should send valid messages and log success', async () => {
      // Test with a single valid message.
      const result = await service.sendMessage(
        fakeTopic as KAFKA_TOPIC,
        validMessage as any,
      );
      // The message should be validated and then serialized.
      const expectedPayload = [
        { key: validMessage.key, value: JSON.stringify(validMessage.value) },
      ];
      expect(fakeProducer.send).toHaveBeenCalledWith({
        topic: fakeTopic,
        messages: expectedPayload,
      });
      expect(loggerLogSpy).toHaveBeenCalledWith({
        message: 'Message sent to Kafka successfully',
        method: service.sendMessage.name,
        topic: fakeTopic,
        kafkaMessage: expectedPayload,
      });
      expect(result).toBe('sent-result');
    });

    it('should handle an array of messages', async () => {
      const messages = [validMessage, validMessage];
      await service.sendMessage(fakeTopic as KAFKA_TOPIC, messages as any);
      const expectedPayload = messages.map(({ key, value }) => ({
        key,
        value: JSON.stringify(value),
      }));
      expect(fakeProducer.send).toHaveBeenCalledWith({
        topic: fakeTopic,
        messages: expectedPayload,
      });
    });

    it('should filter out invalid messages and log an error', async () => {
      // Send one valid and one invalid message.
      const messages = [validMessage, invalidMessage];
      const result = await service.sendMessage(
        fakeTopic as KAFKA_TOPIC,
        messages as any,
      );
      // Only the valid message should be sent.
      const expectedPayload = [
        { key: validMessage.key, value: JSON.stringify(validMessage.value) },
      ];
      expect(fakeProducer.send).toHaveBeenCalledWith({
        topic: fakeTopic,
        messages: expectedPayload,
      });
      // logger.error should have been called once for the invalid message.
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Invalid message schema',
        method: service.sendMessage.name,
        error: 'ValidationError: "foo" must be a string',
        kafkaMessage: invalidMessage,
      });
      expect(result).toBe('sent-result');
    });

    it('should throw an error if producer.send fails', async () => {
      // Force producer.send to throw an error.
      const error = new Error('send error');
      (fakeProducer.send as jest.Mock).mockRejectedValue(error);
      await expect(
        service.sendMessage(fakeTopic as KAFKA_TOPIC, validMessage as any),
      ).rejects.toThrow('send error');
      expect(loggerErrorSpy).toHaveBeenCalledWith({
        message: 'Error sending message to Kafka',
        method: service.sendMessage.name,
        error: error.stack,
        kafkaMessage: [
          { key: validMessage.key, value: JSON.stringify(validMessage.value) },
        ],
      });
    });
  });

  describe('onApplicationShutdown', () => {
    it('should disconnect and log a disconnection message', async () => {
      await service.onApplicationShutdown();
      expect(fakeProducer.disconnect).toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        'Kafka Producer disconnected',
        KafkaProducerService.name,
      );
    });
  });
});
