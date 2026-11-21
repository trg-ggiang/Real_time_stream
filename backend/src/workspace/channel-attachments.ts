import { BadRequestException, FileTypeValidator } from '@nestjs/common';
import { createHash } from 'node:crypto';

export const attachmentBucket = 'club-chat-attachments';
export const attachmentByteLimit = 15 * 1024 * 1024;
export const attachmentCountLimit = 3;

const mimeTypes = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
} as const;

export type ChannelUpload = { buffer: Buffer; originalname: string; mimetype: string };

export async function prepareChannelAttachments(
  files: ChannelUpload[],
  senderId: string,
  channelId: string,
  clientMessageId: string,
) {
  if (!files.length || files.length > attachmentCountLimit) {
    throw new BadRequestException('Chọn từ 1 đến 3 tệp đính kèm.');
  }
  if (files.reduce((sum, file) => sum + file.buffer.length, 0) > attachmentByteLimit) {
    throw new BadRequestException('Tổng dung lượng tệp tối đa là 15 MiB.');
  }

  return Promise.all(files.map(async (file, index) => {
    const originalName = file.originalname.replace(/[\u0000-\u001f\u007f]/g, '').trim();
    const extension = originalName.split('.').pop()?.toLowerCase() ?? '';
    const mimeType = Object.hasOwn(mimeTypes, extension) ? mimeTypes[extension as keyof typeof mimeTypes] : undefined;
    const size = file.buffer.length;
    const validationFile = { ...file, size };
    if (!size || !originalName || [...originalName].length > 255 || !mimeType ||
      !await new FileTypeValidator({ fileType: mimeType, overrideMimeType: true }).isValid(validationFile) ||
      validationFile.mimetype !== mimeType) {
      throw new BadRequestException('Tệp rỗng, tên quá dài hoặc định dạng không được hỗ trợ. Dùng JPEG, PNG, WebP, PDF, DOCX, XLSX hoặc PPTX.');
    }

    // A retry of the same bytes resolves to the same Storage path. A changed
    // file under the same message ID gets a new path and cannot overwrite it.
    const id = createHash('sha256')
      .update(JSON.stringify([senderId, channelId, clientMessageId, index, originalName, mimeType]))
      .update(file.buffer).digest('hex').slice(0, 32)
      .replace(/^(........)(....)(....)(....)(............)$/, '$1-$2-$3-$4-$5');
    return {
      buffer: file.buffer,
      metadata: { attachment_id: id, original_name: originalName, mime_type: mimeType, size_bytes: size },
    };
  }));
}
