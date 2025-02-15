import { NestFactory } from '@nestjs/core';
import { Logger, PinoLogger } from 'nestjs-pino';

// Mocks for external modules
jest.mock('./app.module', () => ({
  AppModule: jest.fn(),
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    createMicroservice: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('nestjs-pino', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
  })),
  PinoLogger: jest.fn().mockImplementation(() => ({
    error: jest.fn(),
  })),
  LoggerModule: {
    forRoot: jest.fn().mockReturnValue({}),
  },
}));

describe('bootstrap (main.ts)', () => {
  let mockApp: {
    listen: jest.Mock;
    get: jest.Mock;
    close: jest.Mock;
    enableShutdownHooks: jest.Mock;
    startAllMicroservices: jest.Mock;
    useGlobalInterceptors: jest.Mock;
    useLogger: jest.Mock;
  };
  let loggerMock: any;
  let killSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create a fake logger instance.
    loggerMock = { error: jest.fn(), log: jest.fn() };

    // Create a fake microservice app that implements all expected methods.
    mockApp = {
      listen: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockReturnValue(loggerMock),
      close: jest.fn().mockResolvedValue(undefined),
      enableShutdownHooks: jest.fn(),
      startAllMicroservices: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useLogger: jest.fn(),
    };

    // Ensure that NestFactory.createMicroservice returns our fake app.
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    // Override process.exit to throw an error so we can test its invocation without actually exiting.
    killSpy = jest
      .spyOn(process, 'kill')
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    // Remove any signal listeners added during bootstrap.
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGUSR2');
    killSpy.mockRestore();
  });

  it('should create a microservice and start listening', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    expect(NestFactory.create).toHaveBeenCalled();
    expect(mockApp.enableShutdownHooks).toHaveBeenCalled();
    expect(mockApp.listen).toHaveBeenCalled();
  });

  it('should log an error and exit if listen fails', async () => {
    const error = new Error('Startup failure');
    mockApp.listen.mockRejectedValueOnce(error);

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    await jest.isolateModulesAsync(async () => {
      await import('./main');
    });

    await new Promise(process.nextTick);

    expect(loggerMock.error).toHaveBeenCalledWith({
      message: 'Error starting application',
      method: 'bootstrap',
      error: error.stack,
    });

    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  describe('process signal handling', () => {
    beforeEach(async () => {
      // Isolate modules so that main.ts is freshly executed.
      await jest.isolateModulesAsync(async () => {
        await import('./main');
      });
      // Clear calls so that our tests can verify the effects of signals.
      mockApp.close.mockClear();
    });

    it('should gracefully shut down on SIGTERM', async () => {
      try {
        process.emit('SIGTERM');
        await new Promise((resolve) => setImmediate(resolve));

        expect(loggerMock.log).toHaveBeenCalledWith({
          message: 'Received signal, shutting down gracefully',
          signal: 'SIGTERM',
          method: 'bootstrap',
        });
        expect(mockApp.close).toHaveBeenCalled();
        expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGTERM');
      } catch (error) {
        // The process.exit call will throw an error, so we catch it here.
        expect(error.message).toBe('process.exit: 0');
      }
    });

    it('should gracefully shut down on SIGINT', async () => {
      try {
        process.emit('SIGINT');
        await new Promise((resolve) => setImmediate(resolve));

        expect(loggerMock.log).toHaveBeenCalledWith({
          message: 'Received signal, shutting down gracefully',
          signal: 'SIGINT',
          method: 'bootstrap',
        });
        expect(mockApp.close).toHaveBeenCalled();
        expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
      } catch (error) {
        // The process.exit call will throw an error, so we catch it here.
        expect(error.message).toBe({
          message: 'SIGINT received: closing app gracefully',
          method: 'bootstrap',
        });
      }
    });

    it('should gracefully shut down on SIGUSR2', async () => {
      try {
        process.emit('SIGUSR2');
        await new Promise((resolve) => setImmediate(resolve));

        expect(loggerMock.log).toHaveBeenCalledWith({
          message: 'Received signal, shutting down gracefully',
          signal: 'SIGUSR2',
          method: 'bootstrap',
        });
        expect(mockApp.close).toHaveBeenCalled();
        expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGUSR2');
      } catch (error) {
        // The process.exit call will throw an error, so we catch it here.
        expect(error.message).toBe('process.exit: 0');
      }
    });
  });
});
