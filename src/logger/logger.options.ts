import { ConfigService } from '@nestjs/config';
import { IncomingMessage } from 'http';
import { Params } from 'nestjs-pino';

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
      genReqId: function (req) {
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
      customProps: (req: IncomingMessage, _res: any) => {
        return {
          requestId: req.id,
          ...(req['body'] && {
            imei: req['body']['imei'],
            imeis: req['body']['imeis'],
          })
        };
      },
      serializers: {
        req(req) {
          Object.keys(req.raw).forEach((k) => {
            if (k.startsWith('body')) {
              const body = req.raw['body'];
              if (body && body['imei']) req['imei'] = body['imei'];
              if (body && body['imeis']) req['imeis'] = body['imeis'];
            }
          });
          return req;
        },
      },
    },
  };
}
