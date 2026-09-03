import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { GalleryService } from './gallery.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import {
  uploadedFileUrl,
  uploadsDir,
} from '../../common/utils/upload-path.util';

const STORAGE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.TEACHER,
];

@Controller('gallery')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GalleryController {
  constructor(
    private readonly galleryService: GalleryService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @Roles(...STORAGE_ROLES)
  create(@Body() dto: UploadMediaDto, @CurrentUser() user: AuthUser) {
    return this.galleryService.create(dto, user.schoolId);
  }

  @Post('upload')
  @Roles(...STORAGE_ROLES)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          // Same resolution as the static server in main.ts — writing to one
          // directory and serving from another is how these 404'd before.
          cb(null, uploadsDir(process.env.STORAGE_LOCAL_PATH));
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }),
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string | undefined,
    @Body('notes') notes: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    // Store a relative path so the client can resolve against its own
    // configured server address (e.g. emulator vs. physical device).
    const url = uploadedFileUrl(file.filename);
    return this.galleryService.create(
      {
        title: title ?? file.originalname,
        notes,
        metadata: {
          url,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          type: file.mimetype.startsWith('video') ? 'video' : 'image',
        },
      },
      user.schoolId,
    );
  }

  @Get()
  findAll(
    @Query('page') page: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.galleryService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      user.schoolId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.galleryService.findOne(id, user.schoolId);
  }

  @Patch(':id')
  @Roles(...STORAGE_ROLES)
  update(
    @Param('id') id: string,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.galleryService.update(id, dto, user.schoolId);
  }

  @Delete(':id')
  @Roles(...STORAGE_ROLES)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.galleryService.remove(id, user.schoolId);
  }
}
