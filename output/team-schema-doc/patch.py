from pathlib import Path
p=Path('output/team-schema-doc/build.py');s=p.read_text(encoding='utf-8-sig')
s=s.replace('Mục 2 đến 5 dành cho cả nhóm: ảnh hưởng tới code, quyền và vòng đời nghiệp vụ.','Mục 2 và 3 dành cho cả nhóm: ảnh hưởng tới code, quyền và vòng đời nghiệp vụ.')
s=s.replace('Mục 6 mô tả đầy đủ các cột của 16 bảng mới; mục 7 tổng hợp 14 RPC.','Mục 4 mô tả đầy đủ các cột và ràng buộc chính của 16 bảng mới.')
s=s.replace('Mục 8 và 9 là quy ước gửi thông báo, checklist triển khai và giới hạn kiểm chứng.','Mục 3 tổng hợp RPC và thông báo; mục 5 là checklist triển khai.')
s=s.replace("desc={'created_at':", "desc={'recruitment_department_id':'Ban tuyển trong một đợt, khác với department_id của ban gốc.','admitted_membership_id':'Membership được tạo khi accepted, cùng transaction với kết quả.','last_read_message_id':'FK kép cùng channel_id tới channel_messages; phải thuộc đúng kênh.','created_at':")
s=s.replace('D.save(path)',"\nfor el in list(D.styles.element.iter(qn('w:pBdr'))):\n el.getparent().remove(el)\nfor el in list(D.element.iter(qn('w:pBdr'))):\n el.getparent().remove(el)\nD.save(path)")
p.write_text(s,encoding='utf-8')
