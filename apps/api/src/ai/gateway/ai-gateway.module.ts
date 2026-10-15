import { Global, Module } from '@nestjs/common';
import { AiCredentialsService } from '../byok/ai-credentials.service';
import { AiGatewayService } from './ai-gateway.service';
import { AiKeyCrypto } from './ai-key-crypto';
import { AiPricingService } from './ai-pricing.service';
import { AiQuotaService } from './ai-quota.service';
import { AiStateStore } from './ai-state.store';
import { AiUsageService } from './ai-usage.service';
import { ModelHealthService } from './model-health.service';

const SERVICES = [
  AiStateStore,
  ModelHealthService,
  AiKeyCrypto,
  AiPricingService,
  AiUsageService,
  AiQuotaService,
  AiCredentialsService,
  AiGatewayService,
];

/** Global so the AI, CV-scan, jobs, auth and admin modules share one gateway and its state. */
@Global()
@Module({
  providers: SERVICES,
  exports: SERVICES,
})
export class AiGatewayModule {}
