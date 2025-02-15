import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { config } from '@config';
import { AppModule } from './app.module';
import { NewRelicInterceptor } from './newrelic.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(Logger);
  app.useLogger(logger);

  app.enableShutdownHooks();
  app.useGlobalInterceptors(new NewRelicInterceptor());

  app.listen(config().port).catch((error: Error) => {
    logger.error({
      message: 'Error starting application',
      method: bootstrap.name,
      error: error.stack,
    });
    process.exit(1);
  });

  await app.startAllMicroservices();

  ['SIGTERM', 'SIGINT', 'SIGUSR2'].forEach((signal) => {
    process.once(signal, () => {
      logger.log({
        message: 'Received signal, shutting down gracefully',
        signal,
        method: bootstrap.name,
      });
      void (async () => {
        await app.close();
        process.kill(process.pid, signal);
      })();
    });
  });
}

void bootstrap();
