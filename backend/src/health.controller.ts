import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    // Liveness only: this does not assert that LiveKit credentials are valid.
    return { status: 'ok' };
  }
}
