import type {
  AiFeature,
  AiRunStatus,
  CampaignStatus,
  ChangeRequestStatus,
  ChangeRequestType,
  ConnectionStatus,
  EntityStatus,
  ProjectPaidMode,
} from "@prisma/client";

import type {
  mapAiRun,
  mapChangeRequest,
  mapGoogleAdsConnection,
  mapGuardrails,
  mapMetaConnection,
  mapPaidCampaign,
  mapTikTokConnection,
} from "@backend/api-mappers";

export type PaidGuardrailsRow = ReturnType<typeof mapGuardrails>;
export type GoogleAdsConnectionRow = ReturnType<typeof mapGoogleAdsConnection>;
export type MetaConnectionRow = ReturnType<typeof mapMetaConnection>;
export type TikTokConnectionRow = ReturnType<typeof mapTikTokConnection>;
export type PaidCampaignRow = ReturnType<typeof mapPaidCampaign>;
export type PaidChangeRequestRow = ReturnType<typeof mapChangeRequest>;
export type AiRunRow = ReturnType<typeof mapAiRun>;

export type {
  AiFeature,
  AiRunStatus,
  CampaignStatus,
  ChangeRequestStatus,
  ChangeRequestType,
  ConnectionStatus,
  EntityStatus,
  ProjectPaidMode,
};
