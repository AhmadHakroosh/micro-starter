import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Kafka, Consumer, EachBatchPayload, logLevel } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { KAFKA_TOPIC_MESSAGE } from '@kafka/interfaces';
import { HandlerRegistry } from './handler-registry.service';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private kafka: Kafka;
  private consumer: Consumer;

  constructor(
    private readonly configService: ConfigService,
    private readonly handlerRegistry: HandlerRegistry,
  ) {
    this.kafka = new Kafka({
      clientId: this.configService.get<string>('kafka.clientId')!,
      brokers: this.configService.get<string[]>('kafka.brokers')!,
      logLevel: logLevel.INFO,
    });

    this.consumer = this.kafka.consumer({
      groupId: this.configService.get<string>('kafka.groupId')!,
      heartbeatInterval: this.configService.get<number>(
        'kafka.heartbeatInterval',
      ),
      sessionTimeout: this.configService.get<number>('kafka.sessionTimeout'),
    });

    this.handleConsumerEvents();
  }

  /**
   * Handle consumer events, such as crashes and request timeouts.
   */
  private handleConsumerEvents() {
    this.consumer.on(this.consumer.events.CRASH, (event) => {
      void (async () => {
        this.logger.error({
          message: 'Consumer crashed, reconnecting...',
          event,
          method: this.handleConsumerEvents.name,
        });
        await this.consumer.disconnect();
        await this.init();
      })();
    });

    this.consumer.on(this.consumer.events.REQUEST_TIMEOUT, (event) => {
      void (async () => {
        this.logger.log({
          message: 'Request to broker timed out, reconnecting...',
          event,
          method: this.handleConsumerEvents.name,
        });
        await this.consumer.disconnect();
        await this.init();
      })();
    });
  }

  /**
   * Get the topics to subscribe to, filtering out any topics that do not have a registered handler.
   *
   * @returns An array of topics to subscribe to.
   */
  private getTopics() {
    const topics =
      this.configService.get<(keyof KAFKA_TOPIC_MESSAGE)[]>('kafka.topics')!;

    if (topics.length === 0) {
      this.logger.log({
        message: 'No topics configured in environment variables',
        method: this.getTopics.name,
      });

      this.logger.log({
        message: 'Using registered topics',
        topics: this.handlerRegistry.getRegisteredTopics(),
        method: this.getTopics.name,
      });

      topics.push(...this.handlerRegistry.getRegisteredTopics());
    }

    if (topics.length === 0) {
      this.logger.warn({
        message:
          'No topics to subscribe to, and no handlers registered, disconnecting consumer',
        method: this.getTopics.name,
      });

      void (async () => {
        await this.consumer.disconnect();
      })();
    }

    return topics.filter((topic) => {
      const isValid = this.handlerRegistry
        .getRegisteredTopics()
        .includes(topic);

      if (!isValid) {
        this.logger.warn({
          message: 'No handler registered for topic',
          topic,
          method: this.getTopics.name,
        });
      }

      return isValid;
    });
  }

  /**
   * Subscribe to the configured topics.
   */
  private async subscribeToTopics() {
    const topics = this.getTopics();

    if (topics.length === 0) {
      this.logger.warn({
        message: 'No valid topics to subscribe to',
        method: this.subscribeToTopics.name,
      });
      return;
    }

    this.logger.log({
      message: 'Subscribing to topics',
      topics,
      method: this.subscribeToTopics.name,
    });

    await this.consumer.subscribe({ topics });
  }

  /**
   * Run the consumer, handling each batch of messages.
   */
  private async run() {
    await this.consumer.run({
      eachBatch: async ({ batch: { topic, messages } }: EachBatchPayload) =>
        await this.handlerRegistry.handle(
          topic as keyof KAFKA_TOPIC_MESSAGE,
          messages,
        ),
    });
  }

  /**
   * Initialize the consumer by connecting to the Kafka broker, subscribing to topics, and running the consumer.
   */
  private async init() {
    await this.consumer.connect();
    await this.subscribeToTopics();
    await this.run();
  }

  async onModuleInit() {
    await this.init();
  }

  async onModuleDestroy() {
    this.logger.log({
      message: 'Disconnecting consumer',
      method: this.onModuleDestroy.name,
    });
    await this.consumer.disconnect();
  }
}
