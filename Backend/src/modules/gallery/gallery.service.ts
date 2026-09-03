import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { unlink } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { PaginatedResult } from '../../common/interfaces/paginated-result.interface';
import { scopeFilter } from '../../common/utils/scope-filter.util';
import {
  UPLOADS_URL_PREFIX,
  uploadsDir,
} from '../../common/utils/upload-path.util';
import { Media, MediaDocument } from './schemas/media.schema';
import { UploadMediaDto } from './dto/upload-media.dto';

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  constructor(
    @InjectModel(Media.name)
    private readonly mediaModel: Model<MediaDocument>,
  ) {}

  async create(
    dto: UploadMediaDto,
    schoolId: string | null,
  ): Promise<Media> {
    if (!schoolId) {
      throw new BadRequestException('schoolId is required');
    }
    return this.mediaModel.create({ ...dto, schoolId });
  }

  async findAll(
    page = 1,
    limit = 20,
    schoolId: string | null,
  ): Promise<PaginatedResult<Media>> {
    const skip = (page - 1) * limit;
    const filter = scopeFilter({}, schoolId);
    const [data, total] = await Promise.all([
      // Newest first — a gallery is read as a feed, and without a sort the
      // order is whatever Mongo happens to return.
      this.mediaModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.mediaModel.countDocuments(filter).exec(),
    ]);
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string, schoolId: string | null): Promise<Media> {
    const doc = await this.mediaModel
      .findOne(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!doc) {
      throw new NotFoundException('Media not found');
    }
    return doc;
  }

  async update(
    id: string,
    dto: UploadMediaDto,
    schoolId: string | null,
  ): Promise<Media> {
    const doc = await this.mediaModel
      .findOneAndUpdate(scopeFilter({ _id: id }, schoolId), dto, {
        new: true,
      })
      .exec();
    if (!doc) {
      throw new NotFoundException('Media not found');
    }
    return doc;
  }

  async remove(id: string, schoolId: string | null): Promise<void> {
    const res = await this.mediaModel
      .findOneAndDelete(scopeFilter({ _id: id }, schoolId))
      .exec();
    if (!res) {
      throw new NotFoundException('Media not found');
    }
    // The row is gone either way; the file would otherwise sit in uploads/
    // forever with nothing pointing at it.
    await this.deleteStoredFile(res.metadata?.url);
  }

  /**
   * Removes the file behind a deleted gallery item, best-effort.
   *
   * Never throws: the database row is already gone, so failing here would
   * report an error for a delete that did happen. A file that has already been
   * removed, or a record created by URL rather than upload, is normal.
   */
  private async deleteStoredFile(url: unknown): Promise<void> {
    if (typeof url !== 'string' || !url.startsWith(`${UPLOADS_URL_PREFIX}/`)) {
      // An externally hosted item — nothing of ours to clean up.
      return;
    }

    const root = uploadsDir(process.env.STORAGE_LOCAL_PATH);
    const target = resolve(root, basename(url));

    // basename() already strips any traversal, but the containment check stays:
    // this deletes files, and the input reaches us from a database record.
    if (target !== join(root, basename(target))) return;

    try {
      await unlink(target);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== 'ENOENT') {
        this.logger.warn(
          `Deleted gallery item ${basename(url)} but could not remove its file: ${code ?? 'unknown error'}`,
        );
      }
    }
  }
}
