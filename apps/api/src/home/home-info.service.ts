import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { CompanyHomeMediaKind, type CompanyHomeInfo } from '@prisma/client';
import type { TenantContext } from '../auth/auth.types';
import { AuditService } from '../core/audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../core/rbac/rbac.service';
import {
  EMPTY_HOME_COMPANY_INFO,
  type HomeCompanyInfo,
  type UpdateHomeCompanyInfoDto,
} from './dto/home.dto';
import {
  HOME_COMPANY_INFO_AUDIT,
  HOME_COMPANY_INFO_ENTITY,
  HOME_INFO_IMAGE_MAX_BYTES,
  HOME_INFO_VIDEO_MAX_BYTES,
} from './home-info.constants';
import { inspectHomeInfoBuffer } from './home-info.media';
import {
  assertValidHomeInfoSchedule,
  hasPublicCompanyHomeInfoContent,
  isCompanyHomeInfoLive,
} from './home-info.schedule';
import {
  buildHomeInfoFileName,
  deleteHomeInfoFile,
  readHomeInfoFile,
  resolveCompanyUploadsDir,
  writeHomeInfoFile,
} from './home-info.storage';

export type HomeCompanyInfoFile = {
  buffer: Buffer;
  mimeType: string;
};

@Injectable()
export class HomeInfoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
  ) {}

  uploadsDir(): string {
    return resolveCompanyUploadsDir();
  }

  async getCompanyInfo(tenant: TenantContext): Promise<HomeCompanyInfo> {
    const row = await this.findRow(tenant.companyId);
    if (!row) return EMPTY_HOME_COMPANY_INFO;

    const canManage = await this.canManage(tenant);
    if (!canManage && !this.isPublic(row)) {
      return EMPTY_HOME_COMPANY_INFO;
    }
    return this.toResponse(row);
  }

  async updateCompanyInfo(
    tenant: TenantContext,
    dto: UpdateHomeCompanyInfoDto,
  ): Promise<HomeCompanyInfo> {
    const publishedAt = new Date(dto.publishedAt);
    if (Number.isNaN(publishedAt.getTime())) {
      throw new BadRequestException('La fecha de publicación no es válida.');
    }
    const unpublishedAt =
      dto.unpublishedAt === undefined || dto.unpublishedAt === null
        ? null
        : new Date(dto.unpublishedAt);
    if (unpublishedAt && Number.isNaN(unpublishedAt.getTime())) {
      throw new BadRequestException('La fecha de despublicación no es válida.');
    }
    try {
      assertValidHomeInfoSchedule(publishedAt, unpublishedAt);
    } catch {
      throw new BadRequestException(
        'La fecha de despublicación debe ser posterior a la de publicación.',
      );
    }

    const title = dto.title.trim();
    const description = (dto.description ?? '').trim();
    const existing = await this.findRow(tenant.companyId);
    const row = existing
      ? await this.prisma.companyHomeInfo.update({
          where: { id: existing.id },
          data: { title, description, publishedAt, unpublishedAt },
        })
      : await this.prisma.companyHomeInfo.create({
          data: {
            companyId: tenant.companyId,
            title,
            description,
            publishedAt,
            unpublishedAt,
          },
        });

    await this.audit.create({
      action: HOME_COMPANY_INFO_AUDIT.UPDATED,
      entity: HOME_COMPANY_INFO_ENTITY,
      entityId: row.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: {
        title: row.title,
        publishedAt: row.publishedAt.toISOString(),
        unpublishedAt: row.unpublishedAt?.toISOString() ?? null,
        hasMedia: Boolean(row.fileName),
      },
    });

    return this.toResponse(row);
  }

  async replaceMedia(
    tenant: TenantContext,
    file: { buffer: Buffer; size?: number } | undefined,
  ): Promise<HomeCompanyInfo> {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        'Se requiere un archivo de imagen o video.',
      );
    }
    if (
      file.buffer.length > HOME_INFO_VIDEO_MAX_BYTES ||
      (file.size ?? 0) > HOME_INFO_VIDEO_MAX_BYTES
    ) {
      throw new PayloadTooLargeException(
        'El archivo supera el tamaño máximo permitido.',
      );
    }

    const inspected = inspectHomeInfoBuffer(file.buffer);
    if (!inspected.ok) {
      if (inspected.reason === 'size') {
        throw new PayloadTooLargeException(
          'El archivo supera el tamaño máximo permitido.',
        );
      }
      if (inspected.reason === 'mime' || inspected.reason === 'parse') {
        throw new UnsupportedMediaTypeException(
          'El archivo debe ser una imagen PNG, JPEG o WebP, o un video MP4 o WebM.',
        );
      }
      if (inspected.reason === 'dimensions') {
        throw new BadRequestException(
          'Las dimensiones de la imagen deben estar entre 1 y 4096 píxeles.',
        );
      }
      throw new BadRequestException(
        'Se requiere un archivo de imagen o video.',
      );
    }

    if (
      inspected.info.kind === 'IMAGE' &&
      file.buffer.length > HOME_INFO_IMAGE_MAX_BYTES
    ) {
      throw new PayloadTooLargeException(
        'El archivo supera el tamaño máximo permitido.',
      );
    }

    const fileName = buildHomeInfoFileName(inspected.info.mime);
    const existing = await this.findRow(tenant.companyId);
    const previousFileName = existing?.fileName ?? null;

    await writeHomeInfoFile({
      uploadsDir: this.uploadsDir(),
      companyId: tenant.companyId,
      fileName,
      buffer: file.buffer,
    });

    try {
      const mediaKind =
        inspected.info.kind === 'IMAGE'
          ? CompanyHomeMediaKind.IMAGE
          : CompanyHomeMediaKind.VIDEO;
      const now = new Date();
      const row = existing
        ? await this.prisma.companyHomeInfo.update({
            where: { id: existing.id },
            data: {
              mediaKind,
              fileName,
              mimeType: inspected.info.mime,
              mediaUpdatedAt: now,
            },
          })
        : await this.prisma.companyHomeInfo.create({
            data: {
              companyId: tenant.companyId,
              title: '',
              description: '',
              publishedAt: now,
              mediaKind,
              fileName,
              mimeType: inspected.info.mime,
              mediaUpdatedAt: now,
            },
          });

      if (previousFileName && previousFileName !== fileName) {
        await deleteHomeInfoFile({
          uploadsDir: this.uploadsDir(),
          companyId: tenant.companyId,
          fileName: previousFileName,
        });
      }

      await this.audit.create({
        action: HOME_COMPANY_INFO_AUDIT.MEDIA_REPLACED,
        entity: HOME_COMPANY_INFO_ENTITY,
        entityId: row.id,
        company: { connect: { id: tenant.companyId } },
        user: { connect: { id: tenant.userId } },
        metadata: {
          hasMedia: true,
          mediaKind: row.mediaKind,
          mimeType: inspected.info.mime,
          byteLength: file.buffer.length,
        },
      });

      return this.toResponse(row);
    } catch (error) {
      await deleteHomeInfoFile({
        uploadsDir: this.uploadsDir(),
        companyId: tenant.companyId,
        fileName,
      });
      throw error;
    }
  }

  async removeMedia(tenant: TenantContext): Promise<HomeCompanyInfo> {
    const existing = await this.findRow(tenant.companyId);
    if (!existing) return EMPTY_HOME_COMPANY_INFO;
    if (!existing.fileName) return this.toResponse(existing);

    const row = await this.prisma.companyHomeInfo.update({
      where: { id: existing.id },
      data: {
        mediaKind: null,
        fileName: null,
        mimeType: null,
        mediaUpdatedAt: null,
      },
    });

    await deleteHomeInfoFile({
      uploadsDir: this.uploadsDir(),
      companyId: tenant.companyId,
      fileName: existing.fileName,
    });

    await this.audit.create({
      action: HOME_COMPANY_INFO_AUDIT.MEDIA_REMOVED,
      entity: HOME_COMPANY_INFO_ENTITY,
      entityId: row.id,
      company: { connect: { id: tenant.companyId } },
      user: { connect: { id: tenant.userId } },
      metadata: { hasMedia: false },
    });

    return this.toResponse(row);
  }

  async readMedia(tenant: TenantContext): Promise<HomeCompanyInfoFile> {
    const row = await this.findRow(tenant.companyId);
    if (!row?.fileName || !row.mimeType) {
      throw new NotFoundException('No hay un archivo publicado.');
    }

    const canManage = await this.canManage(tenant);
    if (!canManage && !this.isPublic(row)) {
      throw new NotFoundException('No hay un archivo publicado.');
    }

    try {
      const buffer = await readHomeInfoFile({
        uploadsDir: this.uploadsDir(),
        companyId: tenant.companyId,
        fileName: row.fileName,
      });
      return { buffer, mimeType: row.mimeType };
    } catch {
      throw new NotFoundException('No hay un archivo publicado.');
    }
  }

  private async canManage(tenant: TenantContext): Promise<boolean> {
    const codes = await this.rbac.getPermissionCodesForMembership(
      tenant.membershipId,
    );
    return codes.has('company.manage');
  }

  private findRow(companyId: string): Promise<CompanyHomeInfo | null> {
    return this.prisma.companyHomeInfo.findUnique({ where: { companyId } });
  }

  private isPublic(row: CompanyHomeInfo): boolean {
    return isCompanyHomeInfoLive(row) && hasPublicCompanyHomeInfoContent(row);
  }

  private toResponse(row: CompanyHomeInfo): HomeCompanyInfo {
    return {
      title: row.title,
      description: row.description,
      publishedAt: row.publishedAt.toISOString(),
      unpublishedAt: row.unpublishedAt ? row.unpublishedAt.toISOString() : null,
      mediaKind: row.mediaKind,
      hasMedia: Boolean(row.fileName),
      isLive: this.isPublic(row),
      mediaUpdatedAt: row.mediaUpdatedAt
        ? row.mediaUpdatedAt.toISOString()
        : null,
    };
  }
}
