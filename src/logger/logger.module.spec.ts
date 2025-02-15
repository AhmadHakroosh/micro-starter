import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { LoggerModule } from './logger.module';
import { createLoggerOptions } from './logger.options';
import { IncomingMessage } from 'http';

interface PinoHttpOptions {
  name: string;
  level: string;
  redact: string[];
  autoLogging: boolean;
  transport?: { target: string; options: { colorize: boolean } } | undefined;
  genReqId: (req: {
    headers: Record<string, string | string[] | undefined>;
  }) => string;
  customAttributeKeys: {
    req: string;
    res: string;
    err: string;
    responseTime: string;
  };
  customProps: (req: IncomingMessage) => Record<string, unknown>;
  serializers: {
    req: (req: unknown) => unknown;
  };
}

interface LoggerOptions {
  pinoHttp: PinoHttpOptions;
}

describe('LoggerModule', () => {
  let moduleRef: TestingModule;
  let configService: ConfigService;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        // Provide dummy configuration values.
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              name: 'test-app',
              'logger.level': 'debug',
              nodeEnv: 'development',
            }),
          ],
        }),
        LoggerModule,
      ],
    }).compile();

    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  it('should compile the LoggerModule', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should provide PinoLogger and custom token "Logger"', async () => {
    const pinoLogger = await moduleRef.resolve(PinoLogger);
    expect(pinoLogger).toBeDefined();

    const loggerAlias: PinoLogger = await moduleRef.resolve('Logger');
    expect(loggerAlias).toBeDefined();

    // Because PinoLogger is a scoped provider, these instances may not be ===.
    // We verify that they are deeply equivalent.
    expect(loggerAlias).toStrictEqual(pinoLogger);
  });

  it('should load configuration values correctly from ConfigService', () => {
    expect(configService.get<string>('name')).toBe('test-app');
    expect(configService.get<string>('logger.level')).toBe('debug');
    expect(configService.get<string>('nodeEnv')).toBe('development');
  });
});

describe('createLoggerOptions', () => {
  let fakeConfigService: Partial<ConfigService>;

  beforeEach(() => {
    fakeConfigService = {
      get: jest.fn((key: string) => {
        const values: Record<string, unknown> = {
          name: 'fake-app',
          'logger.level': 'info',
          nodeEnv: 'development',
        };
        return values[key];
      }),
    };
  });

  it('should return correct options for non-production environment', () => {
    const options = createLoggerOptions(
      fakeConfigService as ConfigService,
    ) as LoggerOptions;

    expect(options.pinoHttp.name).toBe('fake-app');
    expect(options.pinoHttp.level).toBe('info');
    expect(options.pinoHttp.redact).toEqual(['request.headers.authorization']);
    expect(options.pinoHttp.autoLogging).toBe(false);
    expect(options.pinoHttp.transport).toEqual({
      target: 'pino-pretty',
      options: { colorize: true },
    });
    expect(typeof options.pinoHttp.genReqId).toBe('function');
    expect(options.pinoHttp.customAttributeKeys).toEqual({
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'responseTime',
    });
    expect(typeof options.pinoHttp.customProps).toBe('function');
    expect(typeof options.pinoHttp.serializers.req).toBe('function');
  });

  it('should return correct options for production environment', () => {
    (fakeConfigService.get as jest.Mock).mockImplementation((key: string) => {
      const values: Record<string, unknown> = {
        name: 'fake-app',
        'logger.level': 'info',
        nodeEnv: 'production',
      };
      return values[key];
    });
    const options = createLoggerOptions(
      fakeConfigService as ConfigService,
    ) as LoggerOptions;
    expect(options.pinoHttp.transport).toBeUndefined();
  });

  describe('genReqId', () => {
    let options: LoggerOptions;
    beforeEach(() => {
      options = createLoggerOptions(
        fakeConfigService as ConfigService,
      ) as LoggerOptions;
    });

    it('should return first element if x-request-id is an array', () => {
      const req = { headers: { 'x-request-id': ['abc', 'def'] } };
      const id = options.pinoHttp.genReqId(req);
      expect(id).toBe('abc');
    });

    it('should return x-request-id if it is a string', () => {
      const req = { headers: { 'x-request-id': 'single-id' } };
      const id = options.pinoHttp.genReqId(req);
      expect(id).toBe('single-id');
    });

    it('should return empty string if x-request-id is not present', () => {
      const req = { headers: {} };
      const id = options.pinoHttp.genReqId(req);
      expect(id).toBe('');
    });
  });

  describe('customProps', () => {
    let options: LoggerOptions;
    beforeEach(() => {
      options = createLoggerOptions(
        fakeConfigService as ConfigService,
      ) as LoggerOptions;
    });

    interface FakeRequest extends IncomingMessage {
      id: string;
      body?: {
        imei?: string;
        imeis?: string[];
      };
    }

    it('should return custom properties from request', () => {
      const fakeReq: FakeRequest = {
        id: 'req123',
        headers: {},
        socket: {},
        body: {
          imei: 'imei123',
          imeis: ['imei1', 'imei2'],
        },
      } as FakeRequest;
      const props = options.pinoHttp.customProps(fakeReq);
      expect(props).toEqual({
        requestId: 'req123',
        imei: 'imei123',
        imeis: ['imei1', 'imei2'],
      });
    });

    it('should return only requestId if body is not present', () => {
      const fakeReq: FakeRequest = {
        id: 'req123',
        headers: {},
        socket: {},
      } as FakeRequest;
      const props = options.pinoHttp.customProps(fakeReq);
      expect(props).toEqual({
        requestId: 'req123',
      });
    });
  });

  describe('serializers.req', () => {
    let options: LoggerOptions;
    beforeEach(() => {
      options = createLoggerOptions(
        fakeConfigService as ConfigService,
      ) as LoggerOptions;
    });

    interface FakeReq {
      raw: { body?: { imei?: string; imeis?: string[] } } & Record<
        string,
        unknown
      >;
      imei?: string;
      imeis?: string[];
    }

    it('should attach imei and imeis if present in req.raw.body', () => {
      const fakeReq: FakeReq = {
        raw: {
          body: {
            imei: 'imeiValue',
            imeis: ['imeiValue1', 'imeiValue2'],
          },
        },
      };
      const result = options.pinoHttp.serializers.req(fakeReq) as FakeReq;
      expect(result.imei).toBe('imeiValue');
      expect(result.imeis).toEqual(['imeiValue1', 'imeiValue2']);
    });

    it('should not modify req if no matching keys in req.raw', () => {
      const fakeReq: FakeReq = {
        raw: {
          other: 'data',
        },
      };
      const result = options.pinoHttp.serializers.req(fakeReq);
      expect(result).toEqual(fakeReq);
    });
  });
});
