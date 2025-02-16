import {
  KAFKA_TOPIC_MESSAGE_SCHEMA,
  KAFKA_TOPIC_MESSAGE,
} from '@kafka/interfaces/topics.interface';
import { Logger } from '@nestjs/common';
import { Schema } from 'joi';

export function ValidateSchema<
  T extends keyof KAFKA_TOPIC_MESSAGE_SCHEMA,
  M extends KAFKA_TOPIC_MESSAGE[T],
  R = unknown,
>(schema: Schema) {
  const logger = new Logger(ValidateSchema.name);

  return function (
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(messages: M[]) => Promise<R>>,
  ) {
    const originalMethod = descriptor.value;

    if (!originalMethod) {
      throw new Error('Descriptor value is undefined.');
    }

    descriptor.value = async function (messages: M[]): Promise<R> {
      if (!Array.isArray(messages)) {
        throw new Error('Expected an array of messages as the first argument.');
      }

      const validMessages: M[] = messages.reduce<M[]>((valid, message) => {
        const { error, value } = schema.validate(message) as {
          error?: Error;
          value: M;
        };

        if (error) {
          logger.error({
            message: 'Invalid message schema',
            method: ValidateSchema.name,
            error: error.stack,
            kafkaMessage: message,
          });
        } else {
          valid.push(value);
        }
        return valid;
      }, []);

      return originalMethod.apply(this, [validMessages]) as Promise<R>;
    };

    return descriptor;
  };
}
