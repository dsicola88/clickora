import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  workspaceCanManageApiKeys,
  workspaceCanReadIntegrationSecrets,
  workspaceCanWriteCampaigns,
} from "./rbac";

describe("workspace RBAC gaps fechados", () => {
  it("API keys só owner/admin", () => {
    assert.equal(workspaceCanManageApiKeys("owner"), true);
    assert.equal(workspaceCanManageApiKeys("admin"), true);
    assert.equal(workspaceCanManageApiKeys("member"), false);
    assert.equal(workspaceCanManageApiKeys("viewer"), false);
  });

  it("campanhas: member escreve, viewer não", () => {
    assert.equal(workspaceCanWriteCampaigns("member"), true);
    assert.equal(workspaceCanWriteCampaigns("viewer"), false);
    assert.equal(workspaceCanWriteCampaigns("owner"), true);
  });

  it("segredos de postback: viewer bloqueado", () => {
    assert.equal(workspaceCanReadIntegrationSecrets("viewer"), false);
    assert.equal(workspaceCanReadIntegrationSecrets("member"), true);
  });
});
