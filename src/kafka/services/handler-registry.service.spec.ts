// handler-registry.service.spec.ts
import { HandlerRegistry } from './handler-registry.service';
import { DiscoveryService } from '@nestjs/core';
import { KafkaMessage } from 'kafkajs';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { MESSAGE_HANDLER_METADATA_KEY } from '@kafka/decorators';
import { KAFKA_TOPIC_MESSAGE } from '@kafka/interfaces';

// For our tests, we assume that KAFKA_TOPIC_MESSAGE is similar to:
interface TestTopicMessage {
  // Use any shape you want for testing.
  foo?: string;
}
const TEST_TOPIC = 'TEST_TOPIC' as keyof KAFKA_TOPIC_MESSAGE;

// Create a fake DiscoveryService that we can control.
class FakeDiscoveryService extends DiscoveryService {
  private providers: InstanceWrapper<any>[] = [];

  constructor() {
    // Pass a dummy modulesContainer (an empty object) to satisfy the signature.
    super({} as any);
  }

  getProviders(): InstanceWrapper<any>[] {
    return this.providers;
  }

  addProvider(wrapper: InstanceWrapper<any>) {
    this.providers.push(wrapper);
  }
}

describe('HandlerRegistry', () => {
  let discoveryService: FakeDiscoveryService;
  let handlerRegistry: HandlerRegistry;
  let loggerLogSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    discoveryService = new FakeDiscoveryService();
    handlerRegistry = new HandlerRegistry(discoveryService);
    // Spy on the logger methods from the HandlerRegistry instance.
    loggerLogSpy = jest
      .spyOn((handlerRegistry as any).logger, 'log')
      .mockImplementation(() => {});
    loggerErrorSpy = jest
      .spyOn((handlerRegistry as any).logger, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should register handlers from discovered providers', () => {
      // Create a dummy service with a method decorated with metadata.
      class DummyService {
        handleDummy(this: void, messages: TestTopicMessage[]): void {}
      }
      // Define metadata on the DummyService constructor.
      const dummyHandlerEntry = [
        { topic: TEST_TOPIC, handler: DummyService.prototype.handleDummy },
      ];
      Reflect.defineMetadata(
        MESSAGE_HANDLER_METADATA_KEY,
        dummyHandlerEntry,
        DummyService,
      );

      const instance = new DummyService();
      const wrapper: InstanceWrapper<any> = {
        instance,
      } as InstanceWrapper<any>;
      discoveryService.addProvider(wrapper);

      handlerRegistry.onModuleInit();

      // Now expect that the handler is registered.
      expect(handlerRegistry.getRegisteredTopics()).toContain(TEST_TOPIC);
      // Also, ensure that log was called on registration.
      expect(loggerLogSpy).toHaveBeenCalledWith({
        message: 'Handler registered for topic',
        topic: TEST_TOPIC,
        method: 'registerHandler',
      });
    });

    it('should do nothing if no providers are discovered', () => {
      handlerRegistry.onModuleInit();
      expect(handlerRegistry.getRegisteredTopics()).toHaveLength(0);
    });

    it('should do nothing if provider instance is undefined', () => {
      const wrapper: InstanceWrapper<any> = {
        instance: null,
      } as InstanceWrapper<any>;
      discoveryService.addProvider(wrapper);

      handlerRegistry.onModuleInit();
      expect(handlerRegistry.getRegisteredTopics()).toHaveLength(0);
    });

    it('should do nothing if provider constructor is not a function', () => {
      const instance = { constructor: undefined };
      const wrapper: InstanceWrapper<any> = {
        instance,
      } as InstanceWrapper<any>;
      discoveryService.addProvider(wrapper);

      handlerRegistry.onModuleInit();
      expect(handlerRegistry.getRegisteredTopics()).toHaveLength(0);
    });
  });

  describe('registerHandler and getHandler', () => {
    it('should register and retrieve a handler', () => {
      const dummyHandler = jest.fn();
      handlerRegistry.registerHandler(TEST_TOPIC, dummyHandler);
      const retrieved = handlerRegistry.getHandler(TEST_TOPIC);
      expect(retrieved).toBe(dummyHandler);
    });
  });

  describe('getRegisteredTopics', () => {
    it('should return registered topics', () => {
      const dummyHandler = jest.fn();
      handlerRegistry.registerHandler(TEST_TOPIC, dummyHandler);
      const topics = handlerRegistry.getRegisteredTopics();
      expect(topics).toEqual([TEST_TOPIC]);
    });
  });

  describe('handle', () => {
    const validMessageObj = { foo: 'bar' };
    const validMessageValue = JSON.stringify(validMessageObj);
    const invalidMessageValue = 'invalid json';
    const messageKey = 'key1';

    beforeEach(() => {
      // Clear any previously registered handlers.
      (handlerRegistry as any).handlers.clear();
    });

    it('should call the registered handler with parsed messages', async () => {
      const handlerMock = jest.fn().mockResolvedValue(undefined);
      handlerRegistry.registerHandler(TEST_TOPIC, handlerMock);
      const messages: KafkaMessage[] = [
        {
          key: messageKey,
          value: Buffer.from(validMessageValue),
        } as unknown as KafkaMessage,
      ];
      await handlerRegistry.handle(TEST_TOPIC, messages);
      expect(handlerMock).toHaveBeenCalledWith([validMessageObj]);
    });

    it('should filter out messages with null value and log an error', async () => {
      const handlerMock = jest.fn().mockResolvedValue(undefined);
      handlerRegistry.registerHandler(TEST_TOPIC, handlerMock);
      const messages: KafkaMessage[] = [
        { key: messageKey, value: null } as unknown as KafkaMessage,
        {
          key: messageKey,
          value: Buffer.from(validMessageValue),
        } as unknown as KafkaMessage,
      ];
      await handlerRegistry.handle(TEST_TOPIC, messages);
      expect(handlerMock).toHaveBeenCalledWith([validMessageObj]);
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should filter out messages that fail JSON parsing and log an error', async () => {
      const handlerMock = jest.fn().mockResolvedValue(undefined);
      handlerRegistry.registerHandler(TEST_TOPIC, handlerMock);
      const messages: KafkaMessage[] = [
        {
          key: messageKey,
          value: Buffer.from(invalidMessageValue),
        } as unknown as KafkaMessage,
      ];
      await handlerRegistry.handle(TEST_TOPIC, messages);
      expect(handlerMock).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalled();
    });

    it('should log when no handler is found for the topic', async () => {
      await handlerRegistry.handle(
        'UNKNOWN_TOPIC' as keyof KAFKA_TOPIC_MESSAGE,
        [],
      );
      expect(loggerLogSpy).toHaveBeenCalledWith({
        message: 'No handler found for topic',
        topic: 'UNKNOWN_TOPIC',
        method: 'handle',
      });
    });
  });
});
