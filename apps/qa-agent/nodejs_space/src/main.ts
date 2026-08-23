import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  app.enableCors({ origin: '*' });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Swagger setup
  const swaggerPath = 'api-docs';

  // Prevent caching of Swagger docs
  app.use(`/${swaggerPath}`, (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
  });

  const config = new DocumentBuilder()
    .setTitle('GrovLabs QA Agent')
    .setDescription(
      'Real-time Call Quality Assurance Agent for detecting cold transfer fraud in inbound call campaigns. ' +
      'Monitors TrackDrive call recordings, transcribes audio, analyzes for fraudulent patterns using AI, ' +
      'and sends Telegram alerts when issues are detected.',
    )
    .setVersion('1.0')
    .addTag('Webhooks', 'TrackDrive webhook endpoints for real-time call processing')
    .addTag('Affiliates', 'Affiliate management and high-sensitivity monitoring')
    .addTag('Analytics', 'Dashboard statistics and flagged call reports')
    .addTag('Health', 'Service health monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(swaggerPath, app, document, {
    customSiteTitle: 'GrovLabs QA Agent API',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #1a1a2e; font-size: 2em; }
      .swagger-ui .info .description p { color: #333; font-size: 14px; line-height: 1.6; }
      .swagger-ui .opblock-tag { font-size: 16px; border-bottom: 1px solid #e8e8e8; }
      .swagger-ui .opblock.opblock-get .opblock-summary-method { background: #2196F3; }
      .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #4CAF50; }
      .swagger-ui .opblock.opblock-put .opblock-summary-method { background: #FF9800; }
      .swagger-ui .btn.execute { background: #1a1a2e; border-color: #1a1a2e; }
      body { background: #fafafa; }
    `,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`GrovLabs QA Agent running on port ${port}`);
  logger.log(`API docs available at /${swaggerPath}`);
}
bootstrap();
