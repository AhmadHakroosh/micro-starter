// config.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { config, ENV_SCHEMA } from './config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [config],
      validationSchema: ENV_SCHEMA,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
