import { useClubCategories } from "../hooks/use-public-query";
import "./club-category-picker.css";

export function ClubCategoryPicker({ selected, onChange, disabled = false }: {
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const categories = useClubCategories();
  return (
    <fieldset className="club-category-picker" disabled={disabled}>
      <legend>Loại CLB *</legend>
      <p>Chọn một hoặc nhiều loại phù hợp với hoạt động của CLB.</p>
      {categories.loading && <p role="status">Đang tải loại CLB…</p>}
      {categories.data && !categories.data.length && <p>Chưa có loại CLB để chọn.</p>}
      {categories.data && (
        <div className="club-category-options">
          {categories.data.map((category) => (
            <label key={category.category_id}>
              <input
                type="checkbox"
                value={category.category_id}
                disabled={categories.loading || !!categories.error}
                checked={selected.includes(category.category_id)}
                onChange={(event) => onChange(event.target.checked
                  ? [...selected, category.category_id]
                  : selected.filter((id) => id !== category.category_id))}
              />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
      )}
      {categories.error && (
        <>
          <p role="alert">Không tải được loại CLB.</p>
          <button type="button" onClick={categories.retry}>Tải lại</button>
        </>
      )}
    </fieldset>
  );
}
