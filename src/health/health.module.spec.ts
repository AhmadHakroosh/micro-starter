import { Test, TestingModule } from '@nestjs/testing';
import { HealthModule } from './health.module';
import { HealthController } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';

describe('HealthModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
  });

  afterEach(async () => {
    await module?.close();
  });

  it('should compile the module successfully', () => {
    expect(module).toBeDefined();
  });

  it('should provide HealthController', () => {
    const controller = module.get<HealthController>(HealthController);
    expect(controller).toBeInstanceOf(HealthController);
  });

  it('should import TerminusModule', async () => {
    const importedModules = module.select(TerminusModule);
    expect(importedModules).toBeDefined();
  });
});
