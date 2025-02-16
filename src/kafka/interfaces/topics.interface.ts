import * as Joi from 'joi';

// Define the Kafka topics that your application will use.
export enum KAFKA_TOPIC {
  DEVICE_STATUS_UPDATE = 'device.status.update.1',
}

export interface KAFKA_TOPIC_MESSAGE
  extends Record<KAFKA_TOPIC, Record<string, unknown>> {
  [KAFKA_TOPIC.DEVICE_STATUS_UPDATE]: {
    imei: string;
    requestId: string;
  };
}

// Define the schema for each Kafka topic.
export const MESSAGE_SCHEMA: Record<KAFKA_TOPIC, Joi.Schema> = {
  [KAFKA_TOPIC.DEVICE_STATUS_UPDATE]: Joi.object<
    KAFKA_TOPIC_MESSAGE[KAFKA_TOPIC.DEVICE_STATUS_UPDATE]
  >({
    imei: Joi.string().required(),
    requestId: Joi.string().required(),
  }),
};

// Define the schema for each Kafka topic.
export interface KAFKA_TOPIC_MESSAGE_SCHEMA {
  [KAFKA_TOPIC.DEVICE_STATUS_UPDATE]: Joi.ObjectSchema<
    KAFKA_TOPIC_MESSAGE[KAFKA_TOPIC.DEVICE_STATUS_UPDATE]
  >;
  // Add more topics here as needed.
}
