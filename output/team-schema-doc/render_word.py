import importlib.util,sys,shutil
from pathlib import Path
skill=Path(r'C:/Users/ADMIN/.codex/plugins/cache/openai-primary-runtime/documents/26.1116.12020/skills/documents/render_docx.py')
spec=importlib.util.spec_from_file_location('renderer',skill);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
base=Path(r'D:/Project/Livekit project/Real_time_stream/output/team-schema-doc');doc=base/'uniCircle_Thay_doi_database_va_quy_uoc_nhom_2026-11-17.docx';pdf=doc.with_suffix('.pdf')
def word_pdf(input_path,user_profile,convert_tmp_dir,stem,verbose=False):
 target=Path(convert_tmp_dir)/(stem+'.pdf');shutil.copyfile(pdf,target);return str(target),'Rendered by installed Microsoft Word COM because LibreOffice is unavailable.'
m.convert_to_pdf=word_pdf
sys.argv=[str(skill),str(doc),'--output_dir',str(base/'render'),'--emit_pdf','--width','1100','--height','1500']
m.main()
