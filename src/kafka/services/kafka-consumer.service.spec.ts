// kafka.consumer.service.spec.ts
import { KafkaConsumerService } from './kafka-consumer.service';
import { ConfigService } from '@nestjs/config';
import { HandlerRegistry } from './handler-registry.service';
import {
  EachBatchPayload,
  KafkaMessage,
  Kafka,
  logLevel,
  Offsets,
  OffsetsByTopicPartition,
} from 'kafkajs';
import { KAFKA_TOPIC_MESSAGE } from '@kafka/interfaces';

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;
  let fakeConfigService: Partial<ConfigService>;
  let fakeHandlerRegistry: Partial<HandlerRegistry>;
  let fakeConsumer: any;
  let kafkaConsumerSpy: jest.SpyInstance;
  const fakeTopics = ['TOPIC1', 'TOPIC2'];
  const registeredTopics = ['TOPIC1'];

  beforeEach(() => {
    // Create a fake config service.
    fakeConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          'kafka.clientId': 'client-id',
          'kafka.brokers': ['broker:9092'],
          'kafka.groupId': 'group-id',
          'kafka.heartbeatInterval': 3000,
          'kafka.sessionTimeout': 30000,
          'kafka.topics': fakeTopics,
        };
        return config[key];
      }),
    };

    // Fake HandlerRegistry: getRegisteredTopics returns registeredTopics; handle is a stub.
    fakeHandlerRegistry = {
      getRegisteredTopics: jest.fn(
        (): (keyof KAFKA_TOPIC_MESSAGE)[] =>
          registeredTopics as (keyof KAFKA_TOPIC_MESSAGE)[],
      ),
      handle: jest.fn().mockResolvedValue(undefined),
    };

    // Create a fake consumer with stubbed methods.
    fakeConsumer = {
      events: { CRASH: 'crash', REQUEST_TIMEOUT: 'request_timeout' },
      on: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
      subscribe: jest.fn().mockResolvedValue(undefined),
      connect: jest.fn().mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
    };

    // Spy on Kafka.prototype.consumer to return our fakeConsumer.
    kafkaConsumerSpy = jest
      .spyOn(Kafka.prototype, 'consumer')
      .mockReturnValue(fakeConsumer);

    // Now instantiate the service. The constructor will call handleConsumerEvents().
    service = new KafkaConsumerService(
      fakeConfigService as ConfigService,
      fakeHandlerRegistry as HandlerRegistry,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    kafkaConsumerSpy.mockRestore();
  });

  describe('handleConsumerEvents', () => {
    it('should register event handlers for CRASH and REQUEST_TIMEOUT', () => {
      // In constructor, handleConsumerEvents is invoked.
      expect(fakeConsumer.on).toHaveBeenCalledTimes(2);
      expect(fakeConsumer.on).toHaveBeenCalledWith(
        'crash',
        expect.any(Function),
      );
      expect(fakeConsumer.on).toHaveBeenCalledWith(
        'request_timeout',
        expect.any(Function),
      );
    });

    it('should handle CRASH event by disconnecting and reinitializing', async () => {
      const initSpy = jest
        .spyOn<any, any>(service, 'init')
        .mockResolvedValue(undefined);
      // Extract the crash callback.
      const crashCall = (fakeConsumer.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'crash',
      );
      expect(crashCall).toBeDefined();
      const crashCallback = crashCall[1];
      const crashEvent = { error: 'crash error' };
      await crashCallback(crashEvent);
      expect(fakeConsumer.disconnect).toHaveBeenCalled();
      expect(initSpy).toHaveBeenCalled();
    });

    it('should handle REQUEST_TIMEOUT event by disconnecting and reinitializing', async () => {
      const initSpy = jest
        .spyOn<any, any>(service, 'init')
        .mockResolvedValue(undefined);
      const timeoutCall = (fakeConsumer.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'request_timeout',
      );
      expect(timeoutCall).toBeDefined();
      const timeoutCallback = timeoutCall[1];
      const timeoutEvent = { error: 'timeout error' };
      await timeoutCallback(timeoutEvent);
      expect(fakeConsumer.disconnect).toHaveBeenCalled();
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('getTopics', () => {
    it('should return only topics with registered handlers', () => {
      // Config returns fakeTopics: ['TOPIC1', 'TOPIC2']
      // HandlerRegistry returns registeredTopics: ['TOPIC1']
      const topics = (service as any).getTopics();
      expect(topics).toEqual(['TOPIC1']);
    });

    it('should log and use registered topics if config topics are empty', () => {
      (fakeConfigService.get as jest.Mock).mockImplementation((key: string) => {
        const config: Record<string, any> = {
          'kafka.clientId': 'client-id',
          'kafka.brokers': ['broker:9092'],
          'kafka.groupId': 'group-id',
          'kafka.heartbeatInterval': 3000,
          'kafka.sessionTimeout': 30000,
          'kafka.topics': [],
        };
        return config[key];
      });
      const topics = (service as any).getTopics();
      expect(topics).toEqual(registeredTopics);
    });

    it('should warn and disconnect if no topics are available', async () => {
      (fakeConfigService.get as jest.Mock).mockImplementation((key: string) => {
        const config: Record<string, any> = {
          'kafka.clientId': 'client-id',
          'kafka.brokers': ['broker:9092'],
          'kafka.groupId': 'group-id',
          'kafka.heartbeatInterval': 3000,
          'kafka.sessionTimeout': 30000,
          'kafka.topics': [],
        };
        return config[key];
      });
      (fakeHandlerRegistry.getRegisteredTopics as jest.Mock).mockReturnValue(
        [],
      );
      const topics = (service as any).getTopics();
      expect(topics).toEqual([]);
      // Wait for the async disconnect triggered by getTopics().
      await Promise.resolve();
      expect(fakeConsumer.disconnect).toHaveBeenCalled();
    });
  });

  describe('subscribeToTopics', () => {
    it('should subscribe to topics if available', async () => {
      // getTopics() returns ['TOPIC1'] based on our fakeHandlerRegistry.
      await (service as any).subscribeToTopics();
      expect(fakeConsumer.subscribe).toHaveBeenCalledWith({
        topics: ['TOPIC1'],
      });
    });

    it('should warn if no valid topics to subscribe to', async () => {
      // Force getTopics() to return an empty array.
      (fakeConfigService.get as jest.Mock).mockImplementation((key: string) => {
        const config: Record<string, any> = {
          'kafka.clientId': 'client-id',
          'kafka.brokers': ['broker:9092'],
          'kafka.groupId': 'group-id',
          'kafka.heartbeatInterval': 3000,
          'kafka.sessionTimeout': 30000,
          'kafka.topics': [],
        };
        return config[key];
      });
      (fakeHandlerRegistry.getRegisteredTopics as jest.Mock).mockReturnValue(
        [],
      );
      await (service as any).subscribeToTopics();
      expect(fakeConsumer.subscribe).not.toHaveBeenCalled();
    });
  });

  describe('run', () => {
    it('should run the consumer with an eachBatch callback that calls handlerRegistry.handle', async () => {
      let capturedCallback: any;
      (fakeConsumer.run as jest.Mock).mockImplementation(async (opts: any) => {
        capturedCallback = opts.eachBatch;
      });
      await (service as any).run();
      expect(fakeConsumer.run).toHaveBeenCalled();
      // Create a fake EachBatchPayload.
      const fakeBatchPayload: EachBatchPayload = {
        batch: {
          topic: 'TOPIC1',
          messages: [
            {
              key: Buffer.from('key1'),
              value: Buffer.from(JSON.stringify({ foo: 'bar' })),
              timestamp: new Date().toISOString(),
              attributes: 0,
              offset: '0',
              headers: {},
            },
          ],
          partition: 0,
          highWatermark: '',
          isEmpty: function (): boolean {
            throw new Error('Function not implemented.');
          },
          firstOffset: function (): string | null {
            throw new Error('Function not implemented.');
          },
          lastOffset: function (): string {
            throw new Error('Function not implemented.');
          },
          offsetLag: function (): string {
            throw new Error('Function not implemented.');
          },
          offsetLagLow: function (): string {
            throw new Error('Function not implemented.');
          },
        },
        resolveOffset: jest.fn(),
        heartbeat: jest.fn(),
        pause: jest.fn(),
        commitOffsetsIfNecessary: function (offsets?: Offsets): Promise<void> {
          throw new Error('Function not implemented.');
        },
        uncommittedOffsets: function (): OffsetsByTopicPartition {
          throw new Error('Function not implemented.');
        },
        isRunning: function (): boolean {
          throw new Error('Function not implemented.');
        },
        isStale: function (): boolean {
          throw new Error('Function not implemented.');
        },
      };
      await capturedCallback(fakeBatchPayload);
      expect(fakeHandlerRegistry.handle).toHaveBeenCalledWith(
        'TOPIC1',
        fakeBatchPayload.batch.messages,
      );
    });
  });

  describe('init', () => {
    it('should connect, subscribe and run the consumer', async () => {
      const subscribeSpy = jest
        .spyOn<any, any>(service, 'subscribeToTopics')
        .mockResolvedValue(undefined);
      const runSpy = jest
        .spyOn<any, any>(service, 'run')
        .mockResolvedValue(undefined);
      await (service as any).init();
      expect(fakeConsumer.connect).toHaveBeenCalled();
      expect(subscribeSpy).toHaveBeenCalled();
      expect(runSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should call init', async () => {
      const initSpy = jest
        .spyOn<any, any>(service, 'init')
        .mockResolvedValue(undefined);
      await service.onModuleInit();
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect the consumer and log a message', async () => {
      await service.onModuleDestroy();
      expect(fakeConsumer.disconnect).toHaveBeenCalled();
    });
  });
});
