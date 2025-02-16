import { Module } from '@nestjs/common';
import { ConfigModule } from '@config';
import { HealthModule } from '@health/health.module';
import { LoggerModule } from '@logger';
import { KafkaModule } from './kafka/kafka.module';
import { AppService } from './app.service';

@Module({
  imports: [ConfigModule, LoggerModule, HealthModule, KafkaModule],
  providers: [AppService],
})
export class AppModule {}
