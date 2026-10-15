import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Roles } from '../../rbac/roles.decorator';
import { RolesGuard } from '../../rbac/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { AiPricingService } from '../gateway/ai-pricing.service';
import { providerByDbId } from '../gateway/providers';
import { AiUsageReportService } from './ai-usage-report.service';
import { UpsertAiPriceDto } from './dto/ai-credential.dto';

@ApiTags('admin')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('admin/ai')
export class AdminAiController {
  constructor(
    private readonly reports: AiUsageReportService,
    private readonly prisma: PrismaService,
    private readonly pricing: AiPricingService,
  ) {}

  @Get('usage')
  usage() {
    return this.reports.adminUsage();
  }

  /** Current price per provider/model (newest effective row). */
  @Get('prices')
  async prices() {
    const rows = await this.prisma.aiModelPrice.findMany({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: [
        { provider: 'asc' },
        { model: 'asc' },
        { effectiveFrom: 'desc' },
      ],
    });
    const seen = new Set<string>();
    return rows
      .filter((r) => {
        const key = `${r.provider}/${r.model}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({
        provider: r.provider,
        providerName: providerByDbId(r.provider).name,
        model: r.model,
        inputPerMTok: Number(r.inputPerMTok),
        outputPerMTok: Number(r.outputPerMTok),
        cachedInputPerMTok:
          r.cachedInputPerMTok === null ? null : Number(r.cachedInputPerMTok),
        isFree: r.isFree,
        effectiveFrom: r.effectiveFrom,
      }));
  }

  /** Adds a new price row effective now; history is kept so past costs stay explainable. */
  @Put('prices')
  async setPrice(@Body() dto: UpsertAiPriceDto) {
    const row = await this.prisma.aiModelPrice.create({
      data: {
        provider: dto.provider,
        model: dto.model.trim(),
        inputPerMTok: dto.inputPerMTok,
        outputPerMTok: dto.outputPerMTok,
        cachedInputPerMTok: dto.cachedInputPerMTok ?? null,
        isFree: dto.isFree ?? false,
      },
    });
    this.pricing.invalidate();
    return { id: row.id, effectiveFrom: row.effectiveFrom };
  }
}

@ApiTags('health')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('health')
export class AiHealthController {
  constructor(private readonly reports: AiUsageReportService) {}

  /** Configured providers, every task's chain and each model's cooldown/circuit state. */
  @Get('ai')
  ai() {
    return this.reports.aiHealth();
  }
}
