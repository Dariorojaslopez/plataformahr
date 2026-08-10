import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../core/users/users.module';
import { PlatformOwnerGuard } from './guards/platform-owner.guard';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';

@Module({
  imports: [AuthModule, UsersModule],
  controllers: [PlatformController],
  providers: [PlatformOwnerGuard, PlatformService],
})
export class PlatformModule {}
