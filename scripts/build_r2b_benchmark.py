"""Build the R2B verified-Siemens work package without fabricating vendor data.

This run records the network blocker explicitly. It still builds and exports a
real-CAD geometry pipeline from the catalog inputs, but unresolved products are
never promoted to vendor-verified status.
"""
from __future__ import annotations
import csv, json, sys, time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from packages.cad_export import audit_with_ezdxf, write_project_artifacts
from packages.domain_model import Connection, Device, Enclosure, Footprint, PartDefinition, Placement, Project, Terminal, stable_id
from packages.layout_engine import LayoutConfig, heuristic_layout, solver_layout
from packages.validation import validate_project
from scripts.build_r2_benchmark import source_dimensions
from scripts.build_vector_cache import main as _unused

CATALOG=ROOT/'catalog'; OUT=ROOT/'benchmarks/r2b-verified-siemens-cabinet'

TOKENS=['s7-1200-plc-1211c','s7-1200-pm1207','s7-1200-sm-1221','s7-1500-cpu-1511','s7-1500-sm531','sirius-contactor-cad','sitop-psu-cad','sinamics-g120c-vfd-cad']

def selected_records():
    manifest=json.loads((CATALOG/'generated/catalog-assets.json').read_text(encoding='utf-8'))
    records=[]
    for token in TOKENS:
        hit=next((r for r in manifest['records'] if token in r.get('relative_path','').lower() and r.get('parse_status')=='parsed'),None)
        if hit: records.append(hit)
    return records

def build_cache(records):
    # Importing the cache implementation avoids any source mutation and keeps
    # the exact parser path shared with the catalog ingestion command.
    import ezdxf
    from scripts.build_vector_cache import collect, normalize
    target=CATALOG/'generated/vector-cache'; target.mkdir(parents=True,exist_ok=True); rows=[]
    for r in records:
        geometry=[]
        try:
            doc=ezdxf.readfile(CATALOG/r['relative_path'])
            for entity in doc.modelspace(): collect(entity,geometry)
            normalized,bounds=normalize(geometry); path=target/f"{r['source_asset_id']}.json"; path.write_text(json.dumps({'schema_version':'cad-vector.v1','source_asset_id':r['source_asset_id'],'representation_id':r.get('representation_id'),'source_path':r['relative_path'],'source_sha256':r['content_sha256'],'geometry':normalized,'bounds':bounds,'entity_count':len(normalized)},separators=(',',':')),encoding='utf-8'); rows.append({'source_asset_id':r['source_asset_id'],'vector_cache_ref':f'catalog/generated/vector-cache/{path.name}','entity_count':len(normalized),'bounds':bounds,'status':'ok'})
        except Exception as exc: rows.append({'source_asset_id':r['source_asset_id'],'status':'failed','error':f'{exc.__class__.__name__}: {exc}'})
    (CATALOG/'generated/vector-cache-manifest.json').write_text(json.dumps({'schema_version':'cad-vector-cache.v1','source_root':'catalog','records':rows},indent=2,sort_keys=True),encoding='utf-8')
    return rows

def make_project(records):
    roles=['PLC CPU','24VDC Power','PLC I/O','Communication','Control Relays','Field Terminals','PLC I/O','Drives']
    parts=[]; devices=[]
    for i,r in enumerate(records):
        w,h=source_dimensions(r); aid=r['source_asset_id']; pid=f'cadpart-r2b-{aid}'
        parts.append(PartDefinition(id=pid,manufacturer='Siemens',manufacturer_part='UNRESOLVED',description=r.get('candidate_description') or r['relative_path'],category='siemens_candidate',footprint=Footprint(width=w,height=h,depth=60,mounting='din_rail',rail_width=35),terminals=[Terminal(id='1',name='signal')],cad_asset_id=aid,cad_geometry_ref=f'catalog/generated/vector-cache/{aid}.json',footprint_ref=f'cadasset:{aid}'))
        devices.append(Device(id=stable_id('device','r2b',aid),tag=f'-A{i+1:02d}',part_id=pid,function=roles[i],description=r.get('candidate_description'),terminal_ids=['1'],properties={'functional_group':roles[i],'preferred_zone':roles[i],'verification_level':'test','source_asset_id':aid}))
    idx={d.properties['functional_group']:d for d in devices}
    edges=[]
    def edge(a,b,label):
        if a and b: edges.append(Connection(id=stable_id('connection',a.id,b.id,label),from_device=a.id,from_terminal='1',to_device=b.id,to_terminal='1',label=label))
    edge(idx.get('24VDC Power'),idx.get('PLC CPU'),'24VDC'); edge(idx.get('PLC CPU'),idx.get('PLC I/O'),'DI/DO'); edge(idx.get('PLC CPU'),idx.get('Communication'),'PROFINET'); edge(idx.get('PLC CPU'),idx.get('Drives'),'drive-control'); edge(idx.get('PLC I/O'),idx.get('Field Terminals'),'field-signals'); edge(idx.get('PLC CPU'),idx.get('Control Relays'),'DO1')
    return Project(id='r2b-verified-siemens-cabinet',name='R2B Siemens geometry benchmark (incomplete verification)',enclosure=Enclosure(width=1000,height=1400,depth=300,plate_margin=50),parts=parts,devices=devices,connections=edges,metadata={'benchmark_status':'INCOMPLETE: vendor verification blocked','source_policy':'DXF source only from catalog/','verification_level':'test','authoritative':False,'previewCadAssets':True})

def write_docs(records):
    directory=ROOT/'docs/r2/verified-components'; directory.mkdir(parents=True,exist_ok=True)
    for r in records:
        stem=''.join(ch if ch.isalnum() else '_' for ch in (r.get('candidate_description') or r['source_asset_id']))[:70]
        (directory/f'{stem}.md').write_text(f"# {r.get('candidate_description') or r['relative_path']}\n\n- verification_status: unresolved\n- verification_level: test\n- catalog_source_asset: {r['source_asset_id']}\n- source_filename: `{r['relative_path']}`\n- candidate_identity: {r.get('candidate_description')}\n- verified Siemens identity: null\n- order number / MPN: null (not inferred)\n- width / height / depth mm: null (source envelope is not vendor evidence)\n- mounting: candidate DIN-compatible drawing; unresolved\n- vendor source: https://www.siemens.com/global/en/products/automation.html\n- source evidence: official Siemens pages were requested during R2B; Industry Mall/support returned HTTP 403 in this environment\n- verification confidence: 0.0\n- why this DXF is considered the same product: filename/family evidence only; insufficient for exact match\n- known ambiguity: units, exact order number, physical dimensions and representation role remain unresolved\n",encoding='utf-8')

def main():
    records=selected_records(); OUT.mkdir(parents=True,exist_ok=True); (OUT/'exports').mkdir(exist_ok=True)
    cache_rows=build_cache(records); write_docs(records)
    source=[{'source_asset_id':r['source_asset_id'],'relative_path':r['relative_path'],'source_group':r['source_group'],'sha256':r['content_sha256'],'candidate_identity':r.get('candidate_description'),'verification_status':'unresolved','verification_level':'test','vector_cache_ref':next((x.get('vector_cache_ref') for x in cache_rows if x['source_asset_id']==r['source_asset_id']),None)} for r in records]
    (OUT/'source-manifest.json').write_text(json.dumps({'source_root':'catalog','records':source},indent=2,sort_keys=True),encoding='utf-8')
    bom=[{'line':i+1,'source_asset_id':r['source_asset_id'],'quantity':1,'resolution_status':'needs-review','verification_level':'test'} for i,r in enumerate(records)]
    with (OUT/'bom.csv').open('w',newline='',encoding='utf-8') as h: w=csv.DictWriter(h,fieldnames=list(bom[0])); w.writeheader(); w.writerows(bom)
    (OUT/'verified-footprints.json').write_text(json.dumps({'verified_count':0,'records':[],'reason':'VENDOR VERIFICATION BLOCKED BY NETWORK'},indent=2),encoding='utf-8')
    resolution=[{'source_asset_id':r['source_asset_id'],'candidate_identity':r.get('candidate_description'),'verification_status':'unresolved','verification_level':'test','order_number':None,'dimensions_status':'unverified','cad_match_class':'scaled-layout-symbol'} for r in records]
    with (OUT/'product-resolution.csv').open('w',newline='',encoding='utf-8') as h: w=csv.DictWriter(h,fieldnames=list(resolution[0])); w.writeheader(); w.writerows(resolution)
    project=make_project(records); heuristic=heuristic_layout(project); solved=solver_layout(project,config=LayoutConfig(solver_time_limit_s=3)); report=validate_project(solved.project)
    artifacts=write_project_artifacts(solved.project,OUT/'exports',stem='r2b-verified-cabinet')
    # Persist named layout snapshots for forensic comparison.
    (OUT/'heuristic-layout.json').write_text(heuristic.project.canonical_json(indent=2),encoding='utf-8'); (OUT/'solver-layout.json').write_text(solved.project.canonical_json(indent=2),encoding='utf-8')
    locked=solved.project.copy(deep=True); lock=locked.placements[0].copy(update={'locked':True,'x':locked.placements[0].x+5}); locked.placements=[lock,*locked.placements[1:]]; replay=heuristic_layout(locked).project.placement_index()[lock.device_id]
    (OUT/'engineer-adjusted-layout.json').write_text(locked.canonical_json(indent=2),encoding='utf-8')
    result={'benchmark_id':'r2b-verified-siemens-cabinet','status':'INCOMPLETE: VENDOR VERIFICATION BLOCKED BY NETWORK','catalog_assets_researched':len(records),'exact_siemens_products_identified':0,'vendor_verified_dimensions':0,'usable_cad_representations':sum(x.get('entity_count',0)>10 for x in cache_rows),'rejected_or_mismatched_assets':0,'unresolved':len(records),'device_count':len(project.devices),'verified_siemens_count':0,'generic_count':0,'rail_count':len(solved.project.rails),'duct_count':len(solved.project.ducts),'heuristic':{'valid':validate_project(heuristic.project).valid,'metrics':heuristic.metrics},'solver':{'valid':report.valid,'engine':solved.engine,'metrics':solved.metrics,'warnings':solved.warnings},'topology':{'connections':len(project.connections),'functional_groups':sorted({d.function for d in project.devices})},'lock_regenerate':{'locked_exact':replay.x==lock.x and replay.y==lock.y},'cad_audit':audit_with_ezdxf(artifacts['dxf']),'artifacts':{k:str(v.relative_to(ROOT)) for k,v in artifacts.items()}}
    (OUT/'benchmark.json').write_text(json.dumps(result,indent=2,sort_keys=True),encoding='utf-8'); (OUT/'topology.json').write_text(json.dumps({'connections':[c.to_dict() for c in project.connections]},indent=2),encoding='utf-8')
    print(json.dumps({'records':len(records),'cache_entities':sum(x.get('entity_count',0) for x in cache_rows),'solver':solved.engine,'dxf':str(artifacts['dxf']),'valid':report.valid},indent=2))
if __name__=='__main__': main()
