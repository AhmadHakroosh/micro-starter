import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import {
  KafkaProducerService,
  KafkaConsumerService,
  HandlerRegistry,
} from './services';

@Global()
@Module({
  imports: [ConfigModule, DiscoveryModule],
  providers: [KafkaProducerService, KafkaConsumerService, HandlerRegistry],
  exports: [KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule {}
