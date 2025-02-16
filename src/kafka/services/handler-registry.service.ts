import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { KafkaMessage } from 'kafkajs';
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper';
import { MESSAGE_HANDLER_METADATA_KEY } from '@kafka/decorators';
import { KAFKA_TOPIC_MESSAGE } from '@kafka/interfaces';

type HandlerFunction<T extends keyof KAFKA_TOPIC_MESSAGE> = (
  messages: KAFKA_TOPIC_MESSAGE[T][],
) => Promise<void> | void;

export interface HandlerEntry<T extends keyof KAFKA_TOPIC_MESSAGE> {
  topic: T;
  handler: HandlerFunction<T>;
}

@Injectable()
export class HandlerRegistry implements OnModuleInit {
  private handlers = new Map<
    keyof KAFKA_TOPIC_MESSAGE,
    HandlerFunction<keyof KAFKA_TOPIC_MESSAGE>
  >();
  private readonly logger = new Logger(HandlerRegistry.name);

  constructor(private readonly discoveryService: DiscoveryService) {}

  onModuleInit(): void {
    // Explicitly type the providers returned from DiscoveryService.
    const providers: InstanceWrapper<any>[] =
      this.discoveryService.getProviders();
    providers.forEach((wrapper: InstanceWrapper<any>) => {
      const instance = wrapper.instance as InstanceWrapper<any>;
      if (!instance) return;
      const ctor = instance.constructor;
      if (typeof ctor !== 'function') return;
      // Retrieve metadata with a type assertion.
      const handlers = Reflect.getMetadata(
        MESSAGE_HANDLER_METADATA_KEY,
        ctor as object,
      ) as HandlerEntry<keyof KAFKA_TOPIC_MESSAGE>[] | undefined;
      if (handlers) {
        handlers.forEach(
          ({ topic, handler }: HandlerEntry<keyof KAFKA_TOPIC_MESSAGE>) => {
            // Bind the method to its instance and register it.
            const boundHandler = handler.bind(instance) as HandlerFunction<
              typeof topic
            >;
            this.registerHandler(topic, boundHandler);
          },
        );
      }
    });
  }

  registerHandler<T extends keyof KAFKA_TOPIC_MESSAGE>(
    topic: T,
    handler: HandlerFunction<T>,
  ): void {
    this.handlers.set(
      topic,
      handler as HandlerFunction<keyof KAFKA_TOPIC_MESSAGE>,
    );
    this.logger.log({
      message: 'Handler registered for topic',
      topic,
      method: this.registerHandler.name,
    });
  }

  getHandler<T extends keyof KAFKA_TOPIC_MESSAGE>(
    topic: T,
  ): HandlerFunction<T> | undefined {
    return this.handlers.get(topic) as HandlerFunction<T> | undefined;
  }

  getRegisteredTopics(): (keyof KAFKA_TOPIC_MESSAGE)[] {
    return Array.from(this.handlers.keys());
  }

  async handle<T extends keyof KAFKA_TOPIC_MESSAGE>(
    topic: T,
    messages: KafkaMessage[],
  ): Promise<void> {
    const handler = this.getHandler(topic);
    if (handler) {
      const parsedMessages = messages
        .map((message: KafkaMessage) => {
          try {
            if (message.value === null) {
              this.logger.error({
                message: 'message.value is null for a message in topic',
                imei: message.key?.toString(),
                topic,
                method: this.handle.name,
              });
              return null;
            }
            return JSON.parse(
              message.value.toString(),
            ) as KAFKA_TOPIC_MESSAGE[T];
          } catch (error: unknown) {
            this.logger.error({
              message: 'Error parsing message for topic',
              imei: message.key?.toString(),
              topic,
              method: this.handle.name,
              error: (error as Error).stack,
            });
            return null;
          }
        })
        .filter((msg): msg is KAFKA_TOPIC_MESSAGE[T] => msg !== null);

      if (parsedMessages.length > 0) {
        await handler(parsedMessages);
      }

      return;
    }

    this.logger.log({
      message: 'No handler found for topic',
      topic,
      method: this.handle.name,
    });
  }
}
