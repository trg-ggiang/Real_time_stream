export interface StudentProfile {
  full_name: string;
  student_code: string;
  school_or_faculty: string;
  major: string;
  cohort: string;
  phone: string;
  bio: string;
}
export const profileFields: {
  key: keyof StudentProfile;
  label: string;
  limit: number;
  required?: boolean;
}[] = [
  { key: "full_name", label: "Họ và tên", limit: 120, required: true },
  { key: "student_code", label: "Mã sinh viên", limit: 32, required: true },
  {
    key: "school_or_faculty",
    label: "Trường / khoa",
    limit: 120,
    required: true,
  },
  { key: "major", label: "Ngành học", limit: 120, required: true },
  { key: "cohort", label: "Khóa", limit: 40, required: true },
  { key: "phone", label: "Số điện thoại", limit: 30 },
  { key: "bio", label: "Giới thiệu", limit: 1000 },
];
export const emptyProfile: StudentProfile = {
  full_name: "",
  student_code: "",
  school_or_faculty: "",
  major: "",
  cohort: "",
  phone: "",
  bio: "",
};
export const normalizeProfile = (data: Partial<StudentProfile>) =>
  Object.fromEntries(
    profileFields.map(({ key }) => [
      key,
      typeof data[key] === "string" ? data[key] : "",
    ]),
  ) as unknown as StudentProfile;
export const profileComplete = (data: StudentProfile) =>
  profileFields
    .filter((f) => f.required)
    .every((f) => Boolean(data[f.key].trim()));
