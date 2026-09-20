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
  CONTRACT_SIGN_IMAGE_FIELD_NAME,
  CONTRACT_SIGN_IMAGE_MAX_BYTES,
} from './contract.constants';
import { PublicContractService } from './public-contract.service';

class PublicContractSignDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  accepted?: boolean;
}

@Controller('public/contracts')
export class PublicContractController {
  constructor(private readonly publicContracts: PublicContractService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.publicContracts.getByToken(token);
  }

  @Get(':token/document')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async document(@Param('token') token: string): Promise<StreamableFile> {
    const file = await this.publicContracts.downloadByToken(token);
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
    FileInterceptor(CONTRACT_SIGN_IMAGE_FIELD_NAME, {
      storage: memoryStorage(),
      limits: { fileSize: CONTRACT_SIGN_IMAGE_MAX_BYTES, files: 1 },
    }),
  )
  sign(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: PublicContractSignDto,
  ) {
    return this.publicContracts.sign(token, file, Boolean(dto.accepted));
  }
}
