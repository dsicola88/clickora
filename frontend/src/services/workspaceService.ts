import { apiClient } from "@/lib/apiClient";

export type WorkspaceMineRow = {
  workspace_id: string;
  name: string;
  owner_user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
};

export type WorkspaceMemberRow = {
  user_id: string;
  email: string;
  name: string | null;
  role: "owner" | "admin" | "member" | "viewer";
  permissions?: string[];
  created_at: string;
};

export type WorkspaceAuditRow = {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  actor_user_id: string;
  metadata: unknown;
  created_at: string;
};

export const workspaceService = {
  listMine() {
    return apiClient.get<WorkspaceMineRow[]>("/workspaces");
  },

  listMembers(workspaceId: string) {
    return apiClient.get<WorkspaceMemberRow[]>(`/workspaces/${encodeURIComponent(workspaceId)}/members`);
  },

  addMember(workspaceId: string, body: { email: string; role: "admin" | "member" | "viewer" }) {
    return apiClient.post<{ ok: boolean; user_id: string; role: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members`,
      body,
    );
  },

  removeMember(workspaceId: string, userId: string) {
    return apiClient.delete<unknown>(`/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`);
  },

  patchMemberPermissions(workspaceId: string, userId: string, body: { permissions: string[] | null }) {
    return apiClient.patch<{ ok: boolean; user_id: string; permissions: string[] }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
      body,
    );
  },

  audit(workspaceId: string, limit?: number) {
    const q = limit != null ? `?limit=${limit}` : "";
    return apiClient.get<WorkspaceAuditRow[]>(`/workspaces/${encodeURIComponent(workspaceId)}/audit${q}`);
  },
};
