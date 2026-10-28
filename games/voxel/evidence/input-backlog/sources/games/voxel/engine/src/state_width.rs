//! Native counterparts of the release-Wasm state-width regressions.
use crate::{blocks, formats, gen, mesher, world};
#[test]
fn high_states_survive_generation_storage_and_edits() {
    let definitions = (0..300).map(|i| format!(r#"{{"name":"state_{i}","tex":[0,0,0,0,0,0],"shape":"slab","emit":7}}"#)).collect::<Vec<_>>().join(",");
    blocks::set_game_blocks(&format!("[{definitions}]")).unwrap();
    let id = (blocks::GAME_FIRST + 299) as u16;
    assert!(id > 255);
    assert_eq!(world::collision_boxes(id), &[[0,0,0,16,8,16]]);
    let mut generator = gen::Generator::new(1);
    generator.set_void();
    generator.add_blueprint(gen::Blueprint { origin: [-1,17,-1], size: [1,1,1], data: vec![id] });
    let data = generator.generate(-1,-1);
    let wire = formats::wrap(formats::COLUMN, data.clone());
    assert!(formats::column(&wire).is_ok());
    let mut w = world::World::new(); w.insert_column(-1,-1,&data);
    assert_eq!(w.get(-1,17,-1),id);
    w.set(-2,17,-1,256); w.set(-3,17,-1,255);
    let edits = w.export_edits();
    let mut copy = world::World::new(); copy.import_edits(&edits); copy.insert_column(-1,-1,&data);
    assert_eq!(copy.get(-2,17,-1),256); assert_eq!(copy.get(-3,17,-1),255);
    let region = copy.extract_region(-1,-1);
    assert!(formats::region(&formats::wrap(formats::REGION,region.clone())).is_ok());
    let mut mesh = mesher::Mesher::new(); assert!(mesh.mesh(&region)[1] > 0);
    assert!(formats::column(&wire[..wire.len()-1]).is_err());
    assert!(formats::column(&data).is_err());
}
