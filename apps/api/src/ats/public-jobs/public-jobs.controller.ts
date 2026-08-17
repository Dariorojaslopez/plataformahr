import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PublicJobApplicationDto } from './dto/public-job.dto';
import { PublicJobsService } from './public-jobs.service';

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

  @Post(':publicId/apply')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  apply(
    @Param('publicId') publicId: string,
    @Body() dto: PublicJobApplicationDto,
  ) {
    return this.publicJobs.apply(publicId, dto);
  }
}
