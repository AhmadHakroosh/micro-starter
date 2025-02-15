// app.module.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  it('should compile the module', () => {
    expect(moduleRef).toBeDefined();
  });

  it('should instantiate the AppModule', () => {
    const appModule = moduleRef.get<AppModule>(AppModule);
    expect(appModule).toBeDefined();
  });
});
