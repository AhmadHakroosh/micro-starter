import 'reflect-metadata';
import {
  MessageHandler,
  MESSAGE_HANDLER_METADATA_KEY,
} from './message-handler.decorator';
import { KAFKA_TOPIC_MESSAGE } from '../interfaces/topics.interface';

// Use a constant for the topic.
const testTopic: keyof KAFKA_TOPIC_MESSAGE =
  'TEST_TOPIC' as keyof KAFKA_TOPIC_MESSAGE;

describe('MessageHandler Decorator', () => {
  // Dummy service with a decorated method.
  class MockService {
    @MessageHandler(testTopic)
    handleMessage(this: void): void {} // annotate with `this: void`
  }

  it('should define metadata for the decorated method', () => {
    const metadata = Reflect.getMetadata(
      MESSAGE_HANDLER_METADATA_KEY,
      MockService,
    ) as
      | Array<{ topic: keyof KAFKA_TOPIC_MESSAGE; handler: () => void }>
      | undefined;
    expect(metadata).toBeDefined();

    const expectedHandler = MockService.prototype.handleMessage;
    expect(metadata).toEqual([
      {
        topic: testTopic,
        handler: expectedHandler,
      },
    ]);
  });

  it('should accumulate multiple handlers in metadata', () => {
    class AnotherMockService {
      @MessageHandler(testTopic)
      handleFirst(this: void): void {}

      @MessageHandler(testTopic)
      handleSecond(this: void): void {}
    }

    const metadata = Reflect.getMetadata(
      MESSAGE_HANDLER_METADATA_KEY,
      AnotherMockService,
    ) as
      | Array<{ topic: keyof KAFKA_TOPIC_MESSAGE; handler: () => void }>
      | undefined;
    expect(metadata).toHaveLength(2);

    expect(metadata && metadata[0].handler).toBe(
      AnotherMockService.prototype.handleFirst,
    );

    expect(metadata && metadata[1].handler).toBe(
      AnotherMockService.prototype.handleSecond,
    );
  });

  it('should throw an error if applied to a non-function property', () => {
    const descriptor: TypedPropertyDescriptor<() => void> = {
      value: 'not a function' as unknown as () => void,
    };
    expect(() => {
      MessageHandler(testTopic)({}, 'invalidProperty', descriptor);
    }).toThrow('MessageHandler can only be applied to methods.');
  });

  it('should return undefined if no handlers exist', () => {
    class NoHandlerService {}
    const metadata = Reflect.getMetadata(
      MESSAGE_HANDLER_METADATA_KEY,
      NoHandlerService,
    ) as
      | Array<{ topic: keyof KAFKA_TOPIC_MESSAGE; handler: () => void }>
      | undefined;
    expect(metadata).toBeUndefined();
  });
});
