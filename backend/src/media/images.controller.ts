import { BadRequestException, Controller, Header, Injectable, Post, ServiceUnavailableException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompleteProfileGuard } from '../users/complete-profile.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { SupabaseService } from '../supabase/supabase.service';

export const imageLimit = 5 * 1024 * 1024;
const bucketName = 'app-images';
const types = ['image/jpeg', 'image/png', 'image/webp'];
type ImageFile = { buffer: Buffer; size: number; mimetype: string };
function imageType(buffer: Buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
@Injectable()
export class ImagesService {
  constructor(private readonly supabase: SupabaseService) {}
  async upload(userId: string, file?: ImageFile) {
    if (!file?.buffer || file.size !== file.buffer.length || file.size < 16 || file.size > imageLimit) throw new BadRequestException('Chọn ảnh hợp lệ, tối đa 5 MB.');
    const mime = imageType(file.buffer);
    if (!mime || mime !== file.mimetype) throw new BadRequestException('Chỉ nhận ảnh JPG, PNG hoặc WebP đúng định dạng.');
    const storage = this.supabase.client.storage;
    const path = `${encodeURIComponent(userId)}/${randomUUID()}.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`;
    const bucket = storage.from(bucketName);
    const options = { contentType: mime, upsert: false, cacheControl: '31536000' };
    let result = await bucket.upload(path, file.buffer, options);
    if (result.error?.message === 'Bucket not found') {
      // Provision only this new bucket, on an explicit authenticated upload; never alter an existing bucket.
      const created = await storage.createBucket(bucketName, { public: true, fileSizeLimit: imageLimit, allowedMimeTypes: types });
      if (created.error && !/already exists/i.test(created.error.message)) throw new ServiceUnavailableException('Chưa khởi tạo được nơi lưu ảnh. Hãy thử lại.');
      result = await bucket.upload(path, file.buffer, options);
    }
    if (result.error) throw new ServiceUnavailableException('Chưa tải được ảnh lên. Hãy thử lại.');
    return { url: bucket.getPublicUrl(path).data.publicUrl };
  }
}

@Controller('media/images')
@UseGuards(JwtAuthGuard, CompleteProfileGuard, ThrottlerGuard)
export class ImagesController {
  constructor(private readonly images: ImagesService) {}
  @Post() @Header('Cache-Control', 'private, no-store')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: imageLimit, files: 1, fields: 0 } }))
  upload(@CurrentUser() user: User, @UploadedFile() file?: ImageFile) { return this.images.upload(user.userId, file); }
}
