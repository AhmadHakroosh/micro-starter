import { Global, Module } from '@nestjs/common';
import { PinoLogger, LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createLoggerOptions } from './logger.options';

@Global()
@Module({
  imports: [
    // Import the ConfigModule to use the ConfigService to get the logger configuration
    // and pass it to the PinoLoggerModule
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createLoggerOptions,
    }),
  ],
  // Create an alias for PinoLogger with the custom token 'Logger'
  providers: [
    {
      provide: 'Logger',
      useExisting: PinoLogger,
    },
  ],
  // Export both the nestjs-pino module and the custom token
  exports: [PinoLoggerModule, 'Logger'],
})
export class LoggerModule {}
