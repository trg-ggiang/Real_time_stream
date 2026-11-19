import type { Department } from "./services/workspace-api";

export interface RecruitmentQuestion {
  id: string;
  text: string;
  hint: string;
  maxLength: number | "";
  required: boolean;
}
export interface RecruitmentDepartment {
  id: string;
  recruitmentId: string;
  name: string;
  enabled: boolean;
  description: string;
  requirements: string;
  quota: string;
  questions: RecruitmentQuestion[];
}
export interface RecruitmentDraft {
  version: 2;
  campaignId: string;
  title: string;
  description: string;
  opensAt: string;
  closesAt: string;
  cover: { name: string; url: string } | null;
  departments: RecruitmentDepartment[];
}
export const newRecruitmentQuestion = (): RecruitmentQuestion => ({
  id: crypto.randomUUID(), text: "", hint: "", maxLength: "", required: true,
});
let checkedPageNavigation = false;
export function createRecruitmentDraft(): RecruitmentDraft {
  return {
    version: 2,
    campaignId: crypto.randomUUID(),
    title: "",
    description: "",
    opensAt: "", closesAt: "", cover: null,
    departments: [],
  };
}
/** The current club's API owns department identity and name; drafts only own form edits. */
export function withRecruitmentDepartments(draft: RecruitmentDraft, departments: Department[]): RecruitmentDraft {
  const saved = new Map(draft.departments.map(department => [department.id, department]));
  return { ...draft, departments: departments.filter(department => department.status === "active" && !department.is_management).map(department => ({
    ...(saved.get(department.department_id) || { recruitmentId: crypto.randomUUID(), enabled: true, quota: "", description: "", requirements: "", questions: [newRecruitmentQuestion()] }),
    id: department.department_id,
    name: department.name,
  })) };
}
/** A browser reload begins a new campaign; in-tab navigation can restore a saved draft. */
export function loadRecruitmentDraft(key: string): RecruitmentDraft {
  try {
    if (!checkedPageNavigation) {
      checkedPageNavigation = true;
      const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      if (navigation?.type === "reload") {
        for (let index = sessionStorage.length - 1; index >= 0; index--) {
          const storedKey = sessionStorage.key(index);
          if (storedKey?.startsWith("uc:recruitment:v2:")) sessionStorage.removeItem(storedKey);
        }
        return createRecruitmentDraft();
      }
    }
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    const string = (item: unknown): item is string => typeof item === "string";
    if (value?.version === 2 && [value.title, value.description, value.opensAt, value.closesAt].every(string) &&
      (value.cover === null || (string(value.cover?.name) && string(value.cover?.url) && /^(data:image\/(png|jpeg);base64,|https:\/\/)/.test(value.cover.url))) &&
      Array.isArray(value.departments) &&
      value.departments.every((d: RecruitmentDepartment) => d && string(d.id) && d.id.length > 0 &&
        [d.name, d.description, d.requirements, d.quota].every(string) && typeof d.enabled === "boolean" &&
        Array.isArray(d.questions) && d.questions.length <= 20 && d.questions.every(q => q &&
          [q.id, q.text, q.hint].every(string) && typeof q.required === "boolean" &&
          (q.maxLength === "" || (typeof q.maxLength === "number" && Number.isInteger(q.maxLength) && q.maxLength >= 1 && q.maxLength <= 10000))))) {
      const uuid = (id: unknown) => typeof id === "string" && /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id);
      return { ...value, campaignId: uuid(value.campaignId) ? value.campaignId : crypto.randomUUID(),
        departments: value.departments.map((d: RecruitmentDepartment) => ({ ...d, recruitmentId: uuid(d.recruitmentId) ? d.recruitmentId : crypto.randomUUID() })) };
    }
  } catch { /* Missing, unavailable or invalid storage starts a blank draft. */ }
  return createRecruitmentDraft();
}
