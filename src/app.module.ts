import { Module } from '@nestjs/common';
import { ConfigModule } from '@config';
import { HealthModule } from '@health/health.module';
import { LoggerModule } from '@logger';

@Module({
  imports: [
    ConfigModule,
    LoggerModule,
    HealthModule,
  ],
  providers: [],
})
export class AppModule {}
