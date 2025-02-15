import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { Params } from 'nestjs-pino';

// Define a custom interface to represent our enhanced request object.
interface CustomRequest extends IncomingMessage {
  id: string;
  body?: {
    imei?: string;
    imeis?: string[];
  };
  // These properties will be attached by our serializer.
  imei?: string;
  imeis?: string[];
}

export function createLoggerOptions(configService: ConfigService): Params {
  return {
    pinoHttp: {
      name: configService.get<string>('name'),
      level: configService.get<string>('logger.level'),
      redact: ['request.headers.authorization'],
      autoLogging: false,
      transport:
        configService.get<string>('nodeEnv') !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      genReqId: function (req: {
        headers: Record<string, string | string[] | undefined>;
      }): string {
        const requestId = req.headers['x-request-id'];
        if (Array.isArray(requestId)) {
          return requestId[0];
        }
        return requestId || '';
      },
      customAttributeKeys: {
        req: 'request',
        res: 'response',
        err: 'error',
        responseTime: 'responseTime',
      },
      customProps: (req: CustomRequest): Record<string, unknown> => {
        return {
          requestId: req.id,
          ...(req.body
            ? {
                imei: req.body.imei,
                imeis: req.body.imeis,
              }
            : {}),
        };
      },
      serializers: {
        req(
          req: CustomRequest & { raw: Record<string, unknown> },
        ): CustomRequest {
          Object.keys(req.raw).forEach((k: string) => {
            if (k.startsWith('body')) {
              // Cast req.raw['body'] to our expected shape.
              const body = req.raw['body'] as
                | { imei?: string; imeis?: string[] }
                | undefined;
              if (body && body.imei) {
                req.imei = body.imei;
              }
              if (body && body.imeis) {
                req.imeis = body.imeis;
              }
            }
          });
          return req;
        },
      },
    },
  };
}
