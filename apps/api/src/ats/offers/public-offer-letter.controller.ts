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
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  OFFER_SIGN_IMAGE_FIELD_NAME,
  OFFER_SIGN_IMAGE_MAX_BYTES,
} from './offer-letter.constants';
import { PublicOfferLetterService } from './public-offer-letter.service';

class PublicOfferLetterSignDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  accepted?: boolean;
}

@Controller('public/offer-letters')
export class PublicOfferLetterController {
  constructor(private readonly publicLetters: PublicOfferLetterService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.publicLetters.getByToken(token);
  }

  @Get(':token/document')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async document(@Param('token') token: string): Promise<StreamableFile> {
    const file = await this.publicLetters.downloadByToken(token);
    const filename = file.originalName.replace(/["\r\n]/g, '');
    return new StreamableFile(file.buffer, {
      type: file.mimeType,
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Post(':token/sign')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor(OFFER_SIGN_IMAGE_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: OFFER_SIGN_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  sign(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PublicOfferLetterSignDto,
  ) {
    return this.publicLetters.sign(token, file, Boolean(dto.accepted));
  }
}
