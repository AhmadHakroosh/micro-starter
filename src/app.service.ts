import {
  KAFKA_TOPIC,
  KAFKA_TOPIC_MESSAGE,
  MESSAGE_SCHEMA,
  MessageHandler,
  ValidateSchema,
} from '@kafka';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  @MessageHandler(KAFKA_TOPIC.DEVICE_STATUS_UPDATE)
  @ValidateSchema(MESSAGE_SCHEMA[KAFKA_TOPIC.DEVICE_STATUS_UPDATE])
  async handleTopicA(
    messages: KAFKA_TOPIC_MESSAGE[KAFKA_TOPIC.DEVICE_STATUS_UPDATE][],
  ) {
    // Handle the messages for device status update
    this.logger.log({
      message: 'Handling messages',
      method: this.handleTopicA.name,
      messages,
    });

    await Promise.resolve();
  }
}
