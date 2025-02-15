import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { LoggerModule } from './logger.module';
import { createLoggerOptions } from './logger.options';
import { IncomingMessage } from 'http';

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

    const loggerAlias = await moduleRef.resolve('Logger');
    expect(loggerAlias).toBeDefined();

    // Because PinoLogger is a scoped provider, these instances may not be ===.
    // We verify they are deeply equivalent.
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
        const values = {
          name: 'fake-app',
          'logger.level': 'info',
          nodeEnv: 'development',
        };
        return values[key];
      }),
    };
  });

  it('should return correct options for non-production environment', () => {
    const options = createLoggerOptions(fakeConfigService as ConfigService);
    const pinoHttp = options.pinoHttp as any;
    expect(pinoHttp.name).toBe('fake-app');
    expect(pinoHttp.level).toBe('info');
    expect(pinoHttp.redact).toEqual(['request.headers.authorization']);
    expect(pinoHttp.autoLogging).toBe(false);
    expect(pinoHttp.transport).toEqual({ target: 'pino-pretty', options: { colorize: true } });
    expect(typeof pinoHttp.genReqId).toBe('function');
    expect(pinoHttp.customAttributeKeys).toEqual({
      req: 'request',
      res: 'response',
      err: 'error',
      responseTime: 'responseTime',
    });
    expect(typeof pinoHttp.customProps).toBe('function');
    expect(typeof pinoHttp.serializers.req).toBe('function');
  });

  it('should return correct options for production environment', () => {
    (fakeConfigService.get as jest.Mock).mockImplementation((key: string) => {
      const values = {
        name: 'fake-app',
        'logger.level': 'info',
        nodeEnv: 'production',
      };
      return values[key];
    });
    const options = createLoggerOptions(fakeConfigService as ConfigService) as any;
    expect(options.pinoHttp.transport).toBeUndefined();
  });

  describe('genReqId', () => {
    let options: ReturnType<typeof createLoggerOptions> | any;
    beforeEach(() => {
      options = createLoggerOptions(fakeConfigService as ConfigService);
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

  describe('reqCustomProps', () => {
    let options: ReturnType<typeof createLoggerOptions> | any;
    beforeEach(() => {
      options = createLoggerOptions(fakeConfigService as ConfigService);
    });

    it('should return custom properties from request', () => {
      const fakeReq = {
        id: 'req123',
        body: {
          imei: 'imei123',
          imeis: ['imei1', 'imei2'],
        },
      } as unknown as IncomingMessage;
      const props = options.pinoHttp.customProps(fakeReq);
      expect(props).toEqual({
        requestId: 'req123',
        imei: 'imei123',
        imeis: ['imei1', 'imei2'],
      });
    });
  });

  describe('serializers.req', () => {
    let options: ReturnType<typeof createLoggerOptions> | any;
    beforeEach(() => {
      options = createLoggerOptions(fakeConfigService as ConfigService);
    });

    it('should attach imei and imeis if present in req.raw.body', () => {
      const fakeReq = {
        raw: {
          body: {
            imei: 'imeiValue',
            imeis: ['imeiValue1', 'imeiValue2'],
          },
        },
      };
      const result = options.pinoHttp.serializers.req(fakeReq);
      expect(result.imei).toBe('imeiValue');
      expect(result.imeis).toEqual(['imeiValue1', 'imeiValue2']);
    });

    it('should not modify req if no matching keys in req.raw', () => {
      const fakeReq = {
        raw: {
          other: 'data',
        },
      };
      const result = options.pinoHttp.serializers.req(fakeReq);
      // Since no "body" key exists, the result should be identical.
      expect(result).toEqual(fakeReq);
    });
  });
});