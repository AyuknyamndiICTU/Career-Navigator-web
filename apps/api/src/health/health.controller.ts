import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/jwt-auth.guard';
import { HealthService, Readiness } from './health.service';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: the process is up and serving HTTP. Never touches dependencies. */
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  /** Readiness: Postgres, Redis and object storage are reachable. 503 otherwise. */
  @Get('ready')
  async ready(): Promise<Readiness> {
    const result = await this.health.readiness();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
