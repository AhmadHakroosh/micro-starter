// validate-schema.decorator.spec.ts
import * as Joi from 'joi';
import { ValidateSchema } from './validate-schema.decorator';
import { KAFKA_TOPIC, MESSAGE_SCHEMA } from '../interfaces/topics.interface';
import { Logger } from '@nestjs/common';

// Define a Joi schema that matches the expected message shape.
const testSchema = Joi.object({
  imei: Joi.string().required(),
  requestId: Joi.string().required(),
});

// Create a dummy class to test the decorator.
// Note: The method signature must match the expected type from your interfaces.
class DummyService {
  @ValidateSchema(testSchema)
  async processMessages(
    messages: { imei: string; requestId: string }[],
  ): Promise<{ imei: string; requestId: string }[]> {
    // Added a dummy await to satisfy the lint rule.
    await Promise.resolve();
    return messages;
  }
}

describe('ValidateSchema Decorator', () => {
  let dummy: DummyService;
  let loggerErrorSpy: jest.SpyInstance<
    void,
    [message: any, ...optionalParams: any[]]
  >;

  beforeEach(() => {
    dummy = new DummyService();
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  it('should throw error if the first argument is not an array', async () => {
    // Call processMessages with a non-array argument.
    await expect(
      dummy.processMessages(
        'not-an-array' as unknown as Array<{ imei: string; requestId: string }>,
      ),
    ).rejects.toThrow('Expected an array of messages as the first argument.');
  });

  it('should pass valid messages to the original method', async () => {
    const validMessages: { imei: string; requestId: string }[] = [
      { imei: 'abc123', requestId: 'req1' },
      { imei: 'def456', requestId: 'req2' },
    ];
    const result = await dummy.processMessages(validMessages);
    expect(result).toEqual(validMessages);
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('should drop invalid messages and log a warning', async () => {
    const validMessage: { imei: string; requestId: string } = {
      imei: 'abc123',
      requestId: 'req1',
    };
    const invalidMessage = { imei: 'xyz', requestId: 123 }; // Invalid because requestId is not a string.
    const messages: unknown[] = [validMessage, invalidMessage];
    const result = await dummy.processMessages(
      messages as { imei: string; requestId: string }[],
    );
    // Only the valid message should be passed to the original method.
    expect(result).toEqual([validMessage]);
    expect(loggerErrorSpy).toHaveBeenCalledWith({
      message: 'Invalid message schema',
      method: 'ValidateSchema',
      error: expect.stringContaining(
        'ValidationError: "requestId" must be a string',
      ) as unknown as Error,
      kafkaMessage: invalidMessage,
    });
  });

  it('should throw an error if applied to a method with an undefined descriptor', () => {
    const descriptor: TypedPropertyDescriptor<
      (messages: any[]) => Promise<any>
    > = {
      value: undefined as unknown as (messages: any[]) => Promise<any>,
    };

    expect(() => {
      ValidateSchema(MESSAGE_SCHEMA[KAFKA_TOPIC.DEVICE_STATUS_UPDATE])(
        {} as object,
        'invalidProperty',
        descriptor,
      );
    }).toThrow('Descriptor value is undefined.');
  });
});
