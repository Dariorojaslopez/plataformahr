import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpObservabilityInterceptor } from './http-observability.interceptor';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { requestIdMiddleware } from './request-id.middleware';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpObservabilityInterceptor,
    },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Ensure requestId even when tests bootstrap without configureApp.
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
