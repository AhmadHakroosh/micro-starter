import 'reflect-metadata';
import { KAFKA_TOPIC_MESSAGE } from '@kafka/interfaces/topics.interface';

export const MESSAGE_HANDLER_METADATA_KEY = 'message-handlers';

export type MessageHandlerFunction<T extends keyof KAFKA_TOPIC_MESSAGE> = (
  messages: KAFKA_TOPIC_MESSAGE[T][],
) => Promise<void> | void;

export function MessageHandler<T extends keyof KAFKA_TOPIC_MESSAGE>(topic: T) {
  return function <U extends MessageHandlerFunction<T>>(
    target: object,
    propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<U>,
  ): void {
    if (typeof descriptor.value !== 'function') {
      throw new Error('MessageHandler can only be applied to methods.');
    }

    const constructor = (
      target as { constructor: new (...args: unknown[]) => unknown }
    ).constructor;

    const existingHandlers: Array<{
      topic: keyof KAFKA_TOPIC_MESSAGE;
      handler: U;
    }> =
      (Reflect.getMetadata(MESSAGE_HANDLER_METADATA_KEY, constructor) as
        | Array<{
            topic: keyof KAFKA_TOPIC_MESSAGE;
            handler: U;
          }>
        | undefined) || [];

    Reflect.defineMetadata(
      MESSAGE_HANDLER_METADATA_KEY,
      [
        ...existingHandlers,
        {
          topic,
          handler: descriptor.value,
        },
      ],
      constructor,
    );
  };
}
