import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { ChatRepository } from './chat.repository';
import { ChatAccessService } from './chat-access.service';
import { ChatIdentity } from './chat.types';
import { HistoryDto, SendMessageDto, parseChatDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  private readonly windows = new Map<string, number[]>();
  constructor(private readonly repository: ChatRepository, private readonly access: ChatAccessService) {}

  private rateLimit(identity: ChatIdentity, action: string, limit: number) {
    const key = `${identity.userId}:${action}`;
    const now = Date.now();
    const recent = (this.windows.get(key) ?? []).filter(time => time > now - 10_000);
    if (recent.length >= limit) throw new HttpException('Thao tác quá nhanh. Hãy đợi vài giây.', 429);
    recent.push(now); this.windows.set(key, recent);
  }

  pruneLimits() {
    for (const [key, values] of this.windows) if (values[values.length - 1] < Date.now() - 10_000) this.windows.delete(key);
  }

  async send(identity: ChatIdentity, value: unknown) {
    this.rateLimit(identity, 'send', 20);
    const dto = await parseChatDto(SendMessageDto, value);
    await this.access.requireAccess(identity);
    return this.repository.insert(identity.sessionId, identity.userId, dto.clientMessageId, dto.content.trim());
  }

  async history(identity: ChatIdentity, value: unknown) {
    this.rateLimit(identity, 'history', 40);
    const dto = await parseChatDto(HistoryDto, value);
    if (dto.before && dto.after) throw new BadRequestException('Chỉ dùng một hướng tải lịch sử.');
    await this.access.requireAccess(identity);
    return this.repository.history(identity.sessionId, dto.before ?? dto.after, dto.after ? 'after' : 'before');
  }
}
