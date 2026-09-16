"""Normalize real geometry from catalog DXF files into web/export primitives."""
from __future__ import annotations
import argparse, json, math
from pathlib import Path
import ezdxf

def xy(value): return float(value[0]), float(value[1])
def collect(entity, out, depth=0):
    if depth > 3: return
    kind = entity.dxftype()
    if kind == 'LINE':
        x1,y1=xy(entity.dxf.start); x2,y2=xy(entity.dxf.end); out.append({'type':'line','x1':x1,'y1':y1,'x2':x2,'y2':y2})
    elif kind in ('LWPOLYLINE','POLYLINE'):
        try:
            pts=list(entity.get_points('xy')) if kind=='LWPOLYLINE' else [(v.dxf.location.x,v.dxf.location.y) for v in entity.vertices]
            for a,b in zip(pts,pts[1:]): out.append({'type':'line','x1':float(a[0]),'y1':float(a[1]),'x2':float(b[0]),'y2':float(b[1])})
            if getattr(entity,'closed',False) and len(pts)>2: out.append({'type':'line','x1':float(pts[-1][0]),'y1':float(pts[-1][1]),'x2':float(pts[0][0]),'y2':float(pts[0][1])})
        except Exception: pass
    elif kind in ('ARC','CIRCLE'):
        c=entity.dxf.center; item={'type':kind.lower(),'cx':float(c.x),'cy':float(c.y),'r':float(entity.dxf.radius)}
        if kind=='ARC': item.update({'start':float(entity.dxf.start_angle),'end':float(entity.dxf.end_angle)})
        out.append(item)
    elif kind=='INSERT':
        try:
            for child in entity.virtual_entities(): collect(child,out,depth+1)
        except Exception: pass

def normalize(geometry):
    points=[]
    for g in geometry:
        if g['type']=='line': points += [(g['x1'],g['y1']),(g['x2'],g['y2'])]
        else: points.append((g['cx']-g['r'],g['cy']-g['r'])); points.append((g['cx']+g['r'],g['cy']+g['r']))
    if not points: return geometry, {'min_x':0,'min_y':0,'width':0,'height':0}
    min_x=min(p[0] for p in points); min_y=min(p[1] for p in points); max_x=max(p[0] for p in points); max_y=max(p[1] for p in points)
    result=[]
    for g in geometry:
        item=dict(g)
        for key in ('x1','x2','cx'): 
            if key in item: item[key]=round(item[key]-min_x,6)
        for key in ('y1','y2','cy'):
            if key in item: item[key]=round(item[key]-min_y,6)
        result.append(item)
    return result, {'min_x':min_x,'min_y':min_y,'width':max_x-min_x,'height':max_y-min_y}

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('catalog',type=Path); parser.add_argument('--ids',nargs='*'); args=parser.parse_args()
    root=args.catalog.resolve(); manifest=json.loads((root/'generated/catalog-assets.json').read_text(encoding='utf-8')); wanted=set(args.ids or [r['source_asset_id'] for r in manifest['records']]); out=root/'generated/vector-cache'; out.mkdir(parents=True,exist_ok=True); rows=[]
    for record in manifest['records']:
        if record['source_asset_id'] not in wanted: continue
        source=root/record['relative_path']; geometry=[]
        try:
            doc=ezdxf.readfile(source)
            for entity in doc.modelspace(): collect(entity,geometry)
            normalized,bounds=normalize(geometry); target=out/f"{record['source_asset_id']}.json"; target.write_text(json.dumps({'schema_version':'cad-vector.v1','source_asset_id':record['source_asset_id'],'representation_id':record.get('representation_id'),'source_path':record['relative_path'],'source_sha256':record['content_sha256'],'geometry':normalized,'bounds':bounds,'entity_count':len(normalized)},separators=(',',':')),encoding='utf-8')
            rows.append({'source_asset_id':record['source_asset_id'],'vector_cache_ref':f'vector-cache/{target.name}','entity_count':len(normalized),'bounds':bounds,'status':'ok'})
        except Exception as exc: rows.append({'source_asset_id':record['source_asset_id'],'status':'failed','error':f'{exc.__class__.__name__}: {exc}'})
    (root/'generated/vector-cache-manifest.json').write_text(json.dumps({'schema_version':'cad-vector-cache.v1','source_root':'catalog','records':rows},indent=2,sort_keys=True),encoding='utf-8'); print(json.dumps({'requested':len(wanted),'built':sum(r['status']=='ok' for r in rows),'failed':sum(r['status']!='ok' for r in rows)},indent=2))
if __name__=='__main__': main()
