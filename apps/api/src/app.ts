import 'reflect-metadata';
import { ArgumentsHost, BadRequestException, Body, Catch, Controller, ExceptionFilter,
  ExecutionContext, Get, HttpCode, HttpException, HttpStatus, Injectable, Module, Post,
  UnauthorizedException, UploadedFile, UseGuards, UseInterceptors, ValidationPipe, CanActivate } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FileInterceptor } from '@nestjs/platform-express';
import { RawBodyRequest } from '@nestjs/common';
import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AskDto, CrmDto, DocumentDto } from './dto';
import { PolicyService } from './policy.service';
import { CrmService } from './crm.service';
import { LlmAdapter } from './llm';

@Injectable()
class SignatureGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const secret = process.env.CRM_WEBHOOK_SECRET;
    const signature = request.headers['x-signature'];
    if (!secret || typeof signature !== 'string' || !/^sha256=[a-fA-F0-9]{64}$/.test(signature) || !request.rawBody) {
      throw new UnauthorizedException('Missing or invalid CRM signature');
    }
    const expected = createHmac('sha256', secret).update(request.rawBody).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) {
      throw new UnauthorizedException('Missing or invalid CRM signature');
    }
    return true;
  }
}

@Catch()
class JsonErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = error instanceof HttpException ? error.getResponse() : 'Internal server error';
    host.switchToHttp().getResponse<Response>().status(status).json({ statusCode: status,
      error: typeof detail === 'string' ? { message: detail } : detail });
  }
}

@Controller()
class PolicyController {
  constructor(private readonly policies: PolicyService, private readonly crm: CrmService) {}

  @Get('health') health() { return { status: 'ok' }; }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  async documents(@UploadedFile() file: Express.Multer.File, @Body() body: DocumentDto) {
    if (!file) throw new BadRequestException('A file is required');
    return this.policies.ingest(file, body.doc_id, body.title);
  }

  @Post('ask') async ask(@Body() body: AskDto) { return this.policies.ask(body.question, body.top_k); }

  @Post('webhooks/crm')
  @UseGuards(SignatureGuard)
  @HttpCode(200)
  async webhook(@Body() body: CrmDto) { return this.crm.process(body); }
}

@Module({ controllers: [PolicyController], providers: [PolicyService, CrmService, LlmAdapter, SignatureGuard] })
class AppModule {}

export async function createApp() {
  const app = await NestFactory.create(AppModule, { rawBody: true, logger: false, bodyParser: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new JsonErrors());
  await app.init();
  return app;
}
