// health.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthCheckService } from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get<HealthController>(HealthController);
    healthCheckService = moduleRef.get<HealthCheckService>(HealthCheckService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('check', () => {
    it('should call health.check with an empty array and return its result', async () => {
      const expectedResponse = { status: 'ok' };
      // Set up the mock to resolve with the expected response
      (healthCheckService.check as jest.Mock).mockResolvedValue(expectedResponse);

      // Call the controller method
      const result = await controller.check();

      // Verify the health.check method was called correctly and the expected response is returned
      expect(healthCheckService.check).toHaveBeenCalledWith([]);
      expect(result).toEqual(expectedResponse);
    });
  });
});