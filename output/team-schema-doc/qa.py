from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
from pypdf import PdfReader
import json
base=Path(r'D:/Project/Livekit project/Real_time_stream/output/team-schema-doc')
pages=sorted((base/'render').glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]))
for start in range(0,len(pages),12):
 canvas=Image.new('RGB',(1320,4*600),'#cccccc');draw=ImageDraw.Draw(canvas)
 for i,path in enumerate(pages[start:start+12]):
  img=Image.open(path).convert('RGB');img.thumbnail((420,565));x=(i%3)*440+10;y=(i//3)*600+25;canvas.paste(img,(x,y));draw.text((x,y-18),str(start+i+1),fill='black')
 canvas.save(base/f'contact-{start//12+1}.jpg')
pdf=PdfReader(base/'uniCircle_Thay_doi_database_va_quy_uoc_nhom_2026-11-17.pdf').pages
print(json.dumps({'pages':len(pdf),'empty_pages':[i+1 for i,p in enumerate(pdf) if len(p.extract_text().strip())<70],'pngs':len(pages)}))

