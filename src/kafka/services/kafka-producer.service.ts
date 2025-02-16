import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { KAFKA_TOPIC_MESSAGE, MESSAGE_SCHEMA } from '@kafka/interfaces';

interface MESSAGE_PAYLOAD<T extends keyof KAFKA_TOPIC_MESSAGE> {
  key: string;
  value: KAFKA_TOPIC_MESSAGE[T];
}

@Injectable()
export class KafkaProducerService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly logger = new Logger(KafkaProducerService.name);
  private kafka: Kafka;
  private producer: Producer;

  constructor(private readonly configService: ConfigService) {
    this.kafka = new Kafka({
      clientId: this.configService.get<string>('kafka.clientId')!,
      brokers: this.configService.get<string[]>('kafka.brokers')!,
      logLevel: logLevel.INFO,
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit(): Promise<void> {
    await this.producer.connect();
    this.logger.log('Kafka Producer connected', KafkaProducerService.name);
  }

  /**
   * Send a message (or messages) to a topic after validating each message against the provided Joi schema.
   *
   * @param topic - The Kafka topic to send the message(s) to.
   * @param messages - A message or an array of messages of type T.
   * @param schema - The Joi schema to validate each message.
   * @returns The result from Kafka.
   */
  async sendMessage<T extends keyof KAFKA_TOPIC_MESSAGE>(
    topic: T,
    messages: MESSAGE_PAYLOAD<T> | MESSAGE_PAYLOAD<T>[],
  ): Promise<any> {
    // Ensure we work with an array of messages.
    const msgsArray = Array.isArray(messages) ? messages : [messages];

    // Validate each message using the matching schema.
    const validMessages = msgsArray.filter((msg) => {
      const { error } = MESSAGE_SCHEMA[topic].validate(msg.value, {
        abortEarly: false,
      });
      if (error) {
        this.logger.error({
          message: 'Invalid message schema',
          method: this.sendMessage.name,
          error: error.stack,
          kafkaMessage: msg,
        });
        return false;
      }
      return true;
    });

    // Construct the payload.
    const payload = validMessages.map(({ key, value }) => ({
      key,
      value: JSON.stringify(value),
    }));

    try {
      const result = await this.producer.send({ topic, messages: payload });
      this.logger.log({
        message: 'Message sent to Kafka successfully',
        method: this.sendMessage.name,
        topic,
        kafkaMessage: payload,
      });
      return result;
    } catch (err: unknown) {
      this.logger.error({
        message: 'Error sending message to Kafka',
        method: this.sendMessage.name,
        error: (err as Error).stack,
        kafkaMessage: payload,
      });
      throw err;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.producer.disconnect();
    this.logger.log('Kafka Producer disconnected', KafkaProducerService.name);
  }
}
