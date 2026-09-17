import json
from pathlib import Path

import ezdxf


ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / 'catalog/generated/catalog-assets.json').read_text(encoding='utf-8'))
VECTOR = json.loads((ROOT / 'catalog/generated/vector-cache-manifest.json').read_text(encoding='utf-8'))
R4 = ROOT / 'benchmarks/r4-real-dxf-composer'


def _r4_model():
    return json.loads((R4 / 'regenerated-layout.json').read_text(encoding='utf-8'))


def test_source_asset_hash_preserved():
    source_ids = {item['source_asset_id'] for item in json.loads((R4 / 'source-assets.json').read_text())}
    records = {item['source_asset_id']: item for item in CATALOG['records']}
    assert len(source_ids) == 5
    assert all(records[item]['sha256'] for item in source_ids)


def test_preview_only_asset_cannot_enter_authoritative_layout():
    mapping = json.loads((R4 / 'approved-mappings.json').read_text())
    assert mapping['status'] == 'blocked'
    assert mapping['mappings'] == []
    assert all(item['physical_mapping_status'] == 'unknown' for item in json.loads((R4 / 'source-assets.json').read_text()))


def test_component_instance_is_one_semantic_object():
    model = _r4_model()
    assert len(model['components']) == 5
    assert all(item['assetId'] and item['cadGeometryRef'] and item['metadata']['geometryStatus'] == 'source_verified' for item in model['components'])


def test_dxf_geometry_transform_matches_component_placement():
    model = _r4_model()
    component = model['components'][0]
    bounds = next(item for item in VECTOR['records'] if item['source_asset_id'] == component['assetId'])['bounds']
    cache = json.loads((ROOT / component['cadGeometryRef']).read_text())
    first = cache['geometry'][0]
    local_x = first.get('x1', first.get('cx'))
    local_y = first.get('y1', first.get('cy'))
    expected_x = component['x'] + local_x - bounds['min_x']
    expected_y = component['y'] + local_y - bounds['min_y']
    assert expected_x >= component['x']
    assert expected_y >= component['y']


def test_physical_footprint_and_rendered_bounds_align():
    assert all(item['metadata']['physicalMappingStatus'] == 'unknown' for item in _r4_model()['components'])
    assert json.loads((R4 / 'validation.json').read_text())['authoritative'] is False


def test_drag_drop_creates_component_instance():
    assert len(_r4_model()['components']) >= 5
    assert all(item['kind'] == 'cad_asset' for item in _r4_model()['components'])


def test_known_unit_preview_components_use_plate_mounting():
    model = _r4_model()
    rails = {rail['id']: rail for rail in model['rails']}
    assert all(component['railId'] is None for component in model['components'])


def test_locked_real_component_survives_regeneration():
    manual = json.loads((R4 / 'manual-layout.json').read_text())
    regenerated = _r4_model()
    locked_manual = next(item for item in manual['components'] if item['locked'])
    locked_regenerated = next(item for item in regenerated['components'] if item['id'] == locked_manual['id'])
    assert (locked_regenerated['x'], locked_regenerated['y']) == (locked_manual['x'], locked_manual['y'])
    assert locked_regenerated['locked'] is True


def test_auto_layout_uses_physical_footprint():
    model = json.loads((R4 / 'auto-layout.json').read_text())
    assert model['metadata']['previewCadAssets'] is True
    assert all(item['width'] > 0 and item['height'] > 0 for item in model['components'])


def test_real_geometry_survives_dxf_export():
    text = (R4 / 'exports/r4-preview.dxf').read_text(encoding='utf-8')
    assert 'CAD_GEOMETRY' in text
    assert text.count('\nARC\r\n') + text.count('\nARC\n') > 0


def test_exported_real_component_reopens_with_ezdxf():
    document = ezdxf.readfile(R4 / 'exports/r4-preview.dxf')
    modelspace = document.modelspace()
    geometry = [entity for entity in modelspace if entity.dxf.layer == 'CAD_GEOMETRY']
    assert len(geometry) > 100
    assert document.dxfversion == 'AC1009'
