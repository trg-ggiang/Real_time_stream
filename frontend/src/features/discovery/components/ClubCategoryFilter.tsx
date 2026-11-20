import { useClubCategories } from "../hooks/use-public-query";

export function ClubCategoryFilter({ value, onChange }: {
  value: string;
  onChange: (category: string) => void;
}) {
  const categories = useClubCategories();
  return (
    <div className="dc-category-filter">
      <label className="dc-period" htmlFor="club-category">
        Loại CLB
        <select
          id="club-category"
          value={value}
          disabled={categories.loading || !!categories.error}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Tất cả loại CLB</option>
          {categories.data?.map((category) => (
            <option key={category.category_id} value={category.category_id}>
              {category.name}
            </option>
          ))}
          {value && !categories.data?.some((category) => category.category_id === value) && (
            <option value={value}>Loại CLB đang chọn</option>
          )}
        </select>
      </label>
      {categories.error && (
        <button type="button" onClick={categories.retry}>Tải lại loại CLB</button>
      )}
    </div>
  );
}
