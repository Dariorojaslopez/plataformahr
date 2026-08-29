import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { PublicJobApplicationDto } from './dto/public-job.dto';
import { PublicJobsService } from './public-jobs.service';
import { CV_FIELD_NAME, CV_MAX_BYTES } from './cv.constants';

@Controller('public/jobs')
export class PublicJobsController {
  constructor(private readonly publicJobs: PublicJobsService) {}

  @Get(':publicId')
  get(@Param('publicId') publicId: string) {
    return this.publicJobs.get(publicId);
  }

  @Get(':publicId/logo')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('X-Content-Type-Options', 'nosniff')
  async logo(@Param('publicId') publicId: string): Promise<StreamableFile> {
    const logo = await this.publicJobs.logo(publicId);
    return new StreamableFile(logo.buffer, {
      type: logo.mimeType,
      disposition: 'inline',
    });
  }

  @Post(':publicId/parse-cv')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(CV_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: CV_MAX_BYTES, files: 1 },
    }),
  )
  parseCv(
    @Param('publicId') publicId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.publicJobs.parseCv(publicId, file);
  }

  @Post(':publicId/apply')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(CV_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: CV_MAX_BYTES, files: 1 },
    }),
  )
  apply(
    @Param('publicId') publicId: string,
    @Body() dto: PublicJobApplicationDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    return this.publicJobs.apply(publicId, dto, file);
  }
}
