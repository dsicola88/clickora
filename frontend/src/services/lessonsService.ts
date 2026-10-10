import { apiClient } from "@/lib/apiClient";

export type LessonProvider = "youtube" | "bunny";

export type AcademyLesson = {
  id: string;
  title: string;
  description: string | null;
  provider: LessonProvider;
  module: string;
  sort_order: number;
  embed_url: string | null;
};

export type AcademyLessonAdmin = AcademyLesson & {
  source_url: string;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type LessonDraft = {
  title: string;
  description?: string | null;
  source_url: string;
  module_name?: string;
  sort_order?: number;
  published?: boolean;
};

const ALLOWED_EMBED_PREFIXES = [
  "https://www.youtube-nocookie.com/embed/",
  "https://iframe.mediadelivery.net/embed/",
];

export function isSafeLessonEmbed(url: string | null | undefined): url is string {
  return typeof url === "string" && ALLOWED_EMBED_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export const lessonsService = {
  async list() {
    return apiClient.get<{ lessons: AcademyLesson[] }>("/lessons");
  },

  async listAdmin() {
    return apiClient.get<{ lessons: AcademyLessonAdmin[] }>("/admin/lessons");
  },

  async create(body: LessonDraft) {
    return apiClient.post<{ lesson: AcademyLessonAdmin }>("/admin/lessons", body);
  },

  async update(id: string, body: Partial<LessonDraft>) {
    return apiClient.patch<{ lesson: AcademyLessonAdmin }>(`/admin/lessons/${id}`, body);
  },

  async remove(id: string) {
    return apiClient.delete<{ message: string }>(`/admin/lessons/${id}`);
  },
};
