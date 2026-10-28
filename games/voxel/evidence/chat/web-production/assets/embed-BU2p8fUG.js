class wa{__destroy_into_raw(){const e=this.__wbg_ptr;return this.__wbg_ptr=0,ko.unregister(this),e}free(){const e=this.__destroy_into_raw();ie.__wbg_culler_free(e,0)}capacity(){return ie.culler_capacity(this.__wbg_ptr)>>>0}cull(e,t,n,s,r,a){const o=yr(e,ie.__wbindgen_malloc),l=It;ie.culler_cull(this.__wbg_ptr,o,l,t,n,s,r,a)}cull_shadow(e,t,n,s,r){const a=yr(e,ie.__wbindgen_malloc),o=It;ie.culler_cull_shadow(this.__wbg_ptr,a,o,t,n,s,r)}constructor(){const e=ie.culler_new();return this.__wbg_ptr=e,ko.register(this,this.__wbg_ptr,this),this}out_ptr(){return ie.culler_out_ptr(this.__wbg_ptr)>>>0}out_shadow_ptr(){return ie.culler_out_shadow_ptr(this.__wbg_ptr)>>>0}remove_column(e,t){ie.culler_remove_column(this.__wbg_ptr,e,t)}set_column(e,t,n){const s=Ql(n,ie.__wbindgen_malloc),r=It;return ie.culler_set_column(this.__wbg_ptr,e,t,s,r)>>>0}visible_sections(){return ie.culler_visible_sections(this.__wbg_ptr)>>>0}}Symbol.dispose&&(wa.prototype[Symbol.dispose]=wa.prototype.free);class Ta{__destroy_into_raw(){const e=this.__wbg_ptr;return this.__wbg_ptr=0,No.unregister(this),e}free(){const e=this.__destroy_into_raw();ie.__wbg_voxelworld_free(e,0)}apply_damage(e){const t=Cs(e,ie.__wbindgen_malloc),n=It,s=ie.voxelworld_apply_damage(this.__wbg_ptr,t,n);var r=Fo(s[0],s[1]).slice();return ie.__wbindgen_free(s[0],s[1]*4,4),r}blast(e,t,n,s,r,a,o){const l=Ql(o,ie.__wbindgen_malloc),c=It,u=ie.voxelworld_blast(this.__wbg_ptr,e,t,n,s,r,a,l,c);var h=Wn(u[0],u[1]).slice();return ie.__wbindgen_free(u[0],u[1]*1,1),h}bodies_ptr(){return ie.voxelworld_bodies_ptr(this.__wbg_ptr)>>>0}body_capacity(){return ie.voxelworld_body_capacity(this.__wbg_ptr)>>>0}body_ride(e){const t=ie.voxelworld_body_ride(this.__wbg_ptr,e);var n=On(t[0],t[1]).slice();return ie.__wbindgen_free(t[0],t[1]*8,8),n}body_stride(){return ie.voxelworld_body_stride(this.__wbg_ptr)>>>0}carvable(e,t,n){return ie.voxelworld_carvable(this.__wbg_ptr,e,t,n)!==0}carve(e,t,n,s,r,a,o,l){const c=ie.voxelworld_carve(this.__wbg_ptr,e,t,n,s,r,a,o,l);var u=Wn(c[0],c[1]).slice();return ie.__wbindgen_free(c[0],c[1]*1,1),u}clear_edits(){ie.voxelworld_clear_edits(this.__wbg_ptr)}collision_top(e,t,n){return ie.voxelworld_collision_top(this.__wbg_ptr,e,t,n)}column_count(){return ie.voxelworld_column_count(this.__wbg_ptr)>>>0}damage_count(){return ie.voxelworld_damage_count(this.__wbg_ptr)>>>0}damage_left(e,t,n){return ie.voxelworld_damage_left(this.__wbg_ptr,e,t,n)>>>0}edit_count(){return ie.voxelworld_edit_count(this.__wbg_ptr)>>>0}export_damage(){const e=ie.voxelworld_export_damage(this.__wbg_ptr);var t=Wn(e[0],e[1]).slice();return ie.__wbindgen_free(e[0],e[1]*1,1),t}export_edits(){const e=ie.voxelworld_export_edits(this.__wbg_ptr);var t=Wn(e[0],e[1]).slice();return ie.__wbindgen_free(e[0],e[1]*1,1),t}extract_region(e,t){const n=ie.voxelworld_extract_region(this.__wbg_ptr,e,t);var s=Wn(n[0],n[1]).slice();return ie.__wbindgen_free(n[0],n[1]*1,1),s}extract_region_wrapped(e,t,n,s){const r=ie.voxelworld_extract_region_wrapped(this.__wbg_ptr,e,t,n,s);var a=Wn(r[0],r[1]).slice();return ie.__wbindgen_free(r[0],r[1]*1,1),a}forget_column(e,t){ie.voxelworld_forget_column(this.__wbg_ptr,e,t)}get_block(e,t,n){return ie.voxelworld_get_block(this.__wbg_ptr,e,t,n)}has_column(e,t){return ie.voxelworld_has_column(this.__wbg_ptr,e,t)!==0}import_edits(e){const t=Cs(e,ie.__wbindgen_malloc),n=It,s=ie.voxelworld_import_edits(this.__wbg_ptr,t,n);if(s[1])throw cr(s[0])}insert_column(e,t,n){const s=Cs(n,ie.__wbindgen_malloc),r=It,a=ie.voxelworld_insert_column(this.__wbg_ptr,e,t,s,r);if(a[1])throw cr(a[0])}light_probe(e,t,n){const s=ie.voxelworld_light_probe(this.__wbg_ptr,e,t,n);var r=Qc(s[0],s[1]).slice();return ie.__wbindgen_free(s[0],s[1]*4,4),r}line_clear(e,t,n,s,r,a){return ie.voxelworld_line_clear(this.__wbg_ptr,e,t,n,s,r,a)!==0}mirror_block(e,t,n,s){return ie.voxelworld_mirror_block(this.__wbg_ptr,e,t,n,s)!==0}mover_add(e,t,n,s,r,a,o,l,c){const u=iu(r,ie.__wbindgen_malloc),h=It;ie.voxelworld_mover_add(this.__wbg_ptr,e,t,n,s,u,h,a,o,l,c)}mover_at(e,t,n){return ie.voxelworld_mover_at(this.__wbg_ptr,e,t,n)>>>0}mover_count(){return ie.voxelworld_mover_count(this.__wbg_ptr)>>>0}mover_overlap(e,t,n,s,r,a,o,l,c){return ie.voxelworld_mover_overlap(this.__wbg_ptr,e,t,n,s,r,a,o,l,c)>>>0}mover_pose(e,t,n,s,r,a,o,l,c,u){ie.voxelworld_mover_pose(this.__wbg_ptr,e,t,n,s,r,a,o,l,c,u)}mover_raycast(e,t,n,s,r,a,o){const l=ie.voxelworld_mover_raycast(this.__wbg_ptr,e,t,n,s,r,a,o);var c=On(l[0],l[1]).slice();return ie.__wbindgen_free(l[0],l[1]*8,8),c}mover_remove(e){ie.voxelworld_mover_remove(this.__wbg_ptr,e)}movers_carry(e){ie.voxelworld_movers_carry(this.__wbg_ptr,e)}movers_settle(e){ie.voxelworld_movers_settle(this.__wbg_ptr,e)}constructor(){const e=ie.voxelworld_new();return this.__wbg_ptr=e,No.register(this,this.__wbg_ptr,this),this}pick_body(e,t,n,s,r,a,o,l){const c=ie.voxelworld_pick_body(this.__wbg_ptr,e,t,n,s,r,a,o,l);var u=On(c[0],c[1]).slice();return ie.__wbindgen_free(c[0],c[1]*8,8),u}player_add(e,t,n){return ie.voxelworld_player_add(this.__wbg_ptr,e,t,n)>>>0}player_fits(e,t,n){return ie.voxelworld_player_fits(this.__wbg_ptr,e,t,n)!==0}player_impulse(e,t,n,s){ie.voxelworld_player_impulse(this.__wbg_ptr,e,t,n,s)}player_overlaps(e,t,n,s){return ie.voxelworld_player_overlaps(this.__wbg_ptr,e,t,n,s)!==0}player_remove(e){ie.voxelworld_player_remove(this.__wbg_ptr,e)}player_reset(e,t,n,s){ie.voxelworld_player_reset(this.__wbg_ptr,e,t,n,s)}player_restore(e,t){const n=yr(t,ie.__wbindgen_malloc),s=It;ie.voxelworld_player_restore(this.__wbg_ptr,e,n,s)}player_state(e){const t=ie.voxelworld_player_state(this.__wbg_ptr,e);var n=On(t[0],t[1]).slice();return ie.__wbindgen_free(t[0],t[1]*8,8),n}player_step(e,t,n,s,r,a,o,l,c,u,h,d){return ie.voxelworld_player_step(this.__wbg_ptr,e,t,n,s,r,a,o,l,c,u,h,d)!==0}player_tune(e,t){const n=yr(t,ie.__wbindgen_malloc),s=It;ie.voxelworld_player_tune(this.__wbg_ptr,e,n,s)}point_solid(e,t,n){return ie.voxelworld_point_solid(this.__wbg_ptr,e,t,n)!==0}projectile_capacity(){return ie.voxelworld_projectile_capacity(this.__wbg_ptr)>>>0}projectile_stride(){return ie.voxelworld_projectile_stride(this.__wbg_ptr)>>>0}projectiles_ptr(){return ie.voxelworld_projectiles_ptr(this.__wbg_ptr)>>>0}ray_exit(e,t,n,s,r,a,o){const l=ie.voxelworld_ray_exit(this.__wbg_ptr,e,t,n,s,r,a,o);var c=On(l[0],l[1]).slice();return ie.__wbindgen_free(l[0],l[1]*8,8),c}raycast(e,t,n,s,r,a,o){const l=ie.voxelworld_raycast(this.__wbg_ptr,e,t,n,s,r,a,o);var c=On(l[0],l[1]).slice();return ie.__wbindgen_free(l[0],l[1]*8,8),c}raycast_liquids(e,t,n,s,r,a,o){const l=ie.voxelworld_raycast_liquids(this.__wbg_ptr,e,t,n,s,r,a,o);var c=On(l[0],l[1]).slice();return ie.__wbindgen_free(l[0],l[1]*8,8),c}rebuild_flow(){ie.voxelworld_rebuild_flow(this.__wbg_ptr)}remove_column(e,t){ie.voxelworld_remove_column(this.__wbg_ptr,e,t)}revert_edits(){const e=ie.voxelworld_revert_edits(this.__wbg_ptr);var t=Fo(e[0],e[1]).slice();return ie.__wbindgen_free(e[0],e[1]*4,4),t}set_block(e,t,n,s){return ie.voxelworld_set_block(this.__wbg_ptr,e,t,n,s)!==0}set_destructible(e,t){const n=Cs(t,ie.__wbindgen_malloc),s=It;ie.voxelworld_set_destructible(this.__wbg_ptr,e,n,s)}set_flying(e,t){ie.voxelworld_set_flying(this.__wbg_ptr,e,t)}set_frozen(e,t){ie.voxelworld_set_frozen(this.__wbg_ptr,e,t)}set_ghost(e,t){ie.voxelworld_set_ghost(this.__wbg_ptr,e,t)}step_entities(e){ie.voxelworld_step_entities(this.__wbg_ptr,e)}sweep_body(e,t,n,s,r,a,o,l){const c=ie.voxelworld_sweep_body(this.__wbg_ptr,e,t,n,s,r,a,o,l);if(c[3])throw cr(c[2]);var u=On(c[0],c[1]).slice();return ie.__wbindgen_free(c[0],c[1]*8,8),u}target_boxes(e,t,n){const s=ie.voxelworld_target_boxes(this.__wbg_ptr,e,t,n);var r=Wn(s[0],s[1]).slice();return ie.__wbindgen_free(s[0],s[1]*1,1),r}}Symbol.dispose&&(Ta.prototype[Symbol.dispose]=Ta.prototype.free);function Yc(){const i=ie.generate_textures();var e=Wn(i[0],i[1]).slice();return ie.__wbindgen_free(i[0],i[1]*1,1),e}function $c(i){const e=su(i,ie.__wbindgen_malloc,ie.__wbindgen_realloc),t=It,n=ie.set_content(e,t);if(n[2])throw cr(n[1]);return n[0]>>>0}function Zc(){return ie.texture_layer_count()>>>0}function Jc(){return{__proto__:null,"./voxel_engine_bg.js":{__proto__:null,__wbg_Error_67e7344beaa85059:function(e,t){return Error(Fr(e,t))},__wbg___wbindgen_throw_5d9e815e6fdf150f:function(e,t){throw new Error(Fr(e,t))},__wbindgen_generic_0000000000000001:function(e,t){return Fr(e,t)},__wbindgen_init_externref_table:function(){const e=ie.__wbindgen_externrefs,t=e.grow(4);e.set(0,void 0),e.set(t+0,void 0),e.set(t+1,null),e.set(t+2,!0),e.set(t+3,!1)}}}}typeof FinalizationRegistry>"u"||new FinalizationRegistry(i=>ie.__wbg_chunkmesher_free(i,1));const ko=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(i=>ie.__wbg_culler_free(i,1));typeof FinalizationRegistry>"u"||new FinalizationRegistry(i=>ie.__wbg_terraingen_free(i,1));const No=typeof FinalizationRegistry>"u"?{register:()=>{},unregister:()=>{}}:new FinalizationRegistry(i=>ie.__wbg_voxelworld_free(i,1));function Qc(i,e){return i=i>>>0,jc().subarray(i/4,i/4+e)}function On(i,e){return i=i>>>0,Jl().subarray(i/8,i/8+e)}function Fo(i,e){return i=i>>>0,eu().subarray(i/4,i/4+e)}function Wn(i,e){return i=i>>>0,Pi().subarray(i/1,i/1+e)}let es=null;function jc(){return(es===null||es.byteLength===0)&&(es=new Float32Array(ie.memory.buffer)),es}let ts=null;function Jl(){return(ts===null||ts.byteLength===0)&&(ts=new Float64Array(ie.memory.buffer)),ts}let ns=null;function eu(){return(ns===null||ns.byteLength===0)&&(ns=new Int32Array(ie.memory.buffer)),ns}function Fr(i,e){return au(i>>>0,e)}let is=null;function tu(){return(is===null||is.byteLength===0)&&(is=new Uint16Array(ie.memory.buffer)),is}let ss=null;function nu(){return(ss===null||ss.byteLength===0)&&(ss=new Uint32Array(ie.memory.buffer)),ss}let rs=null;function Pi(){return(rs===null||rs.byteLength===0)&&(rs=new Uint8Array(ie.memory.buffer)),rs}function iu(i,e){const t=e(i.length*2,2)>>>0;return tu().set(i,t/2),It=i.length,t}function Ql(i,e){const t=e(i.length*4,4)>>>0;return nu().set(i,t/4),It=i.length,t}function Cs(i,e){const t=e(i.length*1,1)>>>0;return Pi().set(i,t/1),It=i.length,t}function yr(i,e){const t=e(i.length*8,8)>>>0;return Jl().set(i,t/8),It=i.length,t}function su(i,e,t){if(t===void 0){const o=ls.encode(i),l=e(o.length,1)>>>0;return Pi().subarray(l,l+o.length).set(o),It=o.length,l}let n=i.length,s=e(n,1)>>>0;const r=Pi();let a=0;for(;a<n;a++){const o=i.charCodeAt(a);if(o>127)break;r[s+a]=o}if(a!==n){a!==0&&(i=i.slice(a)),s=t(s,n,n=a+i.length*3,1)>>>0;const o=Pi().subarray(s+a,s+n),l=ls.encodeInto(i,o);a+=l.written,s=t(s,n,a,1)>>>0}return It=a,s}function cr(i){const e=ie.__wbindgen_externrefs.get(i);return ie.__externref_table_dealloc(i),e}let ur=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});ur.decode();const ru=2146435072;let Or=0;function au(i,e){return Or+=e,Or>=ru&&(ur=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0}),ur.decode(),Or=e),ur.decode(Pi().subarray(i,i+e))}const ls=new TextEncoder;"encodeInto"in ls||(ls.encodeInto=function(i,e){const t=ls.encode(i);return e.set(t),{read:i.length,written:t.length}});let It=0,ie;function ou(i,e){return ie=i.exports,es=null,ts=null,ns=null,is=null,ss=null,rs=null,ie.__wbindgen_start(),ie}function lu(i){if(ie!==void 0)return ie;i!==void 0&&(Object.getPrototypeOf(i)===Object.prototype?{module:i}=i:console.warn("using deprecated parameters for `initSync()`; pass a single object instead"));const e=Jc();i instanceof WebAssembly.Module||(i=new WebAssembly.Module(i));const t=new WebAssembly.Instance(i,e);return ou(t)}const cu="/assets/voxel_engine_bg-1ejYMYOZ.wasm",uu=JSON.parse('[{"drops":[],"family":"air","labelKey":"block.air","mining":{"seconds":1},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"andesite"}],"family":"andesite","labelKey":"block.andesite","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[],"family":"bedrock","labelKey":"block.bedrock","mining":{"seconds":0},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"birch_leaves"},{"count":1,"itemType":"apple"}],"family":"birch_leaves","forage":{"entries":[{"count":1,"itemType":"sapling","weight":5}],"none":95},"labelKey":"block.birch_leaves","mining":{"seconds":1},"soundGroup":"grass","support":"none"},{"drops":[{"count":1,"itemType":"birch_log"}],"family":"birch_log","labelKey":"block.birch_log","mining":{"seconds":1,"tool":"axe"},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"birch_planks"}],"family":"birch_planks","labelKey":"block.birch_planks","mining":{"seconds":1},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"black_concrete"}],"family":"black_concrete","labelKey":"block.black_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"black_stained_glass"}],"family":"black_stained_glass","labelKey":"block.black_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"black_wool"}],"family":"black_wool","labelKey":"block.black_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"blue_concrete"}],"family":"blue_concrete","labelKey":"block.blue_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"blue_stained_glass"}],"family":"blue_stained_glass","labelKey":"block.blue_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"blue_wool"}],"family":"blue_wool","labelKey":"block.blue_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"bookshelf"}],"family":"bookshelf","labelKey":"block.bookshelf","mining":{"seconds":1,"tool":"axe"},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"bricks"}],"family":"bricks","labelKey":"block.bricks","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"brown_concrete"}],"family":"brown_concrete","labelKey":"block.brown_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"brown_mushroom"}],"family":"brown_mushroom","labelKey":"block.brown_mushroom","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"brown_stained_glass"}],"family":"brown_stained_glass","labelKey":"block.brown_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"brown_wool"}],"family":"brown_wool","labelKey":"block.brown_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"cactus"}],"family":"cactus","labelKey":"block.cactus","mining":{"seconds":0.4},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"chest"}],"family":"chest","interaction":"container","labelKey":"block.chest","mining":{"seconds":1},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"coal"}],"family":"coal_ore","labelKey":"block.coal_ore","mining":{"requiresTool":true,"seconds":2,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"cobblestone"}],"family":"cobblestone","labelKey":"block.cobblestone","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"cornflower"}],"family":"cornflower","labelKey":"block.cornflower","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"crafting_table"}],"family":"crafting_table","interaction":"workbench","labelKey":"block.crafting_table","mining":{"seconds":1},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"cyan_concrete"}],"family":"cyan_concrete","labelKey":"block.cyan_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"cyan_stained_glass"}],"family":"cyan_stained_glass","labelKey":"block.cyan_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"cyan_wool"}],"family":"cyan_wool","labelKey":"block.cyan_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"dandelion"}],"family":"dandelion","labelKey":"block.dandelion","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"dead_bush"}],"family":"dead_bush","labelKey":"block.dead_bush","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"deepslate"}],"family":"deepslate","labelKey":"block.deepslate","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"blastResistance":3,"drops":[{"count":1,"itemType":"diamond_block"}],"family":"diamond_block","labelKey":"block.diamond_block","mining":{"requiresTool":true,"seconds":2,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"diamond"}],"family":"diamond_ore","labelKey":"block.diamond_ore","mining":{"requiresTool":true,"seconds":2,"tier":3,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"diorite"}],"family":"diorite","labelKey":"block.diorite","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"blastResistance":0.4,"drops":[{"count":1,"itemType":"dirt"}],"family":"dirt","labelKey":"block.dirt","mining":{"seconds":0.5,"tool":"shovel"},"soundGroup":"gravel","support":"none"},{"drops":[{"count":1,"itemType":"glass"}],"family":"glass","labelKey":"block.glass","mining":{"seconds":1},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"glowstone"}],"family":"glowstone","labelKey":"block.glowstone","mining":{"seconds":1},"soundGroup":"stone","support":"none"},{"blastResistance":3,"drops":[{"count":1,"itemType":"gold_block"}],"family":"gold_block","labelKey":"block.gold_block","mining":{"requiresTool":true,"seconds":2,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"gold_ore"}],"family":"gold_ore","labelKey":"block.gold_ore","mining":{"requiresTool":true,"seconds":2,"tier":2,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"granite"}],"family":"granite","labelKey":"block.granite","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"dirt"}],"family":"grass_block","labelKey":"block.grass_block","mining":{"seconds":1},"soundGroup":"grass","support":"none"},{"drops":[{"count":1,"itemType":"gravel"}],"family":"gravel","labelKey":"block.gravel","mining":{"seconds":0.6,"tool":"shovel"},"soundGroup":"gravel","support":"none"},{"drops":[{"count":1,"itemType":"gray_concrete"}],"family":"gray_concrete","labelKey":"block.gray_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"gray_stained_glass"}],"family":"gray_stained_glass","labelKey":"block.gray_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"gray_wool"}],"family":"gray_wool","labelKey":"block.gray_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"green_concrete"}],"family":"green_concrete","labelKey":"block.green_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"green_stained_glass"}],"family":"green_stained_glass","labelKey":"block.green_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"green_wool"}],"family":"green_wool","labelKey":"block.green_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"ice"}],"family":"ice","labelKey":"block.ice","mining":{"seconds":0.5,"tool":"pickaxe"},"soundGroup":"glass","support":"none"},{"blastResistance":3,"drops":[{"count":1,"itemType":"iron_block"}],"family":"iron_block","labelKey":"block.iron_block","mining":{"requiresTool":true,"seconds":2,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"iron_ore"}],"family":"iron_ore","labelKey":"block.iron_ore","mining":{"requiresTool":true,"seconds":2,"tier":2,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"ladder"}],"family":"ladder","labelKey":"block.ladder","mining":{"seconds":1},"soundGroup":"wood","support":"wall"},{"blastResistance":3,"drops":[{"count":1,"itemType":"lapis_block"}],"family":"lapis_block","labelKey":"block.lapis_block","mining":{"requiresTool":true,"seconds":2,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"lapis"}],"family":"lapis_ore","labelKey":"block.lapis_ore","mining":{"requiresTool":true,"seconds":2,"tier":2,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[],"family":"lava","labelKey":"block.lava","mining":{"seconds":1},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"light_blue_concrete"}],"family":"light_blue_concrete","labelKey":"block.light_blue_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"light_blue_stained_glass"}],"family":"light_blue_stained_glass","labelKey":"block.light_blue_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"light_blue_wool"}],"family":"light_blue_wool","labelKey":"block.light_blue_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"light_gray_concrete"}],"family":"light_gray_concrete","labelKey":"block.light_gray_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"light_gray_stained_glass"}],"family":"light_gray_stained_glass","labelKey":"block.light_gray_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"light_gray_wool"}],"family":"light_gray_wool","labelKey":"block.light_gray_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"lime_concrete"}],"family":"lime_concrete","labelKey":"block.lime_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"lime_stained_glass"}],"family":"lime_stained_glass","labelKey":"block.lime_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"lime_wool"}],"family":"lime_wool","labelKey":"block.lime_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"magenta_concrete"}],"family":"magenta_concrete","labelKey":"block.magenta_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"magenta_stained_glass"}],"family":"magenta_stained_glass","labelKey":"block.magenta_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"magenta_wool"}],"family":"magenta_wool","labelKey":"block.magenta_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":9,"itemType":"melon_slice"}],"family":"melon","labelKey":"block.melon","mining":{"seconds":0.5,"tool":"axe"},"soundGroup":"grass","support":"none"},{"drops":[{"count":1,"itemType":"mossy_cobblestone"}],"family":"mossy_cobblestone","labelKey":"block.mossy_cobblestone","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"mossy_stone_bricks"}],"family":"mossy_stone_bricks","labelKey":"block.mossy_stone_bricks","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"oak_leaves"},{"count":1,"itemType":"apple"}],"family":"oak_leaves","forage":{"entries":[{"count":1,"itemType":"sapling","weight":5}],"none":95},"labelKey":"block.oak_leaves","mining":{"seconds":1},"soundGroup":"grass","support":"none"},{"drops":[{"count":1,"itemType":"oak_log"}],"family":"oak_log","labelKey":"block.oak_log","mining":{"seconds":1,"tool":"axe"},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"oak_planks"}],"family":"oak_planks","labelKey":"block.oak_planks","mining":{"seconds":1},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"oak_stairs"}],"family":"oak_stairs","labelKey":"block.oak_stairs","mining":{"seconds":1},"soundGroup":"wood","support":"none"},{"blastResistance":100,"drops":[{"count":1,"itemType":"obsidian"}],"family":"obsidian","labelKey":"block.obsidian","mining":{"requiresTool":true,"seconds":6,"tier":4,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"orange_concrete"}],"family":"orange_concrete","labelKey":"block.orange_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"orange_stained_glass"}],"family":"orange_stained_glass","labelKey":"block.orange_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"orange_wool"}],"family":"orange_wool","labelKey":"block.orange_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"pink_concrete"}],"family":"pink_concrete","labelKey":"block.pink_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"pink_stained_glass"}],"family":"pink_stained_glass","labelKey":"block.pink_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"pink_wool"}],"family":"pink_wool","labelKey":"block.pink_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"poppy"}],"family":"poppy","labelKey":"block.poppy","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"pumpkin"}],"family":"pumpkin","labelKey":"block.pumpkin","mining":{"seconds":0.7,"tool":"axe"},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"purple_concrete"}],"family":"purple_concrete","labelKey":"block.purple_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"purple_stained_glass"}],"family":"purple_stained_glass","labelKey":"block.purple_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"purple_wool"}],"family":"purple_wool","labelKey":"block.purple_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"red_concrete"}],"family":"red_concrete","labelKey":"block.red_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"red_mushroom"}],"family":"red_mushroom","labelKey":"block.red_mushroom","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"red_stained_glass"}],"family":"red_stained_glass","labelKey":"block.red_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"red_wool"}],"family":"red_wool","labelKey":"block.red_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"sand"}],"family":"sand","labelKey":"block.sand","mining":{"seconds":1},"soundGroup":"sand","support":"none"},{"drops":[{"count":1,"itemType":"sandstone"}],"family":"sandstone","labelKey":"block.sandstone","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"sapling"}],"family":"sapling","labelKey":"block.sapling","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"plant_fiber"}],"family":"short_grass","forage":{"entries":[{"count":1,"itemType":"wheat","weight":150},{"count":1,"itemType":"carrot","weight":40},{"count":1,"itemType":"potato","weight":40},{"count":1,"itemType":"cocoa_beans","weight":20},{"count":1,"itemType":"sugar_cane","weight":20},{"count":1,"itemType":"egg","weight":10},{"count":1,"itemType":"melon_slice","weight":20},{"count":1,"itemType":"pumpkin","weight":5}],"none":695},"labelKey":"block.short_grass","mining":{"seconds":1},"soundGroup":"grass","support":"below"},{"drops":[{"count":1,"itemType":"snow"}],"family":"snow","labelKey":"block.snow","mining":{"seconds":0.4,"tool":"shovel"},"soundGroup":"sand","support":"none"},{"drops":[{"count":1,"itemType":"dirt"}],"family":"snowy_grass","labelKey":"block.snowy_grass","mining":{"seconds":0.5,"tool":"shovel"},"soundGroup":"grass","support":"none"},{"drops":[{"count":1,"itemType":"sponge"}],"family":"sponge","labelKey":"block.sponge","mining":{"seconds":0.5},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"spruce_leaves"},{"count":1,"itemType":"apple"}],"family":"spruce_leaves","forage":{"entries":[{"count":1,"itemType":"sapling","weight":5}],"none":95},"labelKey":"block.spruce_leaves","mining":{"seconds":1},"soundGroup":"grass","support":"none"},{"drops":[{"count":1,"itemType":"spruce_log"}],"family":"spruce_log","labelKey":"block.spruce_log","mining":{"seconds":1,"tool":"axe"},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"spruce_planks"}],"family":"spruce_planks","labelKey":"block.spruce_planks","mining":{"seconds":1},"soundGroup":"wood","support":"none"},{"blastResistance":1.5,"drops":[{"count":1,"itemType":"stone"}],"family":"stone","labelKey":"block.stone","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"stone_bricks"}],"family":"stone_bricks","labelKey":"block.stone_bricks","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"stone_slab"}],"family":"stone_slab","labelKey":"block.stone_slab","mining":{"seconds":1},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"sugar_cane"}],"family":"sugar_cane","labelKey":"block.sugar_cane","mining":{"seconds":0.25},"soundGroup":"grass","support":"below"},{"blastResistance":0.1,"drops":[{"count":1,"itemType":"tnt"}],"explosive":{"damage":18,"fuse":120,"radius":3},"family":"tnt","labelKey":"block.tnt","mining":{"seconds":1},"soundGroup":"wood","support":"none"},{"drops":[{"count":1,"itemType":"torch"}],"family":"torch","labelKey":"block.torch","mining":{"seconds":1},"soundGroup":"stone","support":"below"},{"drops":[],"family":"water","labelKey":"block.water","mining":{"seconds":1},"soundGroup":"water","support":"none"},{"drops":[{"count":1,"itemType":"white_concrete"}],"family":"white_concrete","labelKey":"block.white_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"white_stained_glass"}],"family":"white_stained_glass","labelKey":"block.white_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"white_wool"}],"family":"white_wool","labelKey":"block.white_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"},{"drops":[{"count":1,"itemType":"yellow_concrete"}],"family":"yellow_concrete","labelKey":"block.yellow_concrete","mining":{"requiresTool":true,"seconds":1.5,"tier":1,"tool":"pickaxe"},"soundGroup":"stone","support":"none"},{"drops":[{"count":1,"itemType":"yellow_stained_glass"}],"family":"yellow_stained_glass","labelKey":"block.yellow_stained_glass","mining":{"seconds":0.5},"soundGroup":"glass","support":"none"},{"drops":[{"count":1,"itemType":"yellow_wool"}],"family":"yellow_wool","labelKey":"block.yellow_wool","mining":{"seconds":0.6},"soundGroup":"cloth","support":"none"}]'),du=JSON.parse('[{"breakable":false,"double":0,"name":"air","opacity":0,"opaque":false,"placeable":false,"replaceable":true,"shape":"air","solid":false,"state":"","tex":[0,0,0,0,0,0]},{"double":0,"name":"andesite","shape":"cube","state":"","tex":[50,50,50,50,50,50]},{"breakable":false,"double":0,"name":"bedrock","placeable":false,"shape":"cube","state":"","tex":[6,6,6,6,6,6]},{"double":0,"layer":1,"leaves":true,"name":"birch_leaves","opacity":1,"opaque":false,"shape":"cube","state":"","tex":[27,27,27,27,27,27],"tint":false},{"double":0,"name":"birch_log","shape":"cube","state":"","tex":[25,25,26,26,25,25]},{"double":0,"name":"birch_planks","shape":"cube","state":"","tex":[63,63,63,63,63,63]},{"double":0,"name":"black_concrete","shape":"cube","state":"","tex":[69,69,69,69,69,69]},{"cull_self":true,"double":0,"layer":2,"name":"black_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[140,140,140,140,140,140]},{"double":0,"name":"black_wool","shape":"cube","state":"","tex":[60,60,60,60,60,60]},{"double":0,"name":"blue_concrete","shape":"cube","state":"","tex":[106,106,106,106,106,106]},{"cull_self":true,"double":0,"layer":2,"name":"blue_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[136,136,136,136,136,136]},{"double":0,"name":"blue_wool","shape":"cube","state":"","tex":[59,59,59,59,59,59]},{"double":0,"name":"bookshelf","shape":"cube","state":"","tex":[46,46,46,46,46,46]},{"double":0,"name":"bricks","shape":"cube","state":"","tex":[40,40,40,40,40,40]},{"double":0,"name":"brown_concrete","shape":"cube","state":"","tex":[107,107,107,107,107,107]},{"double":0,"layer":1,"name":"brown_mushroom","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[64,64,64,64,64,64]},{"cull_self":true,"double":0,"layer":2,"name":"brown_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[137,137,137,137,137,137]},{"double":0,"name":"brown_wool","shape":"cube","state":"","tex":[124,124,124,124,124,124]},{"double":0,"name":"cactus","shape":"cube","state":"","tex":[31,31,32,32,31,31]},{"double":0,"name":"chest","shape":"cube","state":"","tex":[5,5,5,5,5,5]},{"double":0,"name":"coal_ore","shape":"cube","state":"","tex":[19,19,19,19,19,19]},{"double":0,"name":"cobblestone","shape":"cube","state":"","tex":[4,4,4,4,4,4]},{"double":0,"layer":1,"name":"cornflower","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[37,37,37,37,37,37]},{"double":0,"name":"crafting_table","shape":"cube","state":"","tex":[5,5,5,5,5,5]},{"double":0,"name":"cyan_concrete","shape":"cube","state":"","tex":[104,104,104,104,104,104]},{"cull_self":true,"double":0,"layer":2,"name":"cyan_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[134,134,134,134,134,134]},{"double":0,"name":"cyan_wool","shape":"cube","state":"","tex":[122,122,122,122,122,122]},{"double":0,"layer":1,"name":"dandelion","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[35,35,35,35,35,35]},{"double":0,"layer":1,"name":"dead_bush","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[38,38,38,38,38,38]},{"double":0,"name":"deepslate","shape":"cube","state":"","tex":[51,51,51,51,51,51]},{"double":0,"name":"diamond_block","shape":"cube","state":"","tex":[142,142,142,142,142,142]},{"double":0,"name":"diamond_ore","shape":"cube","state":"","tex":[22,22,22,22,22,22]},{"double":0,"name":"diorite","shape":"cube","state":"","tex":[49,49,49,49,49,49]},{"double":0,"name":"dirt","shape":"cube","state":"","tex":[3,3,3,3,3,3]},{"cull_self":true,"double":0,"layer":1,"name":"glass","opacity":0,"opaque":false,"shape":"cube","state":"","tex":[12,12,12,12,12,12]},{"double":0,"emit":15,"name":"glowstone","shape":"cube","state":"","tex":[39,39,39,39,39,39]},{"double":0,"name":"gold_block","shape":"cube","state":"","tex":[141,141,141,141,141,141]},{"double":0,"name":"gold_ore","shape":"cube","state":"","tex":[21,21,21,21,21,21]},{"double":0,"name":"granite","shape":"cube","state":"","tex":[48,48,48,48,48,48]},{"double":0,"name":"grass_block","shape":"cube","state":"","tex":[2,2,1,3,2,2],"tint":true},{"double":0,"name":"gravel","shape":"cube","state":"","tex":[8,8,8,8,8,8]},{"double":0,"name":"gray_concrete","shape":"cube","state":"","tex":[68,68,68,68,68,68]},{"cull_self":true,"double":0,"layer":2,"name":"gray_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[132,132,132,132,132,132]},{"double":0,"name":"gray_wool","shape":"cube","state":"","tex":[120,120,120,120,120,120]},{"double":0,"name":"green_concrete","shape":"cube","state":"","tex":[108,108,108,108,108,108]},{"cull_self":true,"double":0,"layer":2,"name":"green_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[138,138,138,138,138,138]},{"double":0,"name":"green_wool","shape":"cube","state":"","tex":[58,58,58,58,58,58]},{"cull_self":true,"double":0,"layer":2,"name":"ice","opacity":1,"opaque":false,"shape":"cube","state":"","tex":[18,18,18,18,18,18]},{"double":0,"name":"iron_block","shape":"cube","state":"","tex":[71,71,71,71,71,71]},{"double":0,"name":"iron_ore","shape":"cube","state":"","tex":[20,20,20,20,20,20]},{"boxes":[[1,0,14,3,16,16],[13,0,14,15,16,16],[1,3,14,15,5,16],[1,11,14,15,13,16]],"climbable":true,"double":0,"facing":1,"name":"ladder","opacity":0,"opaque":false,"placeable":false,"shape":"boxes","solid":false,"state":"facing=east","tex":[5,5,5,5,5,5],"turn":1},{"boxes":[[1,0,14,3,16,16],[13,0,14,15,16,16],[1,3,14,15,5,16],[1,11,14,15,13,16]],"climbable":true,"double":0,"facing":0,"name":"ladder","opacity":0,"opaque":false,"placeable":true,"shape":"boxes","solid":false,"state":"facing=north","tex":[5,5,5,5,5,5],"turn":0},{"boxes":[[1,0,14,3,16,16],[13,0,14,15,16,16],[1,3,14,15,5,16],[1,11,14,15,13,16]],"climbable":true,"double":0,"facing":2,"name":"ladder","opacity":0,"opaque":false,"placeable":false,"shape":"boxes","solid":false,"state":"facing=south","tex":[5,5,5,5,5,5],"turn":2},{"boxes":[[1,0,14,3,16,16],[13,0,14,15,16,16],[1,3,14,15,5,16],[1,11,14,15,13,16]],"climbable":true,"double":0,"facing":3,"name":"ladder","opacity":0,"opaque":false,"placeable":false,"shape":"boxes","solid":false,"state":"facing=west","tex":[5,5,5,5,5,5],"turn":3},{"double":0,"name":"lapis_block","shape":"cube","state":"","tex":[143,143,143,143,143,143]},{"double":0,"name":"lapis_ore","shape":"cube","state":"","tex":[24,24,24,24,24,24]},{"breakable":false,"double":0,"emit":15,"name":"lava","opacity":15,"opaque":false,"replaceable":true,"shape":"liquid","solid":false,"state":"","tex":[14,14,14,14,14,14]},{"double":0,"name":"light_blue_concrete","shape":"cube","state":"","tex":[100,100,100,100,100,100]},{"cull_self":true,"double":0,"layer":2,"name":"light_blue_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[128,128,128,128,128,128]},{"double":0,"name":"light_blue_wool","shape":"cube","state":"","tex":[117,117,117,117,117,117]},{"double":0,"name":"light_gray_concrete","shape":"cube","state":"","tex":[67,67,67,67,67,67]},{"cull_self":true,"double":0,"layer":2,"name":"light_gray_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[133,133,133,133,133,133]},{"double":0,"name":"light_gray_wool","shape":"cube","state":"","tex":[121,121,121,121,121,121]},{"double":0,"name":"lime_concrete","shape":"cube","state":"","tex":[102,102,102,102,102,102]},{"cull_self":true,"double":0,"layer":2,"name":"lime_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[130,130,130,130,130,130]},{"double":0,"name":"lime_wool","shape":"cube","state":"","tex":[118,118,118,118,118,118]},{"double":0,"name":"magenta_concrete","shape":"cube","state":"","tex":[99,99,99,99,99,99]},{"cull_self":true,"double":0,"layer":2,"name":"magenta_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[127,127,127,127,127,127]},{"double":0,"name":"magenta_wool","shape":"cube","state":"","tex":[116,116,116,116,116,116]},{"double":0,"name":"melon","shape":"cube","state":"","tex":[148,148,148,148,148,148]},{"double":0,"name":"mossy_cobblestone","shape":"cube","state":"","tex":[42,42,42,42,42,42]},{"double":0,"name":"mossy_stone_bricks","shape":"cube","state":"","tex":[147,147,147,147,147,147]},{"double":0,"layer":1,"leaves":true,"name":"oak_leaves","opacity":1,"opaque":false,"shape":"cube","state":"","tex":[11,11,11,11,11,11],"tint":true},{"double":0,"name":"oak_log","shape":"cube","state":"","tex":[9,9,10,10,9,9]},{"double":0,"name":"oak_planks","shape":"cube","state":"","tex":[5,5,5,5,5,5]},{"double":0,"facing":1,"name":"oak_stairs","placeable":false,"shape":"stairs","state":"facing=east,half=bottom","tex":[5,5,5,5,5,5],"top":false},{"double":0,"facing":1,"name":"oak_stairs","placeable":false,"shape":"stairs","state":"facing=east,half=top","tex":[5,5,5,5,5,5],"top":true},{"double":0,"facing":0,"name":"oak_stairs","placeable":true,"shape":"stairs","state":"facing=north,half=bottom","tex":[5,5,5,5,5,5],"top":false},{"double":0,"facing":0,"name":"oak_stairs","placeable":false,"shape":"stairs","state":"facing=north,half=top","tex":[5,5,5,5,5,5],"top":true},{"double":0,"facing":2,"name":"oak_stairs","placeable":false,"shape":"stairs","state":"facing=south,half=bottom","tex":[5,5,5,5,5,5],"top":false},{"double":0,"facing":2,"name":"oak_stairs","placeable":false,"shape":"stairs","state":"facing=south,half=top","tex":[5,5,5,5,5,5],"top":true},{"double":0,"facing":3,"name":"oak_stairs","placeable":false,"shape":"stairs","state":"facing=west,half=bottom","tex":[5,5,5,5,5,5],"top":false},{"double":0,"facing":3,"name":"oak_stairs","placeable":false,"shape":"stairs","state":"facing=west,half=top","tex":[5,5,5,5,5,5],"top":true},{"double":0,"name":"obsidian","shape":"cube","state":"","tex":[45,45,45,45,45,45]},{"double":0,"name":"orange_concrete","shape":"cube","state":"","tex":[98,98,98,98,98,98]},{"cull_self":true,"double":0,"layer":2,"name":"orange_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[126,126,126,126,126,126]},{"double":0,"name":"orange_wool","shape":"cube","state":"","tex":[115,115,115,115,115,115]},{"double":0,"name":"pink_concrete","shape":"cube","state":"","tex":[103,103,103,103,103,103]},{"cull_self":true,"double":0,"layer":2,"name":"pink_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[131,131,131,131,131,131]},{"double":0,"name":"pink_wool","shape":"cube","state":"","tex":[119,119,119,119,119,119]},{"double":0,"layer":1,"name":"poppy","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[36,36,36,36,36,36]},{"double":0,"name":"pumpkin","shape":"cube","state":"","tex":[145,145,145,145,145,145]},{"double":0,"name":"purple_concrete","shape":"cube","state":"","tex":[105,105,105,105,105,105]},{"cull_self":true,"double":0,"layer":2,"name":"purple_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[135,135,135,135,135,135]},{"double":0,"name":"purple_wool","shape":"cube","state":"","tex":[123,123,123,123,123,123]},{"double":0,"name":"red_concrete","shape":"cube","state":"","tex":[70,70,70,70,70,70]},{"double":0,"layer":1,"name":"red_mushroom","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[65,65,65,65,65,65]},{"cull_self":true,"double":0,"layer":2,"name":"red_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[139,139,139,139,139,139]},{"double":0,"name":"red_wool","shape":"cube","state":"","tex":[56,56,56,56,56,56]},{"double":0,"name":"sand","shape":"cube","state":"","tex":[7,7,7,7,7,7]},{"double":0,"name":"sandstone","shape":"cube","state":"","tex":[15,15,16,16,15,15]},{"double":0,"layer":1,"name":"sapling","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[34,34,34,34,34,34]},{"double":0,"layer":1,"name":"short_grass","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[33,33,33,33,33,33],"tint":true},{"double":0,"name":"snow","shape":"cube","state":"","tex":[17,17,17,17,17,17]},{"double":0,"name":"snowy_grass","shape":"cube","state":"","tex":[44,44,17,3,44,44]},{"double":0,"name":"sponge","shape":"cube","state":"","tex":[144,144,144,144,144,144]},{"double":0,"layer":1,"leaves":true,"name":"spruce_leaves","opacity":1,"opaque":false,"shape":"cube","state":"","tex":[30,30,30,30,30,30],"tint":true},{"double":0,"name":"spruce_log","shape":"cube","state":"","tex":[28,28,29,29,28,28]},{"double":0,"name":"spruce_planks","shape":"cube","state":"","tex":[62,62,62,62,62,62]},{"double":0,"name":"stone","shape":"cube","state":"","tex":[0,0,0,0,0,0]},{"double":0,"name":"stone_bricks","shape":"cube","state":"","tex":[41,41,41,41,41,41]},{"double":109,"name":"stone_slab","shape":"slab","state":"half=bottom","tex":[0,0,0,0,0,0]},{"double":109,"name":"stone_slab","placeable":false,"shape":"slab","state":"half=top","tex":[0,0,0,0,0,0],"top":true},{"double":0,"layer":1,"name":"sugar_cane","opacity":0,"opaque":false,"replaceable":true,"shape":"cross","solid":false,"state":"","tex":[146,146,146,146,146,146]},{"double":0,"name":"tnt","shape":"cube","state":"","tex":[113,113,114,114,113,113]},{"double":0,"emit":14,"layer":1,"name":"torch","opacity":0,"opaque":false,"shape":"torch","solid":false,"state":"","tex":[47,47,47,47,47,47]},{"breakable":false,"double":0,"layer":2,"name":"water","opacity":1,"opaque":false,"replaceable":true,"shape":"liquid","solid":false,"state":"","tex":[13,13,13,13,13,13]},{"double":0,"name":"white_concrete","shape":"cube","state":"","tex":[66,66,66,66,66,66]},{"cull_self":true,"double":0,"layer":2,"name":"white_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[125,125,125,125,125,125]},{"double":0,"name":"white_wool","shape":"cube","state":"","tex":[55,55,55,55,55,55]},{"double":0,"name":"yellow_concrete","shape":"cube","state":"","tex":[101,101,101,101,101,101]},{"cull_self":true,"double":0,"layer":2,"name":"yellow_stained_glass","opacity":0,"opaque":false,"shape":"cube","solid":true,"state":"","tex":[129,129,129,129,129,129]},{"double":0,"name":"yellow_wool","shape":"cube","state":"","tex":[57,57,57,57,57,57]}]'),hu="368b605ac5bdf5ff6fcf4af02f7174cbc6d39b5110f48e0a41b231a0a6479464",fu=256,pu=JSON.parse('[{"itemType":"andesite","labelKey":"item.andesite","maxStack":64,"places":"andesite"},{"food":4,"itemType":"apple","labelKey":"item.apple","maxStack":64,"model":"apple"},{"food":5,"itemType":"baked_potato","labelKey":"item.baked_potato","material":"oak_planks","maxStack":64,"model":"potato"},{"itemType":"birch_leaves","labelKey":"item.birch_leaves","maxStack":64,"places":"birch_leaves","tags":["leaves"]},{"itemType":"birch_log","labelKey":"item.birch_log","maxStack":64,"places":"birch_log","tags":["logs"]},{"itemType":"birch_planks","labelKey":"item.birch_planks","maxStack":64,"places":"birch_planks","tags":["planks"]},{"itemType":"black_concrete","labelKey":"item.black_concrete","maxStack":64,"places":"black_concrete"},{"itemType":"black_pigment","labelKey":"item.black_pigment","material":"black_concrete","maxStack":64,"model":"powder"},{"itemType":"black_stained_glass","labelKey":"item.black_stained_glass","maxStack":64,"places":"black_stained_glass"},{"itemType":"black_wool","labelKey":"item.black_wool","maxStack":64,"places":"black_wool"},{"itemType":"blue_concrete","labelKey":"item.blue_concrete","maxStack":64,"places":"blue_concrete"},{"itemType":"blue_pigment","labelKey":"item.blue_pigment","material":"blue_concrete","maxStack":64,"model":"powder"},{"itemType":"blue_stained_glass","labelKey":"item.blue_stained_glass","maxStack":64,"places":"blue_stained_glass"},{"itemType":"blue_wool","labelKey":"item.blue_wool","maxStack":64,"places":"blue_wool"},{"itemType":"bookshelf","labelKey":"item.bookshelf","maxStack":64,"places":"bookshelf"},{"food":5,"itemType":"bread","labelKey":"item.bread","material":"oak_planks","maxStack":64,"model":"loaf"},{"itemType":"bricks","labelKey":"item.bricks","maxStack":64,"places":"bricks"},{"itemType":"brown_concrete","labelKey":"item.brown_concrete","maxStack":64,"places":"brown_concrete"},{"itemType":"brown_mushroom","labelKey":"item.brown_mushroom","maxStack":64,"places":"brown_mushroom"},{"itemType":"brown_pigment","labelKey":"item.brown_pigment","material":"brown_concrete","maxStack":64,"model":"powder"},{"itemType":"brown_stained_glass","labelKey":"item.brown_stained_glass","maxStack":64,"places":"brown_stained_glass"},{"itemType":"brown_wool","labelKey":"item.brown_wool","maxStack":64,"places":"brown_wool"},{"collects":{"family":"water","result":"water_bucket"},"itemType":"bucket","labelKey":"item.bucket","material":"iron_block","maxStack":1,"model":"bucket"},{"itemType":"cactus","labelKey":"item.cactus","maxStack":64,"places":"cactus"},{"food":10,"itemType":"cake","labelKey":"item.cake","material":"white_wool","maxStack":16,"model":"cake"},{"food":3,"itemType":"carrot","labelKey":"item.carrot","material":"orange_concrete","maxStack":64,"model":"carrot"},{"itemType":"charcoal","labelKey":"item.charcoal","maxStack":64,"model":"powder","tags":["fuel"]},{"itemType":"chest","labelKey":"item.chest","maxStack":64,"places":"chest"},{"itemType":"coal","labelKey":"item.coal","material":"bedrock","maxStack":64,"model":"powder","tags":["fuel"]},{"itemType":"coal_ore","labelKey":"item.coal_ore","maxStack":64,"places":"coal_ore"},{"itemType":"cobblestone","labelKey":"item.cobblestone","maxStack":64,"places":"cobblestone"},{"itemType":"cocoa_beans","labelKey":"item.cocoa_beans","material":"brown_wool","maxStack":64,"model":"gem"},{"food":2,"itemType":"cookie","labelKey":"item.cookie","material":"brown_wool","maxStack":64,"model":"cookie"},{"itemType":"cornflower","labelKey":"item.cornflower","maxStack":64,"places":"cornflower"},{"itemType":"crafting_table","labelKey":"item.crafting_table","maxStack":64,"places":"crafting_table"},{"itemType":"cyan_concrete","labelKey":"item.cyan_concrete","maxStack":64,"places":"cyan_concrete"},{"itemType":"cyan_pigment","labelKey":"item.cyan_pigment","material":"cyan_concrete","maxStack":64,"model":"powder"},{"itemType":"cyan_stained_glass","labelKey":"item.cyan_stained_glass","maxStack":64,"places":"cyan_stained_glass"},{"itemType":"cyan_wool","labelKey":"item.cyan_wool","maxStack":64,"places":"cyan_wool"},{"itemType":"dandelion","labelKey":"item.dandelion","maxStack":64,"places":"dandelion"},{"itemType":"dead_bush","labelKey":"item.dead_bush","maxStack":64,"places":"dead_bush"},{"itemType":"deepslate","labelKey":"item.deepslate","maxStack":64,"places":"deepslate"},{"itemType":"diamond","labelKey":"item.diamond","material":"diamond_block","maxStack":64,"model":"gem"},{"combat":{"cooldown":18,"damage":7,"reach":3},"durability":400,"itemType":"diamond_axe","labelKey":"item.diamond_axe","material":"diamond_block","maxStack":1,"model":"axe","tool":{"kind":"axe","speed":9,"tier":4}},{"itemType":"diamond_block","labelKey":"item.diamond_block","maxStack":64,"places":"diamond_block"},{"itemType":"diamond_ore","labelKey":"item.diamond_ore","maxStack":64,"places":"diamond_ore"},{"combat":{"cooldown":15,"damage":6,"reach":3},"durability":400,"itemType":"diamond_pickaxe","labelKey":"item.diamond_pickaxe","material":"diamond_block","maxStack":1,"model":"pickaxe","tool":{"kind":"pickaxe","speed":9,"tier":4}},{"combat":{"cooldown":15,"damage":6,"reach":3},"durability":400,"itemType":"diamond_shovel","labelKey":"item.diamond_shovel","material":"diamond_block","maxStack":1,"model":"shovel","tool":{"kind":"shovel","speed":9,"tier":4}},{"itemType":"diorite","labelKey":"item.diorite","maxStack":64,"places":"diorite"},{"itemType":"dirt","labelKey":"item.dirt","maxStack":64,"places":"dirt"},{"itemType":"egg","labelKey":"item.egg","material":"white_wool","maxStack":64,"model":"potato"},{"durability":64,"equipment":"legs","itemType":"feather_talisman","labelKey":"item.feather_talisman","maxStack":1,"model":"talisman","perks":{"fallImmune":true}},{"durability":64,"igniter":true,"itemType":"firestarter","labelKey":"item.firestarter","maxStack":1,"model":"igniter"},{"itemType":"glass","labelKey":"item.glass","maxStack":64,"places":"glass"},{"durability":120,"equipment":"head","itemType":"glow_talisman","labelKey":"item.glow_talisman","maxStack":1,"model":"talisman","perks":{"vision":true}},{"itemType":"glowstone","labelKey":"item.glowstone","maxStack":64,"places":"glowstone"},{"itemType":"gold_block","labelKey":"item.gold_block","maxStack":64,"places":"gold_block"},{"itemType":"gold_ingot","labelKey":"item.gold_ingot","material":"gold_block","maxStack":64,"model":"ingot"},{"itemType":"gold_ore","labelKey":"item.gold_ore","maxStack":64,"places":"gold_ore"},{"food":8,"itemType":"golden_carrot","labelKey":"item.golden_carrot","material":"gold_block","maxStack":64,"model":"carrot"},{"itemType":"granite","labelKey":"item.granite","maxStack":64,"places":"granite"},{"itemType":"grass_block","labelKey":"item.grass_block","maxStack":64,"places":"grass_block"},{"itemType":"gravel","labelKey":"item.gravel","maxStack":64,"places":"gravel"},{"itemType":"gray_concrete","labelKey":"item.gray_concrete","maxStack":64,"places":"gray_concrete"},{"itemType":"gray_pigment","labelKey":"item.gray_pigment","material":"gray_concrete","maxStack":64,"model":"powder"},{"itemType":"gray_stained_glass","labelKey":"item.gray_stained_glass","maxStack":64,"places":"gray_stained_glass"},{"itemType":"gray_wool","labelKey":"item.gray_wool","maxStack":64,"places":"gray_wool"},{"itemType":"green_concrete","labelKey":"item.green_concrete","maxStack":64,"places":"green_concrete"},{"itemType":"green_pigment","labelKey":"item.green_pigment","material":"green_concrete","maxStack":64,"model":"powder"},{"itemType":"green_stained_glass","labelKey":"item.green_stained_glass","maxStack":64,"places":"green_stained_glass"},{"itemType":"green_wool","labelKey":"item.green_wool","maxStack":64,"places":"green_wool"},{"itemType":"gunpowder","labelKey":"item.gunpowder","maxStack":64,"model":"powder"},{"durability":120,"equipment":"offhand","itemType":"heavy_shield","labelKey":"item.heavy_shield","maxStack":1,"model":"shield","modifiers":{"armor":0.5,"speed":0.8}},{"durability":120,"equipment":"head","itemType":"helios_medallion","labelKey":"item.helios_medallion","maxStack":1,"model":"medallion","perks":{"sunRegen":true}},{"durability":120,"equipment":"feet","itemType":"helium_boots","labelKey":"item.helium_boots","maxStack":1,"model":"boots","modifiers":{"jump":1.6}},{"itemType":"ice","labelKey":"item.ice","maxStack":64,"places":"ice"},{"combat":{"cooldown":18,"damage":6,"reach":3},"durability":251,"itemType":"iron_axe","labelKey":"item.iron_axe","material":"iron_block","maxStack":1,"model":"axe","tool":{"kind":"axe","speed":7,"tier":3}},{"itemType":"iron_block","labelKey":"item.iron_block","maxStack":64,"places":"iron_block"},{"itemType":"iron_ingot","labelKey":"item.iron_ingot","material":"iron_block","maxStack":64,"model":"ingot"},{"itemType":"iron_ore","labelKey":"item.iron_ore","maxStack":64,"places":"iron_ore"},{"combat":{"cooldown":15,"damage":5,"reach":3},"durability":251,"itemType":"iron_pickaxe","labelKey":"item.iron_pickaxe","material":"iron_block","maxStack":1,"model":"pickaxe","tool":{"kind":"pickaxe","speed":7,"tier":3}},{"combat":{"cooldown":15,"damage":5,"reach":3},"durability":251,"itemType":"iron_shovel","labelKey":"item.iron_shovel","material":"iron_block","maxStack":1,"model":"shovel","tool":{"kind":"shovel","speed":7,"tier":3}},{"durability":240,"equipment":"body","itemType":"iron_vest","labelKey":"item.iron_vest","material":"iron_block","maxStack":1,"model":"armor","modifiers":{"armor":0.2,"speed":0.95}},{"itemType":"ladder","labelKey":"item.ladder","maxStack":64,"places":"ladder"},{"itemType":"lapis","labelKey":"item.lapis","material":"lapis_block","maxStack":64,"model":"gem"},{"itemType":"lapis_block","labelKey":"item.lapis_block","maxStack":64,"places":"lapis_block"},{"itemType":"lapis_ore","labelKey":"item.lapis_ore","maxStack":64,"places":"lapis_ore"},{"itemType":"lava","labelKey":"item.lava","maxStack":64,"places":"lava"},{"itemType":"light_blue_concrete","labelKey":"item.light_blue_concrete","maxStack":64,"places":"light_blue_concrete"},{"itemType":"light_blue_pigment","labelKey":"item.light_blue_pigment","material":"light_blue_concrete","maxStack":64,"model":"powder"},{"itemType":"light_blue_stained_glass","labelKey":"item.light_blue_stained_glass","maxStack":64,"places":"light_blue_stained_glass"},{"itemType":"light_blue_wool","labelKey":"item.light_blue_wool","maxStack":64,"places":"light_blue_wool"},{"itemType":"light_gray_concrete","labelKey":"item.light_gray_concrete","maxStack":64,"places":"light_gray_concrete"},{"itemType":"light_gray_pigment","labelKey":"item.light_gray_pigment","material":"light_gray_concrete","maxStack":64,"model":"powder"},{"itemType":"light_gray_stained_glass","labelKey":"item.light_gray_stained_glass","maxStack":64,"places":"light_gray_stained_glass"},{"itemType":"light_gray_wool","labelKey":"item.light_gray_wool","maxStack":64,"places":"light_gray_wool"},{"itemType":"lime_concrete","labelKey":"item.lime_concrete","maxStack":64,"places":"lime_concrete"},{"itemType":"lime_pigment","labelKey":"item.lime_pigment","material":"lime_concrete","maxStack":64,"model":"powder"},{"itemType":"lime_stained_glass","labelKey":"item.lime_stained_glass","maxStack":64,"places":"lime_stained_glass"},{"itemType":"lime_wool","labelKey":"item.lime_wool","maxStack":64,"places":"lime_wool"},{"itemType":"magenta_concrete","labelKey":"item.magenta_concrete","maxStack":64,"places":"magenta_concrete"},{"itemType":"magenta_pigment","labelKey":"item.magenta_pigment","material":"magenta_concrete","maxStack":64,"model":"powder"},{"itemType":"magenta_stained_glass","labelKey":"item.magenta_stained_glass","maxStack":64,"places":"magenta_stained_glass"},{"itemType":"magenta_wool","labelKey":"item.magenta_wool","maxStack":64,"places":"magenta_wool"},{"itemType":"melon","labelKey":"item.melon","maxStack":64,"places":"melon"},{"food":2,"itemType":"melon_slice","labelKey":"item.melon_slice","material":"red_wool","maxStack":64,"model":"melon"},{"itemType":"mossy_cobblestone","labelKey":"item.mossy_cobblestone","maxStack":64,"places":"mossy_cobblestone"},{"itemType":"mossy_stone_bricks","labelKey":"item.mossy_stone_bricks","maxStack":64,"places":"mossy_stone_bricks"},{"itemType":"oak_leaves","labelKey":"item.oak_leaves","maxStack":64,"places":"oak_leaves","tags":["leaves"]},{"itemType":"oak_log","labelKey":"item.oak_log","maxStack":64,"places":"oak_log","tags":["logs"]},{"itemType":"oak_planks","labelKey":"item.oak_planks","maxStack":64,"places":"oak_planks","tags":["planks"]},{"itemType":"oak_stairs","labelKey":"item.oak_stairs","maxStack":64,"places":"oak_stairs"},{"itemType":"obsidian","labelKey":"item.obsidian","maxStack":64,"places":"obsidian"},{"itemType":"orange_concrete","labelKey":"item.orange_concrete","maxStack":64,"places":"orange_concrete"},{"itemType":"orange_pigment","labelKey":"item.orange_pigment","material":"orange_concrete","maxStack":64,"model":"powder"},{"itemType":"orange_stained_glass","labelKey":"item.orange_stained_glass","maxStack":64,"places":"orange_stained_glass"},{"itemType":"orange_wool","labelKey":"item.orange_wool","maxStack":64,"places":"orange_wool"},{"itemType":"paper","labelKey":"item.paper","material":"white_wool","maxStack":64,"model":"sheet"},{"itemType":"pink_concrete","labelKey":"item.pink_concrete","maxStack":64,"places":"pink_concrete"},{"itemType":"pink_pigment","labelKey":"item.pink_pigment","material":"pink_concrete","maxStack":64,"model":"powder"},{"itemType":"pink_stained_glass","labelKey":"item.pink_stained_glass","maxStack":64,"places":"pink_stained_glass"},{"itemType":"pink_wool","labelKey":"item.pink_wool","maxStack":64,"places":"pink_wool"},{"itemType":"plant_fiber","labelKey":"item.plant_fiber","material":"oak_leaves","maxStack":64,"model":"fiber"},{"itemType":"poppy","labelKey":"item.poppy","maxStack":64,"places":"poppy"},{"food":1,"itemType":"potato","labelKey":"item.potato","material":"brown_wool","maxStack":64,"model":"potato"},{"itemType":"pumpkin","labelKey":"item.pumpkin","maxStack":64,"places":"pumpkin"},{"itemType":"purple_concrete","labelKey":"item.purple_concrete","maxStack":64,"places":"purple_concrete"},{"itemType":"purple_pigment","labelKey":"item.purple_pigment","material":"purple_concrete","maxStack":64,"model":"powder"},{"itemType":"purple_stained_glass","labelKey":"item.purple_stained_glass","maxStack":64,"places":"purple_stained_glass"},{"itemType":"purple_wool","labelKey":"item.purple_wool","maxStack":64,"places":"purple_wool"},{"itemType":"red_concrete","labelKey":"item.red_concrete","maxStack":64,"places":"red_concrete"},{"itemType":"red_mushroom","labelKey":"item.red_mushroom","maxStack":64,"places":"red_mushroom"},{"itemType":"red_pigment","labelKey":"item.red_pigment","material":"red_concrete","maxStack":64,"model":"powder"},{"itemType":"red_stained_glass","labelKey":"item.red_stained_glass","maxStack":64,"places":"red_stained_glass"},{"itemType":"red_wool","labelKey":"item.red_wool","maxStack":64,"places":"red_wool"},{"itemType":"sand","labelKey":"item.sand","maxStack":64,"places":"sand"},{"itemType":"sandstone","labelKey":"item.sandstone","maxStack":64,"places":"sandstone"},{"itemType":"sapling","labelKey":"item.sapling","maxStack":64,"places":"sapling"},{"itemType":"short_grass","labelKey":"item.short_grass","maxStack":64,"places":"short_grass"},{"itemType":"snow","labelKey":"item.snow","maxStack":64,"places":"snow"},{"itemType":"snowy_grass","labelKey":"item.snowy_grass","maxStack":64,"places":"snowy_grass"},{"itemType":"sponge","labelKey":"item.sponge","maxStack":64,"places":"sponge"},{"itemType":"spruce_leaves","labelKey":"item.spruce_leaves","maxStack":64,"places":"spruce_leaves","tags":["leaves"]},{"itemType":"spruce_log","labelKey":"item.spruce_log","maxStack":64,"places":"spruce_log","tags":["logs"]},{"itemType":"spruce_planks","labelKey":"item.spruce_planks","maxStack":64,"places":"spruce_planks","tags":["planks"]},{"itemType":"stick","labelKey":"item.stick","maxStack":64,"model":"stick"},{"itemType":"stone","labelKey":"item.stone","maxStack":64,"places":"stone"},{"combat":{"cooldown":18,"damage":5,"reach":3},"durability":132,"itemType":"stone_axe","labelKey":"item.stone_axe","maxStack":1,"model":"axe","tool":{"kind":"axe","speed":5,"tier":2}},{"itemType":"stone_bricks","labelKey":"item.stone_bricks","maxStack":64,"places":"stone_bricks"},{"combat":{"cooldown":15,"damage":4,"reach":3},"durability":132,"itemType":"stone_pickaxe","labelKey":"item.stone_pickaxe","maxStack":1,"model":"pickaxe","tool":{"kind":"pickaxe","speed":5,"tier":2}},{"combat":{"cooldown":15,"damage":4,"reach":3},"durability":132,"itemType":"stone_shovel","labelKey":"item.stone_shovel","maxStack":1,"model":"shovel","tool":{"kind":"shovel","speed":5,"tier":2}},{"itemType":"stone_slab","labelKey":"item.stone_slab","maxStack":64,"places":"stone_slab"},{"itemType":"sugar","labelKey":"item.sugar","material":"white_concrete","maxStack":64,"model":"powder"},{"itemType":"sugar_cane","labelKey":"item.sugar_cane","maxStack":64,"places":"sugar_cane"},{"activation":"held","combat":{"cooldown":15,"damage":4,"reach":3},"durability":80,"itemType":"swift_pickaxe","labelKey":"item.swift_pickaxe","maxStack":1,"model":"pickaxe","modifiers":{"speed":1.5},"tool":{"kind":"pickaxe","speed":8,"tier":2}},{"itemType":"tnt","labelKey":"item.tnt","maxStack":64,"places":"tnt"},{"itemType":"torch","labelKey":"item.torch","maxStack":64,"places":"torch"},{"durability":120,"equipment":"feet","itemType":"trail_boots","labelKey":"item.trail_boots","maxStack":1,"model":"boots","modifiers":{"fall":0.25,"speed":1.1}},{"itemType":"water","labelKey":"item.water","maxStack":64,"places":"water"},{"itemType":"water_bucket","labelKey":"item.water_bucket","material":"iron_block","maxStack":1,"model":"bucket","places":"water","remainder":"bucket"},{"itemType":"wheat","labelKey":"item.wheat","material":"yellow_wool","maxStack":64,"model":"grain"},{"itemType":"white_concrete","labelKey":"item.white_concrete","maxStack":64,"places":"white_concrete"},{"itemType":"white_pigment","labelKey":"item.white_pigment","material":"white_concrete","maxStack":64,"model":"powder"},{"itemType":"white_stained_glass","labelKey":"item.white_stained_glass","maxStack":64,"places":"white_stained_glass"},{"itemType":"white_wool","labelKey":"item.white_wool","maxStack":64,"places":"white_wool"},{"combat":{"cooldown":18,"damage":4,"reach":3},"durability":60,"itemType":"wooden_axe","labelKey":"item.wooden_axe","maxStack":1,"model":"axe","tool":{"kind":"axe","speed":3,"tier":1}},{"combat":{"cooldown":15,"damage":3,"reach":3},"durability":60,"itemType":"wooden_pickaxe","labelKey":"item.wooden_pickaxe","maxStack":1,"model":"pickaxe","tool":{"kind":"pickaxe","speed":3,"tier":1}},{"combat":{"cooldown":15,"damage":3,"reach":3},"durability":60,"itemType":"wooden_shovel","labelKey":"item.wooden_shovel","maxStack":1,"model":"shovel","tool":{"kind":"shovel","speed":3,"tier":1}},{"itemType":"yellow_concrete","labelKey":"item.yellow_concrete","maxStack":64,"places":"yellow_concrete"},{"itemType":"yellow_pigment","labelKey":"item.yellow_pigment","material":"yellow_concrete","maxStack":64,"model":"powder"},{"itemType":"yellow_stained_glass","labelKey":"item.yellow_stained_glass","maxStack":64,"places":"yellow_stained_glass"},{"itemType":"yellow_wool","labelKey":"item.yellow_wool","maxStack":64,"places":"yellow_wool"}]'),mu=JSON.parse('[{"ingredients":["potato","#fuel",null,null],"key":"baked_potato","result":{"count":1,"itemType":"baked_potato"},"size":2},{"ingredients":["birch_log",null,null,null],"key":"birch_planks","result":{"count":4,"itemType":"birch_planks"},"size":2},{"ingredients":["white_concrete","black_pigment",null,null],"key":"black_concrete","result":{"count":1,"itemType":"black_concrete"},"size":2},{"ingredients":["charcoal",null,null,null],"key":"black_pigment","result":{"count":2,"itemType":"black_pigment"},"size":2},{"ingredients":["glass","black_pigment",null,null],"key":"black_stained_glass","result":{"count":1,"itemType":"black_stained_glass"},"size":2},{"ingredients":["white_wool","black_pigment",null,null],"key":"black_wool","result":{"count":1,"itemType":"black_wool"},"size":2},{"ingredients":["white_concrete","blue_pigment",null,null],"key":"blue_concrete","result":{"count":1,"itemType":"blue_concrete"},"size":2},{"ingredients":["cornflower",null,null,null],"key":"blue_pigment","result":{"count":2,"itemType":"blue_pigment"},"size":2},{"ingredients":["lapis",null,null,null],"key":"blue_pigment_lapis","result":{"count":2,"itemType":"blue_pigment"},"size":2},{"ingredients":["glass","blue_pigment",null,null],"key":"blue_stained_glass","result":{"count":1,"itemType":"blue_stained_glass"},"size":2},{"ingredients":["white_wool","blue_pigment",null,null],"key":"blue_wool","result":{"count":1,"itemType":"blue_wool"},"size":2},{"ingredients":["#planks","#planks","#planks","paper","paper","paper","#planks","#planks","#planks"],"key":"bookshelf","result":{"count":1,"itemType":"bookshelf"},"size":3},{"ingredients":["wheat","wheat","wheat",null,null,null,null,null,null],"key":"bread","result":{"count":1,"itemType":"bread"},"size":3},{"ingredients":["sand","dirt","stone","#fuel"],"key":"bricks","result":{"count":4,"itemType":"bricks"},"size":2},{"ingredients":["white_concrete","brown_pigment",null,null],"key":"brown_concrete","result":{"count":1,"itemType":"brown_concrete"},"size":2},{"ingredients":["dirt",null,null,null],"key":"brown_pigment","result":{"count":2,"itemType":"brown_pigment"},"size":2},{"ingredients":["glass","brown_pigment",null,null],"key":"brown_stained_glass","result":{"count":1,"itemType":"brown_stained_glass"},"size":2},{"ingredients":["white_wool","brown_pigment",null,null],"key":"brown_wool","result":{"count":1,"itemType":"brown_wool"},"size":2},{"ingredients":["iron_ingot",null,"iron_ingot",null,"iron_ingot",null,null,null,null],"key":"bucket","result":{"count":1,"itemType":"bucket"},"size":3},{"ingredients":["wheat","wheat","sugar","egg"],"key":"cake","result":{"count":1,"itemType":"cake"},"size":2},{"ingredients":["#logs","#planks",null,null],"key":"charcoal","result":{"count":2,"itemType":"charcoal"},"size":2},{"ingredients":["#planks","#planks","#planks","#planks",null,"#planks","#planks","#planks","#planks"],"key":"chest","result":{"count":1,"itemType":"chest"},"size":3},{"ingredients":["stone",null,null,null],"key":"cobblestone","result":{"count":1,"itemType":"cobblestone"},"size":2},{"ingredients":["wheat","cocoa_beans","wheat","sugar",null,null,null,null,null],"key":"cookie","result":{"count":4,"itemType":"cookie"},"size":3},{"ingredients":["#planks","#planks","#planks","#planks"],"key":"crafting_table","result":{"count":1,"itemType":"crafting_table"},"size":2},{"ingredients":["white_concrete","cyan_pigment",null,null],"key":"cyan_concrete","result":{"count":1,"itemType":"cyan_concrete"},"size":2},{"ingredients":["green_pigment","blue_pigment",null,null],"key":"cyan_pigment","result":{"count":2,"itemType":"cyan_pigment"},"size":2},{"ingredients":["glass","cyan_pigment",null,null],"key":"cyan_stained_glass","result":{"count":1,"itemType":"cyan_stained_glass"},"size":2},{"ingredients":["white_wool","cyan_pigment",null,null],"key":"cyan_wool","result":{"count":1,"itemType":"cyan_wool"},"size":2},{"ingredients":["diamond","diamond",null,"diamond","stick",null,null,"stick",null],"key":"diamond_axe","result":{"count":1,"instance":{"durability":400},"itemType":"diamond_axe"},"size":3},{"ingredients":["diamond","diamond","diamond","diamond","diamond","diamond","diamond","diamond","diamond"],"key":"diamond_block","result":{"count":1,"itemType":"diamond_block"},"size":3},{"ingredients":["diamond_block",null,null,null],"key":"diamond_block_to_material","result":{"count":9,"itemType":"diamond"},"size":2},{"ingredients":["diamond","diamond","diamond",null,"stick",null,null,"stick",null],"key":"diamond_pickaxe","result":{"count":1,"instance":{"durability":400},"itemType":"diamond_pickaxe"},"size":3},{"ingredients":[null,"diamond",null,null,"stick",null,null,"stick",null],"key":"diamond_shovel","result":{"count":1,"instance":{"durability":400},"itemType":"diamond_shovel"},"size":3},{"ingredients":[null,"#leaves",null,"#leaves","apple","#leaves",null,"#leaves",null],"key":"feather_talisman","result":{"count":1,"instance":{"durability":64},"itemType":"feather_talisman"},"size":3},{"ingredients":["stone","stick",null,null],"key":"firestarter","result":{"count":1,"instance":{"durability":64},"itemType":"firestarter"},"size":2},{"ingredients":["sand","#fuel",null,null],"key":"glass","result":{"count":2,"itemType":"glass"},"size":2},{"ingredients":[null,"charcoal",null,"charcoal","stick","charcoal",null,"charcoal",null],"key":"glow_talisman","result":{"count":1,"instance":{"durability":120},"itemType":"glow_talisman"},"size":3},{"ingredients":["sand","#fuel","sand","#fuel","glass","#fuel","sand","#fuel","sand"],"key":"glowstone","result":{"count":2,"itemType":"glowstone"},"size":3},{"ingredients":["gold_ingot","gold_ingot","gold_ingot","gold_ingot","gold_ingot","gold_ingot","gold_ingot","gold_ingot","gold_ingot"],"key":"gold_block","result":{"count":1,"itemType":"gold_block"},"size":3},{"ingredients":["gold_block",null,null,null],"key":"gold_block_to_material","result":{"count":9,"itemType":"gold_ingot"},"size":2},{"ingredients":["gold_ore","#fuel",null,null],"key":"gold_ingot","result":{"count":1,"itemType":"gold_ingot"},"size":2},{"ingredients":["carrot","gold_ingot",null,null],"key":"golden_carrot","result":{"count":1,"itemType":"golden_carrot"},"size":2},{"ingredients":["white_concrete","gray_pigment",null,null],"key":"gray_concrete","result":{"count":1,"itemType":"gray_concrete"},"size":2},{"ingredients":["white_pigment","black_pigment",null,null],"key":"gray_pigment","result":{"count":2,"itemType":"gray_pigment"},"size":2},{"ingredients":["glass","gray_pigment",null,null],"key":"gray_stained_glass","result":{"count":1,"itemType":"gray_stained_glass"},"size":2},{"ingredients":["white_wool","gray_pigment",null,null],"key":"gray_wool","result":{"count":1,"itemType":"gray_wool"},"size":2},{"ingredients":["white_concrete","green_pigment",null,null],"key":"green_concrete","result":{"count":1,"itemType":"green_concrete"},"size":2},{"ingredients":["oak_leaves",null,null,null],"key":"green_pigment","result":{"count":2,"itemType":"green_pigment"},"size":2},{"ingredients":["glass","green_pigment",null,null],"key":"green_stained_glass","result":{"count":1,"itemType":"green_stained_glass"},"size":2},{"ingredients":["white_wool","green_pigment",null,null],"key":"green_wool","result":{"count":1,"itemType":"green_wool"},"size":2},{"ingredients":["#fuel","stone",null,null],"key":"gunpowder","result":{"count":3,"itemType":"gunpowder"},"size":2},{"ingredients":["#planks","stick","#planks","#planks","#planks","#planks",null,"#planks",null],"key":"heavy_shield","result":{"count":1,"instance":{"durability":120},"itemType":"heavy_shield"},"size":3},{"ingredients":[null,"sand",null,"sand","charcoal","sand",null,"sand",null],"key":"helios_medallion","result":{"count":1,"instance":{"durability":120},"itemType":"helios_medallion"},"size":3},{"ingredients":["#planks",null,"#planks","#planks",null,"#planks","#leaves",null,"#leaves"],"key":"helium_boots","result":{"count":1,"instance":{"durability":120},"itemType":"helium_boots"},"size":3},{"ingredients":["iron_ingot","iron_ingot",null,"iron_ingot","stick",null,null,"stick",null],"key":"iron_axe","result":{"count":1,"instance":{"durability":251},"itemType":"iron_axe"},"size":3},{"ingredients":["iron_ingot","iron_ingot","iron_ingot","iron_ingot","iron_ingot","iron_ingot","iron_ingot","iron_ingot","iron_ingot"],"key":"iron_block","result":{"count":1,"itemType":"iron_block"},"size":3},{"ingredients":["iron_block",null,null,null],"key":"iron_block_to_material","result":{"count":9,"itemType":"iron_ingot"},"size":2},{"ingredients":["iron_ore","#fuel",null,null],"key":"iron_ingot","result":{"count":1,"itemType":"iron_ingot"},"size":2},{"ingredients":["iron_ingot","iron_ingot","iron_ingot",null,"stick",null,null,"stick",null],"key":"iron_pickaxe","result":{"count":1,"instance":{"durability":251},"itemType":"iron_pickaxe"},"size":3},{"ingredients":[null,"iron_ingot",null,null,"stick",null,null,"stick",null],"key":"iron_shovel","result":{"count":1,"instance":{"durability":251},"itemType":"iron_shovel"},"size":3},{"ingredients":["iron_ingot",null,"iron_ingot","iron_ingot","iron_ingot","iron_ingot",null,null,null],"key":"iron_vest","result":{"count":1,"instance":{"durability":240},"itemType":"iron_vest"},"size":3},{"ingredients":["stick",null,"stick","stick","stick","stick","stick",null,"stick"],"key":"ladder","result":{"count":3,"itemType":"ladder"},"size":3},{"ingredients":["lapis","lapis","lapis","lapis","lapis","lapis","lapis","lapis","lapis"],"key":"lapis_block","result":{"count":1,"itemType":"lapis_block"},"size":3},{"ingredients":["lapis_block",null,null,null],"key":"lapis_block_to_material","result":{"count":9,"itemType":"lapis"},"size":2},{"ingredients":["white_concrete","light_blue_pigment",null,null],"key":"light_blue_concrete","result":{"count":1,"itemType":"light_blue_concrete"},"size":2},{"ingredients":["blue_pigment","white_pigment",null,null],"key":"light_blue_pigment","result":{"count":2,"itemType":"light_blue_pigment"},"size":2},{"ingredients":["glass","light_blue_pigment",null,null],"key":"light_blue_stained_glass","result":{"count":1,"itemType":"light_blue_stained_glass"},"size":2},{"ingredients":["white_wool","light_blue_pigment",null,null],"key":"light_blue_wool","result":{"count":1,"itemType":"light_blue_wool"},"size":2},{"ingredients":["white_concrete","light_gray_pigment",null,null],"key":"light_gray_concrete","result":{"count":1,"itemType":"light_gray_concrete"},"size":2},{"ingredients":["white_pigment","gray_pigment",null,null],"key":"light_gray_pigment","result":{"count":2,"itemType":"light_gray_pigment"},"size":2},{"ingredients":["glass","light_gray_pigment",null,null],"key":"light_gray_stained_glass","result":{"count":1,"itemType":"light_gray_stained_glass"},"size":2},{"ingredients":["white_wool","light_gray_pigment",null,null],"key":"light_gray_wool","result":{"count":1,"itemType":"light_gray_wool"},"size":2},{"ingredients":["white_concrete","lime_pigment",null,null],"key":"lime_concrete","result":{"count":1,"itemType":"lime_concrete"},"size":2},{"ingredients":["green_pigment","white_pigment",null,null],"key":"lime_pigment","result":{"count":2,"itemType":"lime_pigment"},"size":2},{"ingredients":["glass","lime_pigment",null,null],"key":"lime_stained_glass","result":{"count":1,"itemType":"lime_stained_glass"},"size":2},{"ingredients":["white_wool","lime_pigment",null,null],"key":"lime_wool","result":{"count":1,"itemType":"lime_wool"},"size":2},{"ingredients":["white_concrete","magenta_pigment",null,null],"key":"magenta_concrete","result":{"count":1,"itemType":"magenta_concrete"},"size":2},{"ingredients":["purple_pigment","pink_pigment",null,null],"key":"magenta_pigment","result":{"count":2,"itemType":"magenta_pigment"},"size":2},{"ingredients":["glass","magenta_pigment",null,null],"key":"magenta_stained_glass","result":{"count":1,"itemType":"magenta_stained_glass"},"size":2},{"ingredients":["white_wool","magenta_pigment",null,null],"key":"magenta_wool","result":{"count":1,"itemType":"magenta_wool"},"size":2},{"ingredients":["melon_slice","melon_slice","melon_slice","melon_slice","melon_slice","melon_slice","melon_slice","melon_slice","melon_slice"],"key":"melon_block","result":{"count":1,"itemType":"melon"},"size":3},{"ingredients":["melon",null,null,null],"key":"melon_slices","result":{"count":9,"itemType":"melon_slice"},"size":2},{"ingredients":["cobblestone","#leaves",null,null],"key":"mossy_cobblestone","result":{"count":1,"itemType":"mossy_cobblestone"},"size":2},{"ingredients":["stone_bricks","#leaves",null,null],"key":"mossy_stone_bricks","result":{"count":1,"itemType":"mossy_stone_bricks"},"size":2},{"ingredients":["oak_log",null,null,null],"key":"oak_planks","result":{"count":4,"itemType":"oak_planks"},"size":2},{"ingredients":["#planks",null,null,"#planks","#planks",null,"#planks","#planks","#planks"],"key":"oak_stairs","result":{"count":4,"itemType":"oak_stairs"},"size":3},{"ingredients":["stone","stone","stone","stone","#fuel","stone","stone","stone","stone"],"key":"obsidian","result":{"count":1,"itemType":"obsidian"},"size":3},{"ingredients":["white_concrete","orange_pigment",null,null],"key":"orange_concrete","result":{"count":1,"itemType":"orange_concrete"},"size":2},{"ingredients":["red_pigment","yellow_pigment",null,null],"key":"orange_pigment","result":{"count":2,"itemType":"orange_pigment"},"size":2},{"ingredients":["glass","orange_pigment",null,null],"key":"orange_stained_glass","result":{"count":1,"itemType":"orange_stained_glass"},"size":2},{"ingredients":["white_wool","orange_pigment",null,null],"key":"orange_wool","result":{"count":1,"itemType":"orange_wool"},"size":2},{"ingredients":["plant_fiber","plant_fiber","plant_fiber",null,null,null,null,null,null],"key":"paper","result":{"count":3,"itemType":"paper"},"size":3},{"ingredients":["white_concrete","pink_pigment",null,null],"key":"pink_concrete","result":{"count":1,"itemType":"pink_concrete"},"size":2},{"ingredients":["red_pigment","white_pigment",null,null],"key":"pink_pigment","result":{"count":2,"itemType":"pink_pigment"},"size":2},{"ingredients":["glass","pink_pigment",null,null],"key":"pink_stained_glass","result":{"count":1,"itemType":"pink_stained_glass"},"size":2},{"ingredients":["white_wool","pink_pigment",null,null],"key":"pink_wool","result":{"count":1,"itemType":"pink_wool"},"size":2},{"ingredients":["white_concrete","purple_pigment",null,null],"key":"purple_concrete","result":{"count":1,"itemType":"purple_concrete"},"size":2},{"ingredients":["red_pigment","blue_pigment",null,null],"key":"purple_pigment","result":{"count":2,"itemType":"purple_pigment"},"size":2},{"ingredients":["glass","purple_pigment",null,null],"key":"purple_stained_glass","result":{"count":1,"itemType":"purple_stained_glass"},"size":2},{"ingredients":["white_wool","purple_pigment",null,null],"key":"purple_wool","result":{"count":1,"itemType":"purple_wool"},"size":2},{"ingredients":["white_concrete","red_pigment",null,null],"key":"red_concrete","result":{"count":1,"itemType":"red_concrete"},"size":2},{"ingredients":["poppy",null,null,null],"key":"red_pigment","result":{"count":2,"itemType":"red_pigment"},"size":2},{"ingredients":["glass","red_pigment",null,null],"key":"red_stained_glass","result":{"count":1,"itemType":"red_stained_glass"},"size":2},{"ingredients":["white_wool","red_pigment",null,null],"key":"red_wool","result":{"count":1,"itemType":"red_wool"},"size":2},{"ingredients":["sand","sand","sand","sand"],"key":"sandstone","result":{"count":4,"itemType":"sandstone"},"size":2},{"ingredients":["yellow_wool","plant_fiber",null,null],"key":"sponge","result":{"count":1,"itemType":"sponge"},"size":2},{"ingredients":["spruce_log",null,null,null],"key":"spruce_planks","result":{"count":4,"itemType":"spruce_planks"},"size":2},{"ingredients":["#planks",null,"#planks",null],"key":"stick","result":{"count":4,"itemType":"stick"},"size":2},{"ingredients":["stone","stone",null,"stone","stick",null,null,"stick",null],"key":"stone_axe","result":{"count":1,"instance":{"durability":132},"itemType":"stone_axe"},"size":3},{"ingredients":["stone","stone","stone","stone"],"key":"stone_bricks","result":{"count":4,"itemType":"stone_bricks"},"size":2},{"ingredients":["stone","stone","stone",null,"stick",null,null,"stick",null],"key":"stone_pickaxe","result":{"count":1,"instance":{"durability":132},"itemType":"stone_pickaxe"},"size":3},{"ingredients":[null,"stone",null,null,"stick",null,null,"stick",null],"key":"stone_shovel","result":{"count":1,"instance":{"durability":132},"itemType":"stone_shovel"},"size":3},{"ingredients":["stone","stone",null,null],"key":"stone_slab","result":{"count":4,"itemType":"stone_slab"},"size":2},{"ingredients":["sugar_cane",null,null,null],"key":"sugar","result":{"count":2,"itemType":"sugar"},"size":2},{"ingredients":["stone","stone","stone",null,"stick",null,"charcoal","stick","charcoal"],"key":"swift_pickaxe","result":{"count":1,"instance":{"durability":80},"itemType":"swift_pickaxe"},"size":3},{"ingredients":["gunpowder","sand","gunpowder","sand","gunpowder","sand","gunpowder","sand","gunpowder"],"key":"tnt","result":{"count":1,"itemType":"tnt"},"size":3},{"ingredients":["#fuel",null,"stick",null],"key":"torch","result":{"count":4,"itemType":"torch"},"size":2},{"ingredients":["#planks",null,"#planks","#planks",null,"#planks",null,null,null],"key":"trail_boots","result":{"count":1,"instance":{"durability":120},"itemType":"trail_boots"},"size":3},{"ingredients":["sand","gravel","stone",null],"key":"white_concrete","result":{"count":4,"itemType":"white_concrete"},"size":2},{"ingredients":["sand",null,null,null],"key":"white_pigment","result":{"count":2,"itemType":"white_pigment"},"size":2},{"ingredients":["glass","white_pigment",null,null],"key":"white_stained_glass","result":{"count":1,"itemType":"white_stained_glass"},"size":2},{"ingredients":["plant_fiber","plant_fiber","plant_fiber","plant_fiber"],"key":"white_wool","result":{"count":2,"itemType":"white_wool"},"size":2},{"ingredients":["#planks","#planks",null,"#planks","stick",null,null,"stick",null],"key":"wooden_axe","result":{"count":1,"instance":{"durability":60},"itemType":"wooden_axe"},"size":3},{"ingredients":["#planks","#planks","#planks",null,"stick",null,null,"stick",null],"key":"wooden_pickaxe","result":{"count":1,"instance":{"durability":60},"itemType":"wooden_pickaxe"},"size":3},{"ingredients":[null,"#planks",null,null,"stick",null,null,"stick",null],"key":"wooden_shovel","result":{"count":1,"instance":{"durability":60},"itemType":"wooden_shovel"},"size":3},{"ingredients":["white_concrete","yellow_pigment",null,null],"key":"yellow_concrete","result":{"count":1,"itemType":"yellow_concrete"},"size":2},{"ingredients":["dandelion",null,null,null],"key":"yellow_pigment","result":{"count":2,"itemType":"yellow_pigment"},"size":2},{"ingredients":["glass","yellow_pigment",null,null],"key":"yellow_stained_glass","result":{"count":1,"itemType":"yellow_stained_glass"},"size":2},{"ingredients":["white_wool","yellow_pigment",null,null],"key":"yellow_wool","result":{"count":1,"itemType":"yellow_wool"},"size":2}]'),gu=2,_u={birch_log:4,fern:102,oak_log:73,podzol:33,redstone_ore:109,snow_block:103,spruce_log:107},yu=109,xu={behavior:uu,blocks:du,hash:hu,height:fu,items:pu,recipes:mu,schema:gu,terrain:_u,terrainFallback:yu},vu="652622f1485a43e6ae61bc8da39d3eec88f29efdb4ffe642301ad0dfbe34b43e",bu="cafaedd1659c408eb5d7f548043e8632647fbbd93bb03044f189f0a1b20cc388",Su="df0ef34a38d5b9a1f0a16a665bd7eec398736c2eacea98dbb1ec5a4fd0cd32e1",Mu="368b605ac5bdf5ff6fcf4af02f7174cbc6d39b5110f48e0a41b231a0a6479464",wu=13,Tu=1,Eu=2,Au=2,Ru=2,Cu=256,Pu="bedd62f9b37b2a071c498413c7352033ccd97e94f2bd976101259481c789d3f8",Lu="engine-cafaedd1659c408eb5d7f548043e8632647fbbd93bb03044f189f0a1b20cc388.wasm",Iu="bindings-df0ef34a38d5b9a1f0a16a665bd7eec398736c2eacea98dbb1ec5a4fd0cd32e1.js",Du={runtimeHash:vu,engineHash:bu,bindingsHash:Su,contentHash:Mu,protocol:wu,environmentVersion:Tu,columnFormat:Eu,regionFormat:Au,editFormat:Ru,height:Cu,buildId:Pu,engineArtifact:Lu,bindingsArtifact:Iu},xt=xu,Ri=Du;let Uu=null;function ku(){return Uu??=(async()=>{const i=await fetch(cu);if(!i.ok)throw new Error("engine download failed");const e=await i.arrayBuffer();if(Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",e)),r=>r.toString(16).padStart(2,"0")).join("")!==Ri.engineHash||Ri.contentHash!==xt.hash)throw new Error("incompatible engine/content artifacts");const n=await WebAssembly.compile(e),s=lu({module:n});return $c(JSON.stringify(xt)),{module:n,memory:s.memory}})()}function Nu(){if(typeof WebAssembly!="object"||typeof Worker!="function")return"הדפדפן אינו תומך בהפעלת המשחק";const i=new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,22,1,20,0,253,12,...new Array(16).fill(0),11]);if(!WebAssembly.validate(i))return"נדרש דפדפן התומך ב־WebAssembly SIMD";const e=document.createElement("canvas").getContext("webgl2");return e?(e.getExtension("WEBGL_lose_context")?.loseContext(),null):"נדרשת תמיכה ב־WebGL2"}/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const xo="186",Fu=0,Oo=1,Ou=2,dr=1,Bu=2,as=3,Yn=0,qt=1,jt=2,Dn=0,cs=1,Bo=2,zo=3,Go=4,zu=5,Ai=100,Gu=101,Vu=102,Hu=103,Wu=104,Xu=200,qu=201,Ku=202,Yu=203,jl=204,ec=205,$u=206,Zu=207,Ju=208,Qu=209,ju=210,ed=211,td=212,nd=213,id=214,Ea=0,Aa=1,Ra=2,us=3,Ca=4,Pa=5,La=6,Ia=7,tc=0,sd=1,rd=2,Sn=0,nc=1,ic=2,sc=3,rc=4,ac=5,oc=6,lc=7,cc=300,ri=301,Ui=302,Br=303,zr=304,Pr=306,ds=1e3,In=1001,Da=1002,At=1003,ad=1004,Ps=1005,Ut=1006,Gr=1007,Kn=1008,en=1009,uc=1010,dc=1011,hs=1012,Lr=1013,Mn=1014,hn=1015,wn=1016,vo=1017,bo=1018,fs=1020,hc=35902,fc=35899,pc=1021,mc=1022,nn=1023,Nn=1026,ii=1027,So=1028,Mo=1029,ai=1030,wo=1031,To=1033,hr=33776,fr=33777,pr=33778,mr=33779,Ua=35840,ka=35841,Na=35842,Fa=35843,Oa=36196,Ba=37492,za=37496,Ga=37488,Va=37489,xr=37490,Ha=37491,Wa=37808,Xa=37809,qa=37810,Ka=37811,Ya=37812,$a=37813,Za=37814,Ja=37815,Qa=37816,ja=37817,eo=37818,to=37819,no=37820,io=37821,so=36492,ro=36494,ao=36495,oo=36283,lo=36284,vr=36285,co=36286,od=3200,Vo=0,ld=1,Ln="",Gt="srgb",ps="srgb-linear",br="linear",_t="srgb",Vr=7680,cd=519,ud=512,dd=513,hd=514,Eo=515,fd=516,pd=517,Ao=518,md=519,gd=35044,oi=35048,ms="300 es",bn=2e3,Sr=2001;function _d(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function Mr(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function yd(){const i=Mr("canvas");return i.style.display="block",i}const Ho={};function Wo(...i){const e="THREE."+i.shift();console.log(e,...i)}function gc(i){const e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function ze(...i){i=gc(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function dt(...i){i=gc(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function Li(...i){const e=i.join(" ");e in Ho||(Ho[e]=!0,ze(...i))}function xd(i,e,t){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,t);break;default:n()}}setTimeout(r,t)})}const vd={[Ea]:Aa,[Ra]:La,[Ca]:Ia,[us]:Pa,[Aa]:Ea,[La]:Ra,[Ia]:Ca,[Pa]:us};class ci{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const r=s.indexOf(t);r!==-1&&s.splice(r,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let r=0,a=s.length;r<a;r++)s[r].call(this,e);e.target=null}}}const Ft=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],gr=Math.PI/180,uo=180/Math.PI;function ys(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ft[i&255]+Ft[i>>8&255]+Ft[i>>16&255]+Ft[i>>24&255]+"-"+Ft[e&255]+Ft[e>>8&255]+"-"+Ft[e>>16&15|64]+Ft[e>>24&255]+"-"+Ft[t&63|128]+Ft[t>>8&255]+"-"+Ft[t>>16&255]+Ft[t>>24&255]+Ft[n&255]+Ft[n>>8&255]+Ft[n>>16&255]+Ft[n>>24&255]).toLowerCase()}function tt(i,e,t){return Math.max(e,Math.min(t,i))}function bd(i,e){return(i%e+e)%e}function Hr(i,e,t){return(1-t)*i+t*e}function Wi(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:case Uint8ClampedArray:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Xt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:case Uint8ClampedArray:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}class ct{static{ct.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(tt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),r=this.x-e.x,a=this.y-e.y;return this.x=r*n-a*s+e.x,this.y=r*s+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class ui{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,r,a,o){let l=n[s+0],c=n[s+1],u=n[s+2],h=n[s+3],d=r[a+0],f=r[a+1],_=r[a+2],b=r[a+3];if(h!==b||l!==d||c!==f||u!==_){let m=l*d+c*f+u*_+h*b;m<0&&(d=-d,f=-f,_=-_,b=-b,m=-m);let p=1-o;if(m<.9995){const T=Math.acos(m),P=Math.sin(T);p=Math.sin(p*T)/P,o=Math.sin(o*T)/P,l=l*p+d*o,c=c*p+f*o,u=u*p+_*o,h=h*p+b*o}else{l=l*p+d*o,c=c*p+f*o,u=u*p+_*o,h=h*p+b*o;const T=1/Math.sqrt(l*l+c*c+u*u+h*h);l*=T,c*=T,u*=T,h*=T}}e[t]=l,e[t+1]=c,e[t+2]=u,e[t+3]=h}static multiplyQuaternionsFlat(e,t,n,s,r,a){const o=n[s],l=n[s+1],c=n[s+2],u=n[s+3],h=r[a],d=r[a+1],f=r[a+2],_=r[a+3];return e[t]=o*_+u*h+l*f-c*d,e[t+1]=l*_+u*d+c*h-o*f,e[t+2]=c*_+u*f+o*d-l*h,e[t+3]=u*_-o*h-l*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,r=e._z,a=e._order,o=Math.cos,l=Math.sin,c=o(n/2),u=o(s/2),h=o(r/2),d=l(n/2),f=l(s/2),_=l(r/2);switch(a){case"XYZ":this._x=d*u*h+c*f*_,this._y=c*f*h-d*u*_,this._z=c*u*_+d*f*h,this._w=c*u*h-d*f*_;break;case"YXZ":this._x=d*u*h+c*f*_,this._y=c*f*h-d*u*_,this._z=c*u*_-d*f*h,this._w=c*u*h+d*f*_;break;case"ZXY":this._x=d*u*h-c*f*_,this._y=c*f*h+d*u*_,this._z=c*u*_+d*f*h,this._w=c*u*h-d*f*_;break;case"ZYX":this._x=d*u*h-c*f*_,this._y=c*f*h+d*u*_,this._z=c*u*_-d*f*h,this._w=c*u*h+d*f*_;break;case"YZX":this._x=d*u*h+c*f*_,this._y=c*f*h+d*u*_,this._z=c*u*_-d*f*h,this._w=c*u*h-d*f*_;break;case"XZY":this._x=d*u*h-c*f*_,this._y=c*f*h-d*u*_,this._z=c*u*_+d*f*h,this._w=c*u*h+d*f*_;break;default:ze("Quaternion: .setFromEuler() encountered an unknown order: "+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],r=t[8],a=t[1],o=t[5],l=t[9],c=t[2],u=t[6],h=t[10],d=n+o+h;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(u-l)*f,this._y=(r-c)*f,this._z=(a-s)*f}else if(n>o&&n>h){const f=2*Math.sqrt(1+n-o-h);this._w=(u-l)/f,this._x=.25*f,this._y=(s+a)/f,this._z=(r+c)/f}else if(o>h){const f=2*Math.sqrt(1+o-n-h);this._w=(r-c)/f,this._x=(s+a)/f,this._y=.25*f,this._z=(l+u)/f}else{const f=2*Math.sqrt(1+h-n-o);this._w=(a-s)/f,this._x=(r+c)/f,this._y=(l+u)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(tt(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,r=e._z,a=e._w,o=t._x,l=t._y,c=t._z,u=t._w;return this._x=n*u+a*o+s*c-r*l,this._y=s*u+a*l+r*o-n*c,this._z=r*u+a*c+n*l-s*o,this._w=a*u-n*o-s*l-r*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,s=e._y,r=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,s=-s,r=-r,a=-a,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),u=Math.sin(c);l=Math.sin(l*c)/u,t=Math.sin(t*c)/u,this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+r*t,this._w=this._w*l+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),r*Math.sin(t),r*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class G{static{G.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(Xo.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(Xo.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6]*s,this.y=r[1]*t+r[4]*n+r[7]*s,this.z=r[2]*t+r[5]*n+r[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=e.elements,a=1/(r[3]*t+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*t+r[4]*n+r[8]*s+r[12])*a,this.y=(r[1]*t+r[5]*n+r[9]*s+r[13])*a,this.z=(r[2]*t+r[6]*n+r[10]*s+r[14])*a,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,r=e.x,a=e.y,o=e.z,l=e.w,c=2*(a*s-o*n),u=2*(o*t-r*s),h=2*(r*n-a*t);return this.x=t+l*c+a*h-o*u,this.y=n+l*u+o*c-r*h,this.z=s+l*h+r*u-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s,this.y=r[1]*t+r[5]*n+r[9]*s,this.z=r[2]*t+r[6]*n+r[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this.z=tt(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this.z=tt(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,r=e.z,a=t.x,o=t.y,l=t.z;return this.x=s*l-r*o,this.y=r*a-n*l,this.z=n*o-s*a,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return Wr.copy(this).projectOnVector(e),this.sub(Wr)}reflect(e){return this.sub(Wr.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos(tt(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Wr=new G,Xo=new ui;class We{static{We.prototype.isMatrix3=!0}constructor(e,t,n,s,r,a,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c)}set(e,t,n,s,r,a,o,l,c){const u=this.elements;return u[0]=e,u[1]=s,u[2]=o,u[3]=t,u[4]=r,u[5]=l,u[6]=n,u[7]=a,u[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],u=n[4],h=n[7],d=n[2],f=n[5],_=n[8],b=s[0],m=s[3],p=s[6],T=s[1],P=s[4],S=s[7],R=s[2],A=s[5],L=s[8];return r[0]=a*b+o*T+l*R,r[3]=a*m+o*P+l*A,r[6]=a*p+o*S+l*L,r[1]=c*b+u*T+h*R,r[4]=c*m+u*P+h*A,r[7]=c*p+u*S+h*L,r[2]=d*b+f*T+_*R,r[5]=d*m+f*P+_*A,r[8]=d*p+f*S+_*L,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8];return t*a*u-t*o*c-n*r*u+n*o*l+s*r*c-s*a*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=u*a-o*c,d=o*l-u*r,f=c*r-a*l,_=t*h+n*d+s*f;if(_===0)return this.set(0,0,0,0,0,0,0,0,0);const b=1/_;return e[0]=h*b,e[1]=(s*c-u*n)*b,e[2]=(o*n-s*a)*b,e[3]=d*b,e[4]=(u*t-s*l)*b,e[5]=(s*r-o*t)*b,e[6]=f*b,e[7]=(n*l-c*t)*b,e[8]=(a*t-n*r)*b,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,r,a,o){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*a+c*o)+a+e,-s*c,s*l,-s*(-c*a+l*o)+o+t,0,0,1),this}scale(e,t){return Li("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Xr.makeScale(e,t)),this}rotate(e){return Li("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Xr.makeRotation(-e)),this}translate(e,t){return Li("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Xr.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Xr=new We,qo=new We().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Ko=new We().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Sd(){const i={enabled:!0,workingColorSpace:ps,spaces:{},convert:function(s,r,a){return this.enabled===!1||r===a||!r||!a||(this.spaces[r].transfer===_t&&(s.r=Un(s.r),s.g=Un(s.g),s.b=Un(s.b)),this.spaces[r].primaries!==this.spaces[a].primaries&&(s.applyMatrix3(this.spaces[r].toXYZ),s.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===_t&&(s.r=Ii(s.r),s.g=Ii(s.g),s.b=Ii(s.b))),s},workingToColorSpace:function(s,r){return this.convert(s,this.workingColorSpace,r)},colorSpaceToWorking:function(s,r){return this.convert(s,r,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Ln?br:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,r=this.workingColorSpace){return s.fromArray(this.spaces[r].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,r,a){return s.copy(this.spaces[r].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,r){return Li("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,r)},toWorkingColorSpace:function(s,r){return Li("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,r)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[ps]:{primaries:e,whitePoint:n,transfer:br,toXYZ:qo,fromXYZ:Ko,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:Gt},outputColorSpaceConfig:{drawingBufferColorSpace:Gt}},[Gt]:{primaries:e,whitePoint:n,transfer:_t,toXYZ:qo,fromXYZ:Ko,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:Gt}}}),i}const et=Sd();function Un(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Ii(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let fi;class Md{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{fi===void 0&&(fi=Mr("canvas")),fi.width=e.width,fi.height=e.height;const s=fi.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=fi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=Mr("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),r=s.data;for(let a=0;a<r.length;a++)r[a]=Un(r[a]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(Un(t[n]/255)*255):t[n]=Un(t[n]);return{data:t,width:e.width,height:e.height}}else return ze("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let wd=0;class Ro{constructor(e=null){this.isTextureSource=!0,Object.defineProperty(this,"id",{value:wd++}),this.uuid=ys(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let a=0,o=s.length;a<o;a++)s[a].isDataTexture?r.push(qr(s[a].image)):r.push(qr(s[a]))}else r=qr(s);n.url=r}return t||(e.images[this.uuid]=n),n}}function qr(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?Md.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(ze("Texture: Unable to serialize Texture."),{})}let Td=0;const Kr=new G;class Vt extends ci{constructor(e=Vt.DEFAULT_IMAGE,t=Vt.DEFAULT_MAPPING,n=In,s=In,r=Ut,a=Kn,o=nn,l=en,c=Vt.DEFAULT_ANISOTROPY,u=Ln){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Td++}),this.uuid=ys(),this.name="",this.source=new Ro(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new ct(0,0),this.repeat=new ct(1,1),this.center=new ct(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new We,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Kr).x}get height(){return this.source.getSize(Kr).y}get depth(){return this.source.getSize(Kr).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){ze(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){ze(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==cc)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case ds:e.x=e.x-Math.floor(e.x);break;case In:e.x=e.x<0?0:1;break;case Da:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case ds:e.y=e.y-Math.floor(e.y);break;case In:e.y=e.y<0?0:1;break;case Da:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Vt.DEFAULT_IMAGE=null;Vt.DEFAULT_MAPPING=cc;Vt.DEFAULT_ANISOTROPY=1;class Mt{static{Mt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,s=1){this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,r=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s+a[12]*r,this.y=a[1]*t+a[5]*n+a[9]*s+a[13]*r,this.z=a[2]*t+a[6]*n+a[10]*s+a[14]*r,this.w=a[3]*t+a[7]*n+a[11]*s+a[15]*r,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,r;const l=e.elements,c=l[0],u=l[4],h=l[8],d=l[1],f=l[5],_=l[9],b=l[2],m=l[6],p=l[10];if(Math.abs(u-d)<.01&&Math.abs(h-b)<.01&&Math.abs(_-m)<.01){if(Math.abs(u+d)<.1&&Math.abs(h+b)<.1&&Math.abs(_+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const P=(c+1)/2,S=(f+1)/2,R=(p+1)/2,A=(u+d)/4,L=(h+b)/4,y=(_+m)/4;return P>S&&P>R?P<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(P),s=A/n,r=L/n):S>R?S<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(S),n=A/s,r=y/s):R<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(R),n=L/r,s=y/r),this.set(n,s,r,t),this}let T=Math.sqrt((m-_)*(m-_)+(h-b)*(h-b)+(d-u)*(d-u));return Math.abs(T)<.001&&(T=1),this.x=(m-_)/T,this.y=(h-b)/T,this.z=(d-u)/T,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=tt(this.x,e.x,t.x),this.y=tt(this.y,e.y,t.y),this.z=tt(this.z,e.z,t.z),this.w=tt(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=tt(this.x,e,t),this.y=tt(this.y,e,t),this.z=tt(this.z,e,t),this.w=tt(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar(tt(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Ed extends ci{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Ut,depthBuffer:!0,stencilBuffer:!1,resolveColorBuffer:!0,resolveDepthBuffer:!0,resolveStencilBuffer:!0,storeMultisampledColorBuffer:!0,storeMultisampledDepthBuffer:!0,storeMultisampledStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Mt(0,0,e,t),this.scissorTest=!1,this.viewport=new Mt(0,0,e,t),this.textures=[];const s={width:e,height:t,depth:n.depth},r=new Vt(s),a=n.count;for(let o=0;o<a;o++)this.textures[o]=r.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveColorBuffer=n.resolveColorBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.storeMultisampledColorBuffer=n.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=n.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=n.storeMultisampledStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){const t={minFilter:Ut,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&this._depthTexture.renderTarget===this&&(this._depthTexture.renderTarget=null),e!==null&&e.renderTarget===null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new Ro(s)}if(this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveColorBuffer=e.resolveColorBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,this.storeMultisampledColorBuffer=e.storeMultisampledColorBuffer,this.storeMultisampledDepthBuffer=e.storeMultisampledDepthBuffer,this.storeMultisampledStencilBuffer=e.storeMultisampledStencilBuffer,e.depthTexture!==null)if(e.depthTexture.renderTarget===e){const t=e.depthTexture.clone();t.renderTarget=null,this.depthTexture=t}else this.depthTexture=e.depthTexture;return this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class rn extends Ed{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class Co extends Vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=At,this.minFilter=At,this.wrapR=In,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Ad extends Vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=At,this.minFilter=At,this.wrapR=In,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}copy(e){return super.copy(e),this.wrapR=e.wrapR,this}}class Je{static{Je.prototype.isMatrix4=!0}constructor(e,t,n,s,r,a,o,l,c,u,h,d,f,_,b,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,r,a,o,l,c,u,h,d,f,_,b,m)}set(e,t,n,s,r,a,o,l,c,u,h,d,f,_,b,m){const p=this.elements;return p[0]=e,p[4]=t,p[8]=n,p[12]=s,p[1]=r,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=u,p[10]=h,p[14]=d,p[3]=f,p[7]=_,p[11]=b,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Je().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();const t=this.elements,n=e.elements,s=1/pi.setFromMatrixColumn(e,0).length(),r=1/pi.setFromMatrixColumn(e,1).length(),a=1/pi.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*r,t[5]=n[5]*r,t[6]=n[6]*r,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,r=e.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),u=Math.cos(r),h=Math.sin(r);if(e.order==="XYZ"){const d=a*u,f=a*h,_=o*u,b=o*h;t[0]=l*u,t[4]=-l*h,t[8]=c,t[1]=f+_*c,t[5]=d-b*c,t[9]=-o*l,t[2]=b-d*c,t[6]=_+f*c,t[10]=a*l}else if(e.order==="YXZ"){const d=l*u,f=l*h,_=c*u,b=c*h;t[0]=d+b*o,t[4]=_*o-f,t[8]=a*c,t[1]=a*h,t[5]=a*u,t[9]=-o,t[2]=f*o-_,t[6]=b+d*o,t[10]=a*l}else if(e.order==="ZXY"){const d=l*u,f=l*h,_=c*u,b=c*h;t[0]=d-b*o,t[4]=-a*h,t[8]=_+f*o,t[1]=f+_*o,t[5]=a*u,t[9]=b-d*o,t[2]=-a*c,t[6]=o,t[10]=a*l}else if(e.order==="ZYX"){const d=a*u,f=a*h,_=o*u,b=o*h;t[0]=l*u,t[4]=_*c-f,t[8]=d*c+b,t[1]=l*h,t[5]=b*c+d,t[9]=f*c-_,t[2]=-c,t[6]=o*l,t[10]=a*l}else if(e.order==="YZX"){const d=a*l,f=a*c,_=o*l,b=o*c;t[0]=l*u,t[4]=b-d*h,t[8]=_*h+f,t[1]=h,t[5]=a*u,t[9]=-o*u,t[2]=-c*u,t[6]=f*h+_,t[10]=d-b*h}else if(e.order==="XZY"){const d=a*l,f=a*c,_=o*l,b=o*c;t[0]=l*u,t[4]=-h,t[8]=c*u,t[1]=d*h+b,t[5]=a*u,t[9]=f*h-_,t[2]=_*h-f,t[6]=o*u,t[10]=b*h+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Rd,e,Cd)}lookAt(e,t,n){const s=this.elements;return Yt.subVectors(e,t),Yt.lengthSq()===0&&(Yt.z=1),Yt.normalize(),Bn.crossVectors(n,Yt),Bn.lengthSq()===0&&(Math.abs(n.z)===1?Yt.x+=1e-4:Yt.z+=1e-4,Yt.normalize(),Bn.crossVectors(n,Yt)),Bn.normalize(),Ls.crossVectors(Yt,Bn),s[0]=Bn.x,s[4]=Ls.x,s[8]=Yt.x,s[1]=Bn.y,s[5]=Ls.y,s[9]=Yt.y,s[2]=Bn.z,s[6]=Ls.z,s[10]=Yt.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,r=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],u=n[1],h=n[5],d=n[9],f=n[13],_=n[2],b=n[6],m=n[10],p=n[14],T=n[3],P=n[7],S=n[11],R=n[15],A=s[0],L=s[4],y=s[8],w=s[12],M=s[1],N=s[5],W=s[9],z=s[13],C=s[2],V=s[6],O=s[10],I=s[14],j=s[3],H=s[7],X=s[11],J=s[15];return r[0]=a*A+o*M+l*C+c*j,r[4]=a*L+o*N+l*V+c*H,r[8]=a*y+o*W+l*O+c*X,r[12]=a*w+o*z+l*I+c*J,r[1]=u*A+h*M+d*C+f*j,r[5]=u*L+h*N+d*V+f*H,r[9]=u*y+h*W+d*O+f*X,r[13]=u*w+h*z+d*I+f*J,r[2]=_*A+b*M+m*C+p*j,r[6]=_*L+b*N+m*V+p*H,r[10]=_*y+b*W+m*O+p*X,r[14]=_*w+b*z+m*I+p*J,r[3]=T*A+P*M+S*C+R*j,r[7]=T*L+P*N+S*V+R*H,r[11]=T*y+P*W+S*O+R*X,r[15]=T*w+P*z+S*I+R*J,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[12],a=e[1],o=e[5],l=e[9],c=e[13],u=e[2],h=e[6],d=e[10],f=e[14],_=e[3],b=e[7],m=e[11],p=e[15],T=l*f-c*d,P=o*f-c*h,S=o*d-l*h,R=a*f-c*u,A=a*d-l*u,L=a*h-o*u;return t*(b*T-m*P+p*S)-n*(_*T-m*R+p*A)+s*(_*P-b*R+p*L)-r*(_*S-b*A+m*L)}determinantAffine(){const e=this.elements,t=e[0],n=e[4],s=e[8],r=e[1],a=e[5],o=e[9],l=e[2],c=e[6],u=e[10];return t*(a*u-o*c)-n*(r*u-o*l)+s*(r*c-a*l)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],r=e[3],a=e[4],o=e[5],l=e[6],c=e[7],u=e[8],h=e[9],d=e[10],f=e[11],_=e[12],b=e[13],m=e[14],p=e[15],T=t*o-n*a,P=t*l-s*a,S=t*c-r*a,R=n*l-s*o,A=n*c-r*o,L=s*c-r*l,y=u*b-h*_,w=u*m-d*_,M=u*p-f*_,N=h*m-d*b,W=h*p-f*b,z=d*p-f*m,C=T*z-P*W+S*N+R*M-A*w+L*y;if(C===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const V=1/C;return e[0]=(o*z-l*W+c*N)*V,e[1]=(s*W-n*z-r*N)*V,e[2]=(b*L-m*A+p*R)*V,e[3]=(d*A-h*L-f*R)*V,e[4]=(l*M-a*z-c*w)*V,e[5]=(t*z-s*M+r*w)*V,e[6]=(m*S-_*L-p*P)*V,e[7]=(u*L-d*S+f*P)*V,e[8]=(a*W-o*M+c*y)*V,e[9]=(n*M-t*W-r*y)*V,e[10]=(_*A-b*S+p*T)*V,e[11]=(h*S-u*A-f*T)*V,e[12]=(o*w-a*N-l*y)*V,e[13]=(t*N-n*w+s*y)*V,e[14]=(b*P-_*R-m*T)*V,e[15]=(u*R-h*P+d*T)*V,this}scale(e){const t=this.elements,n=e.x,s=e.y,r=e.z;return t[0]*=n,t[4]*=s,t[8]*=r,t[1]*=n,t[5]*=s,t[9]*=r,t[2]*=n,t[6]*=s,t[10]*=r,t[3]*=n,t[7]*=s,t[11]*=r,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),r=1-n,a=e.x,o=e.y,l=e.z,c=r*a,u=r*o;return this.set(c*a+n,c*o-s*l,c*l+s*o,0,c*o+s*l,u*o+n,u*l-s*a,0,c*l-s*o,u*l+s*a,r*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,r,a){return this.set(1,n,r,0,e,1,a,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,r=t._x,a=t._y,o=t._z,l=t._w,c=r+r,u=a+a,h=o+o,d=r*c,f=r*u,_=r*h,b=a*u,m=a*h,p=o*h,T=l*c,P=l*u,S=l*h,R=n.x,A=n.y,L=n.z;return s[0]=(1-(b+p))*R,s[1]=(f+S)*R,s[2]=(_-P)*R,s[3]=0,s[4]=(f-S)*A,s[5]=(1-(d+p))*A,s[6]=(m+T)*A,s[7]=0,s[8]=(_+P)*L,s[9]=(m-T)*L,s[10]=(1-(d+b))*L,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];const r=this.determinantAffine();if(r===0)return n.set(1,1,1),t.identity(),this;let a=pi.set(s[0],s[1],s[2]).length();const o=pi.set(s[4],s[5],s[6]).length(),l=pi.set(s[8],s[9],s[10]).length();r<0&&(a=-a),on.copy(this);const c=1/a,u=1/o,h=1/l;return on.elements[0]*=c,on.elements[1]*=c,on.elements[2]*=c,on.elements[4]*=u,on.elements[5]*=u,on.elements[6]*=u,on.elements[8]*=h,on.elements[9]*=h,on.elements[10]*=h,t.setFromRotationMatrix(on),n.x=a,n.y=o,n.z=l,this}makePerspective(e,t,n,s,r,a,o=bn,l=!1){const c=this.elements,u=2*r/(t-e),h=2*r/(n-s),d=(t+e)/(t-e),f=(n+s)/(n-s);let _,b;if(l)_=r/(a-r),b=a*r/(a-r);else if(o===bn)_=-(a+r)/(a-r),b=-2*a*r/(a-r);else if(o===Sr)_=-a/(a-r),b=-a*r/(a-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=h,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=_,c[14]=b,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,r,a,o=bn,l=!1){const c=this.elements,u=2/(t-e),h=2/(n-s),d=-(t+e)/(t-e),f=-(n+s)/(n-s);let _,b;if(l)_=1/(a-r),b=a/(a-r);else if(o===bn)_=-2/(a-r),b=-(a+r)/(a-r);else if(o===Sr)_=-1/(a-r),b=-r/(a-r);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=u,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=h,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=_,c[14]=b,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const pi=new G,on=new Je,Rd=new G(0,0,0),Cd=new G(1,1,1),Bn=new G,Ls=new G,Yt=new G,Yo=new Je,$o=new ui;class $n{constructor(e=0,t=0,n=0,s=$n.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,r=s[0],a=s[4],o=s[8],l=s[1],c=s[5],u=s[9],h=s[2],d=s[6],f=s[10];switch(t){case"XYZ":this._y=Math.asin(tt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-u,f),this._z=Math.atan2(-a,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-tt(u,-1,1)),Math.abs(u)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-h,r),this._z=0);break;case"ZXY":this._x=Math.asin(tt(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-h,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-tt(h,-1,1)),Math.abs(h)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(tt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-u,c),this._y=Math.atan2(-h,r)):(this._x=0,this._y=Math.atan2(o,f));break;case"XZY":this._z=Math.asin(-tt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,r)):(this._x=Math.atan2(-u,f),this._y=0);break;default:ze("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Yo.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Yo,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return $o.setFromEuler(this),this.setFromQuaternion($o,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}$n.DEFAULT_ORDER="XYZ";class _c{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Pd=0;const Zo=new G,mi=new ui,En=new Je,Is=new G,Xi=new G,Ld=new G,Id=new ui,Jo=new G(1,0,0),Qo=new G(0,1,0),jo=new G(0,0,1),el={type:"added"},Dd={type:"removed"},gi={type:"childadded",child:null},Yr={type:"childremoved",child:null};class Ht extends ci{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Pd++}),this.uuid=ys(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Ht.DEFAULT_UP.clone();const e=new G,t=new $n,n=new ui,s=new G(1,1,1);function r(){n.setFromEuler(t,!1)}function a(){t.setFromQuaternion(n,void 0,!1)}t._onChange(r),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Je},normalMatrix:{value:new We}}),this.matrix=new Je,this.matrixWorld=new Je,this.matrixAutoUpdate=Ht.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Ht.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new _c,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return mi.setFromAxisAngle(e,t),this.quaternion.multiply(mi),this}rotateOnWorldAxis(e,t){return mi.setFromAxisAngle(e,t),this.quaternion.premultiply(mi),this}rotateX(e){return this.rotateOnAxis(Jo,e)}rotateY(e){return this.rotateOnAxis(Qo,e)}rotateZ(e){return this.rotateOnAxis(jo,e)}translateOnAxis(e,t){return Zo.copy(e).applyQuaternion(this.quaternion),this.position.add(Zo.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Jo,e)}translateY(e){return this.translateOnAxis(Qo,e)}translateZ(e){return this.translateOnAxis(jo,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(En.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?Is.copy(e):Is.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Xi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?En.lookAt(Xi,Is,this.up):En.lookAt(Is,Xi,this.up),this.quaternion.setFromRotationMatrix(En),s&&(En.extractRotation(s.matrixWorld),mi.setFromRotationMatrix(En),this.quaternion.premultiply(mi.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(dt("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(el),gi.child=e,this.dispatchEvent(gi),gi.child=null):dt("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Dd),Yr.child=e,this.dispatchEvent(Yr),Yr.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),En.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),En.multiply(e.parent.matrixWorld)),e.applyMatrix4(En),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(el),gi.child=e,this.dispatchEvent(gi),gi.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const a=this.children[n].getObjectByProperty(e,t);if(a!==void 0)return a}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let r=0,a=s.length;r<a;r++)s[r].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Xi,e,Ld),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Xi,Id,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}intersectsFrustum(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,n=e.y,s=e.z,r=this.matrix.elements;r[12]+=t-r[0]*t-r[4]*n-r[8]*s,r[13]+=n-r[1]*t-r[5]*n-r[9]*s,r[14]+=s-r[2]*t-r[6]*n-r[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){const s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){const r=this.children;for(let a=0,o=r.length;a<o;a++)r[a].updateWorldMatrix(!1,!0,n)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,s.name=this.name,s.castShadow=this.castShadow,s.receiveShadow=this.receiveShadow,s.visible=this.visible,s.frustumCulled=this.frustumCulled,s.renderOrder=this.renderOrder,s.static=this.static,s.matrixAutoUpdate=this.matrixAutoUpdate,Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function r(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,u=l.length;c<u;c++){const h=l[c];r(e.shapes,h)}else r(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(r(e.materials,this.material[l]));s.material=o}else s.material=r(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(r(e.animations,l))}}if(t){const o=a(e.geometries),l=a(e.materials),c=a(e.textures),u=a(e.images),h=a(e.shapes),d=a(e.skeletons),f=a(e.animations),_=a(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),u.length>0&&(n.images=u),h.length>0&&(n.shapes=h),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),_.length>0&&(n.nodes=_)}return n.object=s,n;function a(o){const l=[];for(const c in o){const u=o[c];delete u.metadata,l.push(u)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}dispose(){this.dispatchEvent({type:"dispose"})}}Ht.DEFAULT_UP=new G(0,1,0);Ht.DEFAULT_MATRIX_AUTO_UPDATE=!0;Ht.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class si extends Ht{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Ud={type:"move"};class $r{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new si,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new si,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new G,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new G),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new si,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new G,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new G,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,r=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){a=!0;for(const b of e.hand.values()){const m=t.getJointPose(b,n),p=this._getHandJoint(c,b);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const u=c.joints["index-finger-tip"],h=c.joints["thumb-tip"],d=u.position.distanceTo(h.position),f=.02,_=.005;c.inputState.pinching&&d>f+_?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=f-_&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(r=t.getPose(e.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Ud)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new si;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const yc={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},zn={h:0,s:0,l:0},Ds={h:0,s:0,l:0};function Zr(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class Qe{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=Gt){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,et.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=et.workingColorSpace){return this.r=e,this.g=t,this.b=n,et.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=et.workingColorSpace){if(e=bd(e,1),t=tt(t,0,1),n=tt(n,0,1),t===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+t):n+t-n*t,a=2*n-r;this.r=Zr(a,r,e+1/3),this.g=Zr(a,r,e),this.b=Zr(a,r,e-1/3)}return et.colorSpaceToWorking(this,s),this}setStyle(e,t=Gt){function n(r){r!==void 0&&parseFloat(r)<1&&ze("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let r;const a=s[1],o=s[2];switch(a){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,t);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,t);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,t);break;default:ze("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const r=s[1],a=r.length;if(a===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,t);if(a===6)return this.setHex(parseInt(r,16),t);ze("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=Gt){const n=yc[e.toLowerCase()];return n!==void 0?this.setHex(n,t):ze("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=Un(e.r),this.g=Un(e.g),this.b=Un(e.b),this}copyLinearToSRGB(e){return this.r=Ii(e.r),this.g=Ii(e.g),this.b=Ii(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=Gt){return et.workingToColorSpace(Ot.copy(this),e),Math.round(tt(Ot.r*255,0,255))*65536+Math.round(tt(Ot.g*255,0,255))*256+Math.round(tt(Ot.b*255,0,255))}getHexString(e=Gt){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=et.workingColorSpace){et.workingToColorSpace(Ot.copy(this),t);const n=Ot.r,s=Ot.g,r=Ot.b,a=Math.max(n,s,r),o=Math.min(n,s,r);let l,c;const u=(o+a)/2;if(o===a)l=0,c=0;else{const h=a-o;switch(c=u<=.5?h/(a+o):h/(2-a-o),a){case n:l=(s-r)/h+(s<r?6:0);break;case s:l=(r-n)/h+2;break;case r:l=(n-s)/h+4;break}l/=6}return e.h=l,e.s=c,e.l=u,e}getRGB(e,t=et.workingColorSpace){return et.workingToColorSpace(Ot.copy(this),t),e.r=Ot.r,e.g=Ot.g,e.b=Ot.b,e}getStyle(e=Gt){et.workingToColorSpace(Ot.copy(this),e);const t=Ot.r,n=Ot.g,s=Ot.b;return e!==Gt?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(zn),this.setHSL(zn.h+e,zn.s+t,zn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(zn),e.getHSL(Ds);const n=Hr(zn.h,Ds.h,t),s=Hr(zn.s,Ds.s,t),r=Hr(zn.l,Ds.l,t);return this.setHSL(n,s,r),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,r=e.elements;return this.r=r[0]*t+r[3]*n+r[6]*s,this.g=r[1]*t+r[4]*n+r[7]*s,this.b=r[2]*t+r[5]*n+r[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ot=new Qe;Qe.NAMES=yc;class xc extends Ht{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new $n,this.environmentIntensity=1,this.environmentRotation=new $n,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),t.object.backgroundBlurriness=this.backgroundBlurriness,t.object.backgroundIntensity=this.backgroundIntensity,t.object.backgroundRotation=this.backgroundRotation.toArray(),t.object.environmentIntensity=this.environmentIntensity,t.object.environmentRotation=this.environmentRotation.toArray(),t}}const ln=new G,An=new G,Jr=new G,Rn=new G,_i=new G,yi=new G,tl=new G,Qr=new G,jr=new G,ea=new G,ta=new Mt,na=new Mt,ia=new Mt;class tn{constructor(e=new G,t=new G,n=new G){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),ln.subVectors(e,t),s.cross(ln);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(e,t,n,s,r){ln.subVectors(s,t),An.subVectors(n,t),Jr.subVectors(e,t);const a=ln.dot(ln),o=ln.dot(An),l=ln.dot(Jr),c=An.dot(An),u=An.dot(Jr),h=a*c-o*o;if(h===0)return r.set(0,0,0),null;const d=1/h,f=(c*l-o*u)*d,_=(a*u-o*l)*d;return r.set(1-f-_,_,f)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,Rn)===null?!1:Rn.x>=0&&Rn.y>=0&&Rn.x+Rn.y<=1}static getInterpolation(e,t,n,s,r,a,o,l){return this.getBarycoord(e,t,n,s,Rn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Rn.x),l.addScaledVector(a,Rn.y),l.addScaledVector(o,Rn.z),l)}static getInterpolatedAttribute(e,t,n,s,r,a){return ta.setScalar(0),na.setScalar(0),ia.setScalar(0),ta.fromBufferAttribute(e,t),na.fromBufferAttribute(e,n),ia.fromBufferAttribute(e,s),a.setScalar(0),a.addScaledVector(ta,r.x),a.addScaledVector(na,r.y),a.addScaledVector(ia,r.z),a}static isFrontFacing(e,t,n,s){return ln.subVectors(n,t),An.subVectors(e,t),ln.cross(An).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return ln.subVectors(this.c,this.b),An.subVectors(this.a,this.b),ln.cross(An).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return tn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return tn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,r){return tn.getInterpolation(e,this.a,this.b,this.c,t,n,s,r)}containsPoint(e){return tn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return tn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,r=this.c;let a,o;_i.subVectors(s,n),yi.subVectors(r,n),Qr.subVectors(e,n);const l=_i.dot(Qr),c=yi.dot(Qr);if(l<=0&&c<=0)return t.copy(n);jr.subVectors(e,s);const u=_i.dot(jr),h=yi.dot(jr);if(u>=0&&h<=u)return t.copy(s);const d=l*h-u*c;if(d<=0&&l>=0&&u<=0)return a=l/(l-u),t.copy(n).addScaledVector(_i,a);ea.subVectors(e,r);const f=_i.dot(ea),_=yi.dot(ea);if(_>=0&&f<=_)return t.copy(r);const b=f*c-l*_;if(b<=0&&c>=0&&_<=0)return o=c/(c-_),t.copy(n).addScaledVector(yi,o);const m=u*_-f*h;if(m<=0&&h-u>=0&&f-_>=0)return tl.subVectors(r,s),o=(h-u)/(h-u+(f-_)),t.copy(s).addScaledVector(tl,o);const p=1/(m+b+d);return a=b*p,o=d*p,t.copy(n).addScaledVector(_i,a).addScaledVector(yi,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class Zn{constructor(e=new G(1/0,1/0,1/0),t=new G(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(cn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(cn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=cn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const r=n.getAttribute("position");if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let a=0,o=r.count;a<o;a++)e.isMesh===!0?e.getVertexPosition(a,cn):cn.fromBufferAttribute(r,a),cn.applyMatrix4(e.matrixWorld),this.expandByPoint(cn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Us.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Us.copy(n.boundingBox)),Us.applyMatrix4(e.matrixWorld),this.union(Us)}const s=e.children;for(let r=0,a=s.length;r<a;r++)this.expandByObject(s[r],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,cn),cn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(qi),ks.subVectors(this.max,qi),xi.subVectors(e.a,qi),vi.subVectors(e.b,qi),bi.subVectors(e.c,qi),Gn.subVectors(vi,xi),Vn.subVectors(bi,vi),Qn.subVectors(xi,bi);let t=[0,-Gn.z,Gn.y,0,-Vn.z,Vn.y,0,-Qn.z,Qn.y,Gn.z,0,-Gn.x,Vn.z,0,-Vn.x,Qn.z,0,-Qn.x,-Gn.y,Gn.x,0,-Vn.y,Vn.x,0,-Qn.y,Qn.x,0];return!sa(t,xi,vi,bi,ks)||(t=[1,0,0,0,1,0,0,0,1],!sa(t,xi,vi,bi,ks))?!1:(Ns.crossVectors(Gn,Vn),t=[Ns.x,Ns.y,Ns.z],sa(t,xi,vi,bi,ks))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,cn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(cn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(Cn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),Cn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),Cn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),Cn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),Cn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),Cn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),Cn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),Cn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(Cn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const Cn=[new G,new G,new G,new G,new G,new G,new G,new G],cn=new G,Us=new Zn,xi=new G,vi=new G,bi=new G,Gn=new G,Vn=new G,Qn=new G,qi=new G,ks=new G,Ns=new G,jn=new G;function sa(i,e,t,n,s){for(let r=0,a=i.length-3;r<=a;r+=3){jn.fromArray(i,r);const o=s.x*Math.abs(jn.x)+s.y*Math.abs(jn.y)+s.z*Math.abs(jn.z),l=e.dot(jn),c=t.dot(jn),u=n.dot(jn);if(Math.max(-Math.max(l,c,u),Math.min(l,c,u))>o)return!1}return!0}const Et=new G,Fs=new ct;let kd=0;class Rt extends ci{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:kd++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=gd,this.updateRanges=[],this.gpuType=hn,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Fs.fromBufferAttribute(this,t),Fs.applyMatrix3(e),this.setXY(t,Fs.x,Fs.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Et.fromBufferAttribute(this,t),Et.applyMatrix3(e),this.setXYZ(t,Et.x,Et.y,Et.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Et.fromBufferAttribute(this,t),Et.applyMatrix4(e),this.setXYZ(t,Et.x,Et.y,Et.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Et.fromBufferAttribute(this,t),Et.applyNormalMatrix(e),this.setXYZ(t,Et.x,Et.y,Et.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Et.fromBufferAttribute(this,t),Et.transformDirection(e),this.setXYZ(t,Et.x,Et.y,Et.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=Wi(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Xt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=Wi(t,this.array)),t}setX(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=Wi(t,this.array)),t}setY(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=Wi(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=Wi(t,this.array)),t}setW(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Xt(t,this.array),n=Xt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=Xt(t,this.array),n=Xt(n,this.array),s=Xt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,r){return e*=this.itemSize,this.normalized&&(t=Xt(t,this.array),n=Xt(n,this.array),s=Xt(s,this.array),r=Xt(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=r,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return e.name=this.name,e.usage=this.usage,e.gpuType=this.gpuType,e}dispose(){this.dispatchEvent({type:"dispose"})}}class vc extends Rt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class bc extends Rt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class Bt extends Rt{constructor(e,t,n){super(new Float32Array(e),t,n)}}const Nd=new Zn,Ki=new G,ra=new G;class Jn{constructor(e=new G,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Nd.setFromPoints(e).getCenter(n);let s=0;for(let r=0,a=e.length;r<a;r++)s=Math.max(s,n.distanceToSquared(e[r]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Ki.subVectors(e,this.center);const t=Ki.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(Ki,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(ra.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Ki.copy(e.center).add(ra)),this.expandByPoint(Ki.copy(e.center).sub(ra))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let Fd=0;const Qt=new Je,aa=new Ht,Si=new G,$t=new Zn,Yi=new Zn,Lt=new G;class Tt extends ci{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Fd++}),this.uuid=ys(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(_d(e)?bc:vc)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new We().getNormalMatrix(e);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return Qt.makeRotationFromQuaternion(e),this.applyMatrix4(Qt),this}rotateX(e){return Qt.makeRotationX(e),this.applyMatrix4(Qt),this}rotateY(e){return Qt.makeRotationY(e),this.applyMatrix4(Qt),this}rotateZ(e){return Qt.makeRotationZ(e),this.applyMatrix4(Qt),this}translate(e,t,n){return Qt.makeTranslation(e,t,n),this.applyMatrix4(Qt),this}scale(e,t,n){return Qt.makeScale(e,t,n),this.applyMatrix4(Qt),this}lookAt(e){return aa.lookAt(e),aa.updateMatrix(),this.applyMatrix4(aa.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Si).negate(),this.translate(Si.x,Si.y,Si.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,r=e.length;s<r;s++){const a=e[s];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Bt(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const r=e[s];t.setXYZ(s,r.x,r.y,r.z||0)}e.length>t.count&&ze("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Zn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){dt("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new G(-1/0,-1/0,-1/0),new G(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const r=t[n];$t.setFromBufferAttribute(r),this.morphTargetsRelative?(Lt.addVectors(this.boundingBox.min,$t.min),this.boundingBox.expandByPoint(Lt),Lt.addVectors(this.boundingBox.max,$t.max),this.boundingBox.expandByPoint(Lt)):(this.boundingBox.expandByPoint($t.min),this.boundingBox.expandByPoint($t.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&dt('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Jn);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){dt("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new G,1/0);return}if(e){const n=this.boundingSphere.center;if($t.setFromBufferAttribute(e),t)for(let r=0,a=t.length;r<a;r++){const o=t[r];Yi.setFromBufferAttribute(o),this.morphTargetsRelative?(Lt.addVectors($t.min,Yi.min),$t.expandByPoint(Lt),Lt.addVectors($t.max,Yi.max),$t.expandByPoint(Lt)):($t.expandByPoint(Yi.min),$t.expandByPoint(Yi.max))}$t.getCenter(n);let s=0;for(let r=0,a=e.count;r<a;r++)Lt.fromBufferAttribute(e,r),s=Math.max(s,n.distanceToSquared(Lt));if(t)for(let r=0,a=t.length;r<a;r++){const o=t[r],l=this.morphTargetsRelative;for(let c=0,u=o.count;c<u;c++)Lt.fromBufferAttribute(o,c),l&&(Si.fromBufferAttribute(e,c),Lt.add(Si)),s=Math.max(s,n.distanceToSquared(Lt))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&dt('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){dt("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,r=t.uv;let a=this.getAttribute("tangent");(a===void 0||a.count!==n.count)&&(a=new Rt(new Float32Array(4*n.count),4),this.setAttribute("tangent",a));const o=[],l=[];for(let y=0;y<n.count;y++)o[y]=new G,l[y]=new G;const c=new G,u=new G,h=new G,d=new ct,f=new ct,_=new ct,b=new G,m=new G;function p(y,w,M){c.fromBufferAttribute(n,y),u.fromBufferAttribute(n,w),h.fromBufferAttribute(n,M),d.fromBufferAttribute(r,y),f.fromBufferAttribute(r,w),_.fromBufferAttribute(r,M),u.sub(c),h.sub(c),f.sub(d),_.sub(d);const N=1/(f.x*_.y-_.x*f.y);isFinite(N)&&(b.copy(u).multiplyScalar(_.y).addScaledVector(h,-f.y).multiplyScalar(N),m.copy(h).multiplyScalar(f.x).addScaledVector(u,-_.x).multiplyScalar(N),o[y].add(b),o[w].add(b),o[M].add(b),l[y].add(m),l[w].add(m),l[M].add(m))}let T=this.groups;T.length===0&&(T=[{start:0,count:e.count}]);for(let y=0,w=T.length;y<w;++y){const M=T[y],N=M.start,W=M.count;for(let z=N,C=N+W;z<C;z+=3)p(e.getX(z+0),e.getX(z+1),e.getX(z+2))}const P=new G,S=new G,R=new G,A=new G;function L(y){R.fromBufferAttribute(s,y),A.copy(R);const w=o[y];P.copy(w),P.sub(R.multiplyScalar(R.dot(w))).normalize(),S.crossVectors(A,w);const N=S.dot(l[y])<0?-1:1;a.setXYZW(y,P.x,P.y,P.z,N)}for(let y=0,w=T.length;y<w;++y){const M=T[y],N=M.start,W=M.count;for(let z=N,C=N+W;z<C;z+=3)L(e.getX(z+0)),L(e.getX(z+1)),L(e.getX(z+2))}this._transformed=!0}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Rt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);const s=new G,r=new G,a=new G,o=new G,l=new G,c=new G,u=new G,h=new G;if(e)for(let d=0,f=e.count;d<f;d+=3){const _=e.getX(d+0),b=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,_),r.fromBufferAttribute(t,b),a.fromBufferAttribute(t,m),u.subVectors(a,r),h.subVectors(s,r),u.cross(h),o.fromBufferAttribute(n,_),l.fromBufferAttribute(n,b),c.fromBufferAttribute(n,m),o.add(u),l.add(u),c.add(u),n.setXYZ(_,o.x,o.y,o.z),n.setXYZ(b,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,f=t.count;d<f;d+=3)s.fromBufferAttribute(t,d+0),r.fromBufferAttribute(t,d+1),a.fromBufferAttribute(t,d+2),u.subVectors(a,r),h.subVectors(s,r),u.cross(h),n.setXYZ(d+0,u.x,u.y,u.z),n.setXYZ(d+1,u.x,u.y,u.z),n.setXYZ(d+2,u.x,u.y,u.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)Lt.fromBufferAttribute(e,t),Lt.normalize(),e.setXYZ(t,Lt.x,Lt.y,Lt.z)}toNonIndexed(){function e(o,l){const c=o.array,u=o.itemSize,h=o.normalized,d=new c.constructor(l.length*u);let f=0,_=0;for(let b=0,m=l.length;b<m;b++){o.isInterleavedBufferAttribute?f=l[b]*o.data.stride+o.offset:f=l[b]*u;for(let p=0;p<u;p++)d[_++]=c[f++]}return new Rt(d,u,h)}if(this.index===null)return ze("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Tt,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const r=this.morphAttributes;for(const o in r){const l=[],c=r[o];for(let u=0,h=c.length;u<h;u++){const d=c[u],f=e(d,n);l.push(f)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,e.name=this.name,Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],u=[];for(let h=0,d=c.length;h<d;h++){const f=c[h];u.push(f.toJSON(e.data))}u.length>0&&(s[l]=u,r=!0)}r&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const u=s[c];this.setAttribute(c,u.clone(t))}const r=e.morphAttributes;for(const c in r){const u=[],h=r[c];for(let d=0,f=h.length;d<f;d++)u.push(h[d].clone(t));this.morphAttributes[c]=u}this.morphTargetsRelative=e.morphTargetsRelative;const a=e.groups;for(let c=0,u=a.length;c<u;c++){const h=a[c];this.addGroup(h.start,h.count,h.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}const oa=new G,Od=new G,Bd=new We;class qn{constructor(e=new G(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=oa.subVectors(n,t).cross(Od.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){const s=e.delta(oa),r=this.normal.dot(s);if(r===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const a=-(e.start.dot(this.normal)+this.constant)/r;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(s,a)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Bd.getNormalMatrix(e),s=this.coplanarPoint(oa).applyMatrix4(e),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}toJSON(){return{normal:this.normal.toArray(),constant:this.constant}}fromJSON(e){return this.normal.fromArray(e.normal),this.constant=e.constant,this}}let zd=0;class Fi extends ci{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:zd++}),this.uuid=ys(),this.name="",this.type="Material",this.blending=cs,this.side=Yn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=jl,this.blendDst=ec,this.blendEquation=Ai,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Qe(0,0,0),this.blendAlpha=0,this.depthFunc=us,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=cd,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Vr,this.stencilZFail=Vr,this.stencilZPass=Vr,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){ze(`Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){ze(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,n.blending=this.blending,n.side=this.side,n.shadowSide=this.shadowSide,n.vertexColors=this.vertexColors,n.opacity=this.opacity,n.transparent=this.transparent,n.blendSrc=this.blendSrc,n.blendDst=this.blendDst,n.blendEquation=this.blendEquation,n.blendSrcAlpha=this.blendSrcAlpha,n.blendDstAlpha=this.blendDstAlpha,n.blendEquationAlpha=this.blendEquationAlpha,n.blendColor=this.blendColor.getHex(),n.blendAlpha=this.blendAlpha,n.depthFunc=this.depthFunc,n.depthTest=this.depthTest,n.depthWrite=this.depthWrite,n.colorWrite=this.colorWrite,n.clipIntersection=this.clipIntersection,n.clipShadows=this.clipShadows,n.stencilWriteMask=this.stencilWriteMask,n.stencilFunc=this.stencilFunc,n.stencilRef=this.stencilRef,n.stencilFuncMask=this.stencilFuncMask,n.stencilFail=this.stencilFail,n.stencilZFail=this.stencilZFail,n.stencilZPass=this.stencilZPass,n.stencilWrite=this.stencilWrite,n.polygonOffset=this.polygonOffset,n.polygonOffsetFactor=this.polygonOffsetFactor,n.polygonOffsetUnits=this.polygonOffsetUnits,n.dithering=this.dithering,n.alphaTest=this.alphaTest,n.alphaHash=this.alphaHash,n.alphaToCoverage=this.alphaToCoverage,n.premultipliedAlpha=this.premultipliedAlpha,n.forceSinglePass=this.forceSinglePass,n.allowOverride=this.allowOverride,n.visible=this.visible,n.toneMapped=this.toneMapped,n.name=this.name,this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.retroreflectivity!==void 0&&(n.retroreflectivity=this.retroreflectivity),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),Array.isArray(this.clippingPlanes)&&this.clippingPlanes.length>0&&(n.clippingPlanes=this.clippingPlanes.map(r=>r.toJSON())),this.rotation!==void 0&&(n.rotation=this.rotation),this.depthPacking!==void 0&&(n.depthPacking=this.depthPacking),this.linewidth!==void 0&&(n.linewidth=this.linewidth),this.linecap!==void 0&&(n.linecap=this.linecap),this.linejoin!==void 0&&(n.linejoin=this.linejoin),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.wireframe!==void 0&&(n.wireframe=this.wireframe),this.wireframeLinewidth!==void 0&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==void 0&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==void 0&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading!==void 0&&(n.flatShading=this.flatShading),this.fog!==void 0&&(n.fog=this.fog),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const a=[];for(const o in r){const l=r[o];delete l.metadata,a.push(l)}return a}if(t){const r=s(e.textures),a=s(e.images);r.length>0&&(n.textures=r),a.length>0&&(n.images=a)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Qe().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.retroreflectivity!==void 0&&(this.retroreflectivity=e.retroreflectivity),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.clippingPlanes!==void 0&&(this.clippingPlanes=e.clippingPlanes.map(n=>new qn().fromJSON(n))),e.clipIntersection!==void 0&&(this.clipIntersection=e.clipIntersection),e.clipShadows!==void 0&&(this.clipShadows=e.clipShadows),e.depthPacking!==void 0&&(this.depthPacking=e.depthPacking),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.linecap!==void 0&&(this.linecap=e.linecap),e.linejoin!==void 0&&(this.linejoin=e.linejoin),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new ct().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ct().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}const Pn=new G,la=new G,Os=new G,Bs=new G;class Po{constructor(e=new G,t=new G(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Pn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Pn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Pn.copy(this.origin).addScaledVector(this.direction,t),Pn.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){la.copy(e).add(t).multiplyScalar(.5),Os.copy(t).sub(e).normalize(),Bs.copy(this.origin).sub(la);const r=e.distanceTo(t)*.5,a=-this.direction.dot(Os),o=Bs.dot(this.direction),l=-Bs.dot(Os),c=Bs.lengthSq(),u=Math.abs(1-a*a);let h,d,f,_;if(u>0)if(h=a*l-o,d=a*o-l,_=r*u,h>=0)if(d>=-_)if(d<=_){const b=1/u;h*=b,d*=b,f=h*(h+a*d+2*o)+d*(a*h+d+2*l)+c}else d=r,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;else d=-r,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;else d<=-_?(h=Math.max(0,-(-a*r+o)),d=h>0?-r:Math.min(Math.max(-r,-l),r),f=-h*h+d*(d+2*l)+c):d<=_?(h=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(h=Math.max(0,-(a*r+o)),d=h>0?r:Math.min(Math.max(-r,-l),r),f=-h*h+d*(d+2*l)+c);else d=a>0?-r:r,h=Math.max(0,-(a*d+o)),f=-h*h+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,h),s&&s.copy(la).addScaledVector(Os,d),f}intersectSphere(e,t){if(e.radius<0)return null;Pn.subVectors(e.center,this.origin);const n=Pn.dot(this.direction),s=Pn.dot(Pn)-n*n,r=e.radius*e.radius;if(s>r)return null;const a=Math.sqrt(r-s),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,r,a,o,l;const c=1/this.direction.x,u=1/this.direction.y,h=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),u>=0?(r=(e.min.y-d.y)*u,a=(e.max.y-d.y)*u):(r=(e.max.y-d.y)*u,a=(e.min.y-d.y)*u),n>a||r>s||((r>n||isNaN(n))&&(n=r),(a<s||isNaN(s))&&(s=a),h>=0?(o=(e.min.z-d.z)*h,l=(e.max.z-d.z)*h):(o=(e.max.z-d.z)*h,l=(e.min.z-d.z)*h),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,Pn)!==null}intersectTriangle(e,t,n,s,r){const a=this.origin,o=this.direction,l=o.x,c=o.y,u=o.z,h=e.x-a.x,d=e.y-a.y,f=e.z-a.z,_=t.x-a.x,b=t.y-a.y,m=t.z-a.z,p=n.x-a.x,T=n.y-a.y,P=n.z-a.z,S=Math.abs(l),R=Math.abs(c),A=Math.abs(u);let L,y,w,M,N,W,z,C,V,O,I,j;if(S>=R&&S>=A?(w=l,W=h,V=_,j=p,l>=0?(L=c,y=u,M=d,N=f,z=b,C=m,O=T,I=P):(L=u,y=c,M=f,N=d,z=m,C=b,O=P,I=T)):R>=A?(w=c,W=d,V=b,j=T,c>=0?(L=u,y=l,M=f,N=h,z=m,C=_,O=P,I=p):(L=l,y=u,M=h,N=f,z=_,C=m,O=p,I=P)):(w=u,W=f,V=m,j=P,u>=0?(L=l,y=c,M=h,N=d,z=_,C=b,O=p,I=T):(L=c,y=l,M=d,N=h,z=b,C=_,O=T,I=p)),w===0)return null;const H=L/w,X=y/w,J=1/w,Se=M-H*W,ve=N-X*W,He=z-H*V,Ne=C-X*V,Oe=O-H*j,$=I-X*j,ne=Oe*Ne-$*He,le=Se*$-ve*Oe,Ee=He*ve-Ne*Se;if(s){if(ne<0||le<0||Ee<0)return null}else if((ne<0||le<0||Ee<0)&&(ne>0||le>0||Ee>0))return null;const he=ne+le+Ee;if(he===0)return null;const Fe=J*(ne*W+le*V+Ee*j);return(he>0?Fe<0:Fe>0)?null:this.at(Fe/he,r)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class kn extends Fi{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Qe(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new $n,this.combine=tc,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const nl=new Je,ei=new Po,zs=new Jn,il=new G,Gs=new G,Vs=new G,Hs=new G,ca=new G,Ws=new G,sl=new G,Xs=new G;class kt extends Ht{constructor(e=new Tt,t=new kn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(r&&o){Ws.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const u=o[l],h=r[l];u!==0&&(ca.fromBufferAttribute(h,e),a?Ws.addScaledVector(ca,u):Ws.addScaledVector(ca.sub(t),u))}t.add(Ws)}return t}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),zs.copy(n.boundingSphere),zs.applyMatrix4(r),ei.copy(e.ray).recast(e.near),!(zs.containsPoint(ei.origin)===!1&&(ei.intersectSphere(zs,il)===null||ei.origin.distanceToSquared(il)>(e.far-e.near)**2))&&(nl.copy(r).invert(),ei.copy(e.ray).applyMatrix4(nl),!(n.boundingBox!==null&&ei.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,ei)))}_computeIntersections(e,t,n){let s;const r=this.geometry,a=this.material,o=r.index,l=r.attributes.position,c=r.attributes.uv,u=r.attributes.uv1,h=r.attributes.normal,d=r.groups,f=r.drawRange;if(o!==null)if(Array.isArray(a))for(let _=0,b=d.length;_<b;_++){const m=d[_],p=a[m.materialIndex],T=Math.max(m.start,f.start),P=Math.min(o.count,Math.min(m.start+m.count,f.start+f.count));for(let S=T,R=P;S<R;S+=3){const A=o.getX(S),L=o.getX(S+1),y=o.getX(S+2);s=qs(this,p,e,n,c,u,h,A,L,y),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,f.start),b=Math.min(o.count,f.start+f.count);for(let m=_,p=b;m<p;m+=3){const T=o.getX(m),P=o.getX(m+1),S=o.getX(m+2);s=qs(this,a,e,n,c,u,h,T,P,S),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(a))for(let _=0,b=d.length;_<b;_++){const m=d[_],p=a[m.materialIndex],T=Math.max(m.start,f.start),P=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let S=T,R=P;S<R;S+=3){const A=S,L=S+1,y=S+2;s=qs(this,p,e,n,c,u,h,A,L,y),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const _=Math.max(0,f.start),b=Math.min(l.count,f.start+f.count);for(let m=_,p=b;m<p;m+=3){const T=m,P=m+1,S=m+2;s=qs(this,a,e,n,c,u,h,T,P,S),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function Gd(i,e,t,n,s,r,a,o){let l;if(e.side===qt?l=n.intersectTriangle(a,r,s,!0,o):l=n.intersectTriangle(s,r,a,e.side===Yn,o),l===null)return null;Xs.copy(o),Xs.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(Xs);return c<t.near||c>t.far?null:{distance:c,point:Xs.clone(),object:i}}function qs(i,e,t,n,s,r,a,o,l,c){i.getVertexPosition(o,Gs),i.getVertexPosition(l,Vs),i.getVertexPosition(c,Hs);const u=Gd(i,e,t,n,Gs,Vs,Hs,sl);if(u){const h=new G;tn.getBarycoord(sl,Gs,Vs,Hs,h),s&&(u.uv=tn.getInterpolatedAttribute(s,o,l,c,h,new ct)),r&&(u.uv1=tn.getInterpolatedAttribute(r,o,l,c,h,new ct)),a&&(u.normal=tn.getInterpolatedAttribute(a,o,l,c,h,new G),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new G,materialIndex:0};tn.getNormal(Gs,Vs,Hs,d.normal),u.face=d,u.barycoord=h}return u}class Di extends Vt{constructor(e=null,t=1,n=1,s,r,a,o,l,c=At,u=At,h,d){super(null,a,o,l,c,u,s,r,h,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ho extends Rt{constructor(e,t,n,s=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){const e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}}const Mi=new Je,rl=new Je,Ks=[],al=new Zn,Vd=new Je,$i=new kt,Zi=new Jn;class xs extends kt{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new ho(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Vd)}computeBoundingBox(){const e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Zn),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Mi),al.copy(e.boundingBox).applyMatrix4(Mi),this.boundingBox.union(al)}computeBoundingSphere(){const e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new Jn),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Mi),Zi.copy(e.boundingSphere).applyMatrix4(Mi),this.boundingSphere.union(Zi)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){const n=t.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,a=e*r+1;for(let o=0;o<n.length;o++)n[o]=s[a+o]}raycast(e,t){const n=this.matrixWorld,s=this.count;if($i.geometry=this.geometry,$i.material=this.material,$i.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Zi.copy(this.boundingSphere),Zi.applyMatrix4(n),e.ray.intersectsSphere(Zi)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Mi),rl.multiplyMatrices(n,Mi),$i.matrixWorld=rl,$i.raycast(e,Ks);for(let a=0,o=Ks.length;a<o;a++){const l=Ks[a];l.instanceId=r,l.object=this,t.push(l)}Ks.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new ho(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){const n=t.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new Di(new Float32Array(s*this.count),s,this.count,So,hn));const r=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=s*e;return r[l]=o,r.set(n,l+1),this}updateMorphTargets(){}dispose(){super.dispose(),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const ti=new Jn,Hd=new ct(.5,.5),Ys=new G;class Sc{constructor(e=new qn,t=new qn,n=new qn,s=new qn,r=new qn,a=new qn){this.planes=[e,t,n,s,r,a]}set(e,t,n,s,r,a){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(r),o[5].copy(a),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=bn,n=!1){const s=this.planes,r=e.elements,a=r[0],o=r[1],l=r[2],c=r[3],u=r[4],h=r[5],d=r[6],f=r[7],_=r[8],b=r[9],m=r[10],p=r[11],T=r[12],P=r[13],S=r[14],R=r[15];if(s[0].setComponents(c-a,f-u,p-_,R-T).normalize(),s[1].setComponents(c+a,f+u,p+_,R+T).normalize(),s[2].setComponents(c+o,f+h,p+b,R+P).normalize(),s[3].setComponents(c-o,f-h,p-b,R-P).normalize(),n)s[4].setComponents(l,d,m,S).normalize(),s[5].setComponents(c-l,f-d,p-m,R-S).normalize();else if(s[4].setComponents(c-l,f-d,p-m,R-S).normalize(),t===bn)s[5].setComponents(c+l,f+d,p+m,R+S).normalize();else if(t===Sr)s[5].setComponents(l,d,m,S).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ti.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ti.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ti)}intersectsSprite(e){ti.center.set(0,0,0);const t=Hd.distanceTo(e.center);return ti.radius=.7071067811865476+t,ti.applyMatrix4(e.matrixWorld),this.intersectsSphere(ti)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let r=0;r<6;r++)if(t[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(Ys.x=s.normal.x>0?e.max.x:e.min.x,Ys.y=s.normal.y>0?e.max.y:e.min.y,Ys.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Ys)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Lo extends Fi{constructor(e){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new Qe(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.linewidth=e.linewidth,this.linecap=e.linecap,this.linejoin=e.linejoin,this.fog=e.fog,this}}const wr=new G,Tr=new G,ol=new Je,Ji=new Po,$s=new Jn,ua=new G,ll=new G;class Wd extends Ht{constructor(e=new Tt,t=new Lo){super(),this.isLine=!0,this.type="Line",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[0];for(let s=1,r=t.count;s<r;s++)wr.fromBufferAttribute(t,s-1),Tr.fromBufferAttribute(t,s),n[s]=n[s-1],n[s]+=wr.distanceTo(Tr);e.setAttribute("lineDistance",new Bt(n,1))}else ze("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),$s.copy(n.boundingSphere),$s.applyMatrix4(s),$s.radius+=r,e.ray.intersectsSphere($s)===!1)return;ol.copy(s).invert(),Ji.copy(e.ray).applyMatrix4(ol);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,u=n.index,d=n.attributes.position;if(u!==null){const f=Math.max(0,a.start),_=Math.min(u.count,a.start+a.count);for(let b=f,m=_-1;b<m;b+=c){const p=u.getX(b),T=u.getX(b+1),P=Zs(this,e,Ji,l,p,T,b);P&&t.push(P)}if(this.isLineLoop){const b=u.getX(_-1),m=u.getX(f),p=Zs(this,e,Ji,l,b,m,_-1);p&&t.push(p)}}else{const f=Math.max(0,a.start),_=Math.min(d.count,a.start+a.count);for(let b=f,m=_-1;b<m;b+=c){const p=Zs(this,e,Ji,l,b,b+1,b);p&&t.push(p)}if(this.isLineLoop){const b=Zs(this,e,Ji,l,_-1,f,_-1);b&&t.push(b)}}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function Zs(i,e,t,n,s,r,a){const o=i.geometry.attributes.position;if(wr.fromBufferAttribute(o,s),Tr.fromBufferAttribute(o,r),t.distanceSqToSegment(wr,Tr,ua,ll)>n)return;ua.applyMatrix4(i.matrixWorld);const c=e.ray.origin.distanceTo(ua);if(!(c<e.near||c>e.far))return{distance:c,point:ll.clone().applyMatrix4(i.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:i}}const cl=new G,ul=new G;class Mc extends Wd{constructor(e,t){super(e,t),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const e=this.geometry;if(e.index===null){const t=e.attributes.position,n=[];for(let s=0,r=t.count;s<r;s+=2)cl.fromBufferAttribute(t,s),ul.fromBufferAttribute(t,s+1),n[s]=s===0?0:n[s-1],n[s+1]=n[s]+cl.distanceTo(ul);e.setAttribute("lineDistance",new Bt(n,1))}else ze("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class Io extends Fi{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Qe(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const dl=new Je,fo=new Po,Js=new Jn,Qs=new G;class wc extends Ht{constructor(e=new Tt,t=new Io){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}intersectsFrustum(e){return e.intersectsObject(this)}raycast(e,t){const n=this.geometry,s=this.matrixWorld,r=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Js.copy(n.boundingSphere),Js.applyMatrix4(s),Js.radius+=r,e.ray.intersectsSphere(Js)===!1)return;dl.copy(s).invert(),fo.copy(e.ray).applyMatrix4(dl);const o=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,h=n.attributes.position;if(c!==null){const d=Math.max(0,a.start),f=Math.min(c.count,a.start+a.count);for(let _=d,b=f;_<b;_++){const m=c.getX(_);Qs.fromBufferAttribute(h,m),hl(Qs,m,l,s,e,t,this)}}else{const d=Math.max(0,a.start),f=Math.min(h.count,a.start+a.count);for(let _=d,b=f;_<b;_++)Qs.fromBufferAttribute(h,_),hl(Qs,_,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,a=s.length;r<a;r++){const o=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=r}}}}}function hl(i,e,t,n,s,r,a){const o=fo.distanceSqToPoint(i);if(o<t){const l=new G;fo.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:a})}}class Tc extends Vt{constructor(e=[],t=ri,n,s,r,a,o,l,c,u){super(e,t,n,s,r,a,o,l,c,u),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class gs extends Vt{constructor(e,t,n=Mn,s,r,a,o=At,l=At,c,u=Nn,h=1){if(u!==Nn&&u!==ii)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:h};super(d,s,r,a,o,l,u,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new Ro(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return t.compareFunction=this.compareFunction,t}}class Xd extends gs{constructor(e,t=Mn,n=ri,s,r,a=At,o=At,l,c=Nn){const u={width:e,height:e,depth:1},h=[u,u,u,u,u,u];super(e,e,t,n,s,r,a,o,l,c),this.image=h,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class Ec extends Vt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class pn extends Tt{constructor(e=1,t=1,n=1,s=1,r=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:r,depthSegments:a};const o=this;s=Math.floor(s),r=Math.floor(r),a=Math.floor(a);const l=[],c=[],u=[],h=[];let d=0,f=0;_("z","y","x",-1,-1,n,t,e,a,r,0),_("z","y","x",1,-1,n,t,-e,a,r,1),_("x","z","y",1,1,e,n,t,s,a,2),_("x","z","y",1,-1,e,n,-t,s,a,3),_("x","y","z",1,-1,e,t,n,s,r,4),_("x","y","z",-1,-1,e,t,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new Bt(c,3)),this.setAttribute("normal",new Bt(u,3)),this.setAttribute("uv",new Bt(h,2));function _(b,m,p,T,P,S,R,A,L,y,w){const M=S/L,N=R/y,W=S/2,z=R/2,C=A/2,V=L+1,O=y+1;let I=0,j=0;const H=new G;for(let X=0;X<O;X++){const J=X*N-z;for(let Se=0;Se<V;Se++){const ve=Se*M-W;H[b]=ve*T,H[m]=J*P,H[p]=C,c.push(H.x,H.y,H.z),H[b]=0,H[m]=0,H[p]=A>0?1:-1,u.push(H.x,H.y,H.z),h.push(Se/L),h.push(1-X/y),I+=1}}for(let X=0;X<y;X++)for(let J=0;J<L;J++){const Se=d+J+V*X,ve=d+J+V*(X+1),He=d+(J+1)+V*(X+1),Ne=d+(J+1)+V*X;l.push(Se,ve,Ne),l.push(ve,He,Ne),j+=6}o.addGroup(f,j,w),f+=j,d+=I}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new pn(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class Er extends Tt{constructor(e=1,t=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:s},t=Math.max(3,t);const r=[],a=[],o=[],l=[],c=new G,u=new ct;a.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let h=0,d=3;h<=t;h++,d+=3){const f=n+h/t*s;c.x=e*Math.cos(f),c.y=e*Math.sin(f),a.push(c.x,c.y,c.z),o.push(0,0,1),u.x=(a[d]/e+1)/2,u.y=(a[d+1]/e+1)/2,l.push(u.x,u.y)}for(let h=1;h<=t;h++)r.push(h,h+1,0);this.setIndex(r),this.setAttribute("position",new Bt(a,3)),this.setAttribute("normal",new Bt(o,3)),this.setAttribute("uv",new Bt(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Er(e.radius,e.segments,e.thetaStart,e.thetaLength)}}const js=new G,er=new G,da=new G,tr=new tn;class qd extends Tt{constructor(e=null,t=1){if(super(),this.type="EdgesGeometry",this.parameters={geometry:e,thresholdAngle:t},e!==null){const s=Math.pow(10,4),r=Math.cos(gr*t),a=e.getIndex(),o=e.getAttribute("position"),l=a?a.count:o.count,c=[0,0,0],u=["a","b","c"],h=new Array(3),d={},f=[];for(let _=0;_<l;_+=3){a?(c[0]=a.getX(_),c[1]=a.getX(_+1),c[2]=a.getX(_+2)):(c[0]=_,c[1]=_+1,c[2]=_+2);const{a:b,b:m,c:p}=tr;if(b.fromBufferAttribute(o,c[0]),m.fromBufferAttribute(o,c[1]),p.fromBufferAttribute(o,c[2]),tr.getNormal(da),h[0]=`${Math.round(b.x*s)},${Math.round(b.y*s)},${Math.round(b.z*s)}`,h[1]=`${Math.round(m.x*s)},${Math.round(m.y*s)},${Math.round(m.z*s)}`,h[2]=`${Math.round(p.x*s)},${Math.round(p.y*s)},${Math.round(p.z*s)}`,!(h[0]===h[1]||h[1]===h[2]||h[2]===h[0]))for(let T=0;T<3;T++){const P=(T+1)%3,S=h[T],R=h[P],A=tr[u[T]],L=tr[u[P]],y=`${S}_${R}`,w=`${R}_${S}`;w in d&&d[w]?(da.dot(d[w].normal)<=r&&(f.push(A.x,A.y,A.z),f.push(L.x,L.y,L.z)),d[w]=null):y in d||(d[y]={index0:c[T],index1:c[P],normal:da.clone()})}}for(const _ in d)if(d[_]){const{index0:b,index1:m}=d[_];js.fromBufferAttribute(o,b),er.fromBufferAttribute(o,m),f.push(js.x,js.y,js.z),f.push(er.x,er.y,er.z)}this.setAttribute("position",new Bt(f,3))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}}class Oi extends Tt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const r=e/2,a=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,u=l+1,h=e/o,d=t/l,f=[],_=[],b=[],m=[];for(let p=0;p<u;p++){const T=p*d-a;for(let P=0;P<c;P++){const S=P*h-r;_.push(S,-T,0),b.push(0,0,1),m.push(P/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let T=0;T<o;T++){const P=T+c*p,S=T+c*(p+1),R=T+1+c*(p+1),A=T+1+c*p;f.push(P,S,A),f.push(S,R,A)}this.setIndex(f),this.setAttribute("position",new Bt(_,3)),this.setAttribute("normal",new Bt(b,3)),this.setAttribute("uv",new Bt(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Oi(e.width,e.height,e.widthSegments,e.heightSegments)}}function ki(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];if(fl(s))s.isRenderTargetTexture?(ze("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone();else if(Array.isArray(s))if(fl(s[0])){const r=[];for(let a=0,o=s.length;a<o;a++)r[a]=s[a].clone();e[t][n]=r}else e[t][n]=s.slice();else e[t][n]=s}}return e}function zt(i){const e={};for(let t=0;t<i.length;t++){const n=ki(i[t]);for(const s in n)e[s]=n[s]}return e}function fl(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function Kd(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function Ac(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:et.workingColorSpace}const Yd={clone:ki,merge:zt};var $d=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Zd=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Tn extends Fi{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=$d,this.fragmentShader=Zd,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=ki(e.uniforms),this.uniformsGroups=Kd(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const a=this.uniforms[s].value;a&&a.isTexture?t.uniforms[s]={type:"t",value:a.toJSON(e).uuid}:a&&a.isColor?t.uniforms[s]={type:"c",value:a.getHex()}:a&&a.isVector2?t.uniforms[s]={type:"v2",value:a.toArray()}:a&&a.isVector3?t.uniforms[s]={type:"v3",value:a.toArray()}:a&&a.isVector4?t.uniforms[s]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?t.uniforms[s]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?t.uniforms[s]={type:"m4",value:a.toArray()}:t.uniforms[s]={value:a}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(const n in e.uniforms){const s=e.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=t[s.value]||null;break;case"c":this.uniforms[n].value=new Qe().setHex(s.value);break;case"v2":this.uniforms[n].value=new ct().fromArray(s.value);break;case"v3":this.uniforms[n].value=new G().fromArray(s.value);break;case"v4":this.uniforms[n].value=new Mt().fromArray(s.value);break;case"m3":this.uniforms[n].value=new We().fromArray(s.value);break;case"m4":this.uniforms[n].value=new Je().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(const n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}}class Ir extends Tn{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class Jd extends Fi{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=od,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class Qd extends Fi{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}const nr=new G,ir=new ui,yn=new G;class Rc extends Ht{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Je,this.projectionMatrix=new Je,this.projectionMatrixInverse=new Je,this.coordinateSystem=bn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(nr,ir,yn),yn.x===1&&yn.y===1&&yn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(nr,ir,yn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(nr,ir,yn),yn.x===1&&yn.y===1&&yn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(nr,ir,yn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const Hn=new G,pl=new ct,ml=new ct;class Jt extends Rc{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=uo*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(gr*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return uo*2*Math.atan(Math.tan(gr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Hn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Hn.x,Hn.y).multiplyScalar(-e/Hn.z),Hn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Hn.x,Hn.y).multiplyScalar(-e/Hn.z)}getViewSize(e,t){return this.getViewBounds(e,pl,ml),t.subVectors(ml,pl)}setViewOffset(e,t,n,s,r,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(gr*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,r=-.5*s;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;r+=a.offsetX*s/l,t-=a.offsetY*n/c,s*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(r+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class Cc extends Rc{constructor(e=-1,t=1,n=1,s=-1,r=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=r,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,r,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-e,a=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,u=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,a=r+c*this.view.width,o-=u*this.view.offsetY,l=o-u*this.view.height}this.projectionMatrix.makeOrthographic(r,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}const wi=-90,Ti=1;class jd extends Ht{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new Jt(wi,Ti,e,t);s.layers=this.layers,this.add(s);const r=new Jt(wi,Ti,e,t);r.layers=this.layers,this.add(r);const a=new Jt(wi,Ti,e,t);a.layers=this.layers,this.add(a);const o=new Jt(wi,Ti,e,t);o.layers=this.layers,this.add(o);const l=new Jt(wi,Ti,e,t);l.layers=this.layers,this.add(l);const c=new Jt(wi,Ti,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,r,a,o,l]=t;for(const c of t)this.remove(c);if(e===bn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===Sr)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[r,a,o,l,c,u]=this.children,h=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),_=e.xr.enabled;e.xr.enabled=!1;const b=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=b,e.setRenderTarget(n,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,u),e.setRenderTarget(h,d,f),e.xr.enabled=_,n.texture.needsPMREMUpdate=!0}}class eh extends Jt{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class Pc{static{Pc.prototype.isMatrix2=!0}constructor(e,t,n,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){const r=this.elements;return r[0]=e,r[2]=t,r[1]=n,r[3]=s,this}}function gl(i,e,t,n){const s=th(n);switch(t){case pc:return i*e;case So:return i*e/s.components*s.byteLength;case Mo:return i*e/s.components*s.byteLength;case ai:return i*e*2/s.components*s.byteLength;case wo:return i*e*2/s.components*s.byteLength;case mc:return i*e*3/s.components*s.byteLength;case nn:return i*e*4/s.components*s.byteLength;case To:return i*e*4/s.components*s.byteLength;case hr:case fr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case pr:case mr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case ka:case Fa:return Math.max(i,16)*Math.max(e,8)/4;case Ua:case Na:return Math.max(i,8)*Math.max(e,8)/2;case Oa:case Ba:case Ga:case Va:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case za:case xr:case Ha:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Wa:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Xa:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case qa:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case Ka:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case Ya:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case $a:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case Za:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Ja:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Qa:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case ja:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case eo:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case to:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case no:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case io:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case so:case ro:case ao:return Math.ceil(i/4)*Math.ceil(e/4)*16;case oo:case lo:return Math.ceil(i/4)*Math.ceil(e/4)*8;case vr:case co:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function th(i){switch(i){case en:case uc:return{byteLength:1,components:1};case hs:case dc:case wn:return{byteLength:2,components:1};case vo:case bo:return{byteLength:2,components:4};case Mn:case Lr:case hn:return{byteLength:4,components:1};case hc:case fc:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:xo}}));typeof window<"u"&&(window.__THREE__?ze("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=xo);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function Lc(){let i=null,e=!1,t=null,n=null;function s(r,a){n=i.requestAnimationFrame(s),t(r,a)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(r){t=r},setContext:function(r){i=r}}}function nh(i){const e=new WeakMap;function t(o,l){const c=o.array,u=o.usage,h=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,u),o.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)f=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:h}}function n(o,l,c){const u=l.array,h=l.updateRanges;if(i.bindBuffer(c,o),h.length===0)i.bufferSubData(c,0,u);else{h.sort((f,_)=>f.start-_.start);let d=0;for(let f=1;f<h.length;f++){const _=h[d],b=h[f];b.start<=_.start+_.count+1?_.count=Math.max(_.count,b.start+b.count-_.start):(++d,h[d]=b)}h.length=d+1;for(let f=0,_=h.length;f<_;f++){const b=h[f];i.bufferSubData(c,b.start*u.BYTES_PER_ELEMENT,u,b.start,b.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function r(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const u=e.get(o);(!u||u.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:r,update:a}}var ih=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,sh=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,rh=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,ah=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,oh=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,lh=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,ch=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,uh=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,dh=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,hh=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,fh=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,ph=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,mh=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,gh=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,_h=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,yh=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,xh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,vh=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,bh=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Sh=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Mh=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,wh=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Th=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,Eh=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ah=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Rh=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
#endif`,Ch=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ph=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Lh=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Ih=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Dh="gl_FragColor = linearToOutputTexel( gl_FragColor );",Uh=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,kh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,Nh=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Fh=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Oh=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Bh=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,zh=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Gh=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Vh=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Hh=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Wh=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Xh=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,qh=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Kh=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Yh=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_SUN_LIGHTS > 0
	struct SunLight {
		vec3 direction;
		vec3 color;
	};
	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];
	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {
		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;
	}
#endif
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,$h=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_RETROREFLECTION
		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );
				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );
				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );
				return envMapColor.rgb * envMapIntensity;
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
		#ifdef USE_RETROREFLECTION
			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
				#ifdef ENVMAP_TYPE_CUBE_UV
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
					return getIBLRetroRadiance( viewDir, bentNormal, roughness );
				#else
					return vec3( 0.0 );
				#endif
			}
		#endif
	#endif
#endif`,Zh=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Jh=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Qh=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,jh=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,ef=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_RETROREFLECTION
	material.retroreflectivity = retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,tf=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;
	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	#ifdef USE_RETROREFLECTION
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );
		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	#ifdef USE_RETROREFLECTION
		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );
		F = mix( F, retroF, saturate( material.retroreflectivity ) );
	#endif
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	#endif
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,nf=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );
	}
#endif
#ifdef STANDARD
	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );
	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
	#endif
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )
	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {
		sunLight = sunLights[ i ];
		getSunLightInfo( sunLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,sf=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_RETROREFLECTION
		#ifdef USE_ANISOTROPY
			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
		#else
			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );
		#endif
		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );
	#endif
	radiance += iblRadiance;
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,rf=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,af=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,of=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,lf=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,cf=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,uf=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,df=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,hf=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,ff=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,pf=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,mf=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,gf=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,_f=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,yf=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,xf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,vf=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,bf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Sf=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#ifdef DOUBLE_SIDED
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Mf=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,wf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Tf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Ef=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,Af=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Rf=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Cf=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Pf=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Lf=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,If=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Df=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Uf=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,kf=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Nf=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Ff=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Of=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Bf=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,zf=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		#define SUN_LIGHT_CASCADES 2
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#else
			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];
		#endif
		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0
		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {
			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;
			float shadow = 1.0;
			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {
				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];
				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {
					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);
					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );
				}
			}
			return shadow;
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Gf=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Vf=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_SUN_LIGHT_SHADOWS > 0
		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Hf=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {
		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Wf=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Xf=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,qf=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Kf=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Yf=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,$f=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Zf=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Jf=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Qf=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,jf=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,ep=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,tp=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,np=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,ip=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const sp=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,rp=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ap=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,op=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,lp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cp=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,up=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,dp=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,hp=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,fp=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,pp=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,mp=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,gp=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,_p=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,yp=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,xp=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,vp=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,bp=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Sp=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Mp=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,wp=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Tp=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Ep=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Ap=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Rp=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Cp=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Pp=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Lp=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ip=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Dp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Up=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,kp=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Np=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Fp=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Ze={alphahash_fragment:ih,alphahash_pars_fragment:sh,alphamap_fragment:rh,alphamap_pars_fragment:ah,alphatest_fragment:oh,alphatest_pars_fragment:lh,aomap_fragment:ch,aomap_pars_fragment:uh,batching_pars_vertex:dh,batching_vertex:hh,begin_vertex:fh,beginnormal_vertex:ph,bsdfs:mh,iridescence_fragment:gh,bumpmap_pars_fragment:_h,clipping_planes_fragment:yh,clipping_planes_pars_fragment:xh,clipping_planes_pars_vertex:vh,clipping_planes_vertex:bh,color_fragment:Sh,color_pars_fragment:Mh,color_pars_vertex:wh,color_vertex:Th,common:Eh,cube_uv_reflection_fragment:Ah,defaultnormal_vertex:Rh,displacementmap_pars_vertex:Ch,displacementmap_vertex:Ph,emissivemap_fragment:Lh,emissivemap_pars_fragment:Ih,colorspace_fragment:Dh,colorspace_pars_fragment:Uh,envmap_fragment:kh,envmap_common_pars_fragment:Nh,envmap_pars_fragment:Fh,envmap_pars_vertex:Oh,envmap_physical_pars_fragment:$h,envmap_vertex:Bh,fog_vertex:zh,fog_pars_vertex:Gh,fog_fragment:Vh,fog_pars_fragment:Hh,gradientmap_pars_fragment:Wh,lightmap_pars_fragment:Xh,lights_lambert_fragment:qh,lights_lambert_pars_fragment:Kh,lights_pars_begin:Yh,lights_toon_fragment:Zh,lights_toon_pars_fragment:Jh,lights_phong_fragment:Qh,lights_phong_pars_fragment:jh,lights_physical_fragment:ef,lights_physical_pars_fragment:tf,lights_fragment_begin:nf,lights_fragment_maps:sf,lights_fragment_end:rf,lightprobes_pars_fragment:af,logdepthbuf_fragment:of,logdepthbuf_pars_fragment:lf,logdepthbuf_pars_vertex:cf,logdepthbuf_vertex:uf,map_fragment:df,map_pars_fragment:hf,map_particle_fragment:ff,map_particle_pars_fragment:pf,metalnessmap_fragment:mf,metalnessmap_pars_fragment:gf,morphinstance_vertex:_f,morphcolor_vertex:yf,morphnormal_vertex:xf,morphtarget_pars_vertex:vf,morphtarget_vertex:bf,normal_fragment_begin:Sf,normal_fragment_maps:Mf,normal_pars_fragment:wf,normal_pars_vertex:Tf,normal_vertex:Ef,normalmap_pars_fragment:Af,clearcoat_normal_fragment_begin:Rf,clearcoat_normal_fragment_maps:Cf,clearcoat_pars_fragment:Pf,iridescence_pars_fragment:Lf,opaque_fragment:If,packing:Df,premultiplied_alpha_fragment:Uf,project_vertex:kf,dithering_fragment:Nf,dithering_pars_fragment:Ff,roughnessmap_fragment:Of,roughnessmap_pars_fragment:Bf,shadowmap_pars_fragment:zf,shadowmap_pars_vertex:Gf,shadowmap_vertex:Vf,shadowmask_pars_fragment:Hf,skinbase_vertex:Wf,skinning_pars_vertex:Xf,skinning_vertex:qf,skinnormal_vertex:Kf,specularmap_fragment:Yf,specularmap_pars_fragment:$f,tonemapping_fragment:Zf,tonemapping_pars_fragment:Jf,transmission_fragment:Qf,transmission_pars_fragment:jf,uv_pars_fragment:ep,uv_pars_vertex:tp,uv_vertex:np,worldpos_vertex:ip,background_vert:sp,background_frag:rp,backgroundCube_vert:ap,backgroundCube_frag:op,cube_vert:lp,cube_frag:cp,depth_vert:up,depth_frag:dp,distance_vert:hp,distance_frag:fp,equirect_vert:pp,equirect_frag:mp,linedashed_vert:gp,linedashed_frag:_p,meshbasic_vert:yp,meshbasic_frag:xp,meshlambert_vert:vp,meshlambert_frag:bp,meshmatcap_vert:Sp,meshmatcap_frag:Mp,meshnormal_vert:wp,meshnormal_frag:Tp,meshphong_vert:Ep,meshphong_frag:Ap,meshphysical_vert:Rp,meshphysical_frag:Cp,meshtoon_vert:Pp,meshtoon_frag:Lp,points_vert:Ip,points_frag:Dp,shadow_vert:Up,shadow_frag:kp,sprite_vert:Np,sprite_frag:Fp},be={common:{diffuse:{value:new Qe(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new We},alphaMap:{value:null},alphaMapTransform:{value:new We},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new We}},envmap:{envMap:{value:null},envMapRotation:{value:new We},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new We}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new We}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new We},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new We},normalScale:{value:new ct(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new We},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new We}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new We}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new We}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Qe(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},sunLights:{value:[],properties:{direction:{},color:{}}},sunLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},sunShadowMatrix:{value:[]},sunShadowCascade:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new G},probesMax:{value:new G},probesResolution:{value:new G}},points:{diffuse:{value:new Qe(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new We},alphaTest:{value:0},uvTransform:{value:new We}},sprite:{diffuse:{value:new Qe(16777215)},opacity:{value:1},center:{value:new ct(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new We},alphaMap:{value:null},alphaMapTransform:{value:new We},alphaTest:{value:0}}},vn={basic:{uniforms:zt([be.common,be.specularmap,be.envmap,be.aomap,be.lightmap,be.fog]),vertexShader:Ze.meshbasic_vert,fragmentShader:Ze.meshbasic_frag},lambert:{uniforms:zt([be.common,be.specularmap,be.envmap,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.fog,be.lights,{emissive:{value:new Qe(0)},envMapIntensity:{value:1}}]),vertexShader:Ze.meshlambert_vert,fragmentShader:Ze.meshlambert_frag},phong:{uniforms:zt([be.common,be.specularmap,be.envmap,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.fog,be.lights,{emissive:{value:new Qe(0)},specular:{value:new Qe(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ze.meshphong_vert,fragmentShader:Ze.meshphong_frag},standard:{uniforms:zt([be.common,be.envmap,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.roughnessmap,be.metalnessmap,be.fog,be.lights,{emissive:{value:new Qe(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ze.meshphysical_vert,fragmentShader:Ze.meshphysical_frag},toon:{uniforms:zt([be.common,be.aomap,be.lightmap,be.emissivemap,be.bumpmap,be.normalmap,be.displacementmap,be.gradientmap,be.fog,be.lights,{emissive:{value:new Qe(0)}}]),vertexShader:Ze.meshtoon_vert,fragmentShader:Ze.meshtoon_frag},matcap:{uniforms:zt([be.common,be.bumpmap,be.normalmap,be.displacementmap,be.fog,{matcap:{value:null}}]),vertexShader:Ze.meshmatcap_vert,fragmentShader:Ze.meshmatcap_frag},points:{uniforms:zt([be.points,be.fog]),vertexShader:Ze.points_vert,fragmentShader:Ze.points_frag},dashed:{uniforms:zt([be.common,be.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ze.linedashed_vert,fragmentShader:Ze.linedashed_frag},depth:{uniforms:zt([be.common,be.displacementmap]),vertexShader:Ze.depth_vert,fragmentShader:Ze.depth_frag},normal:{uniforms:zt([be.common,be.bumpmap,be.normalmap,be.displacementmap,{opacity:{value:1}}]),vertexShader:Ze.meshnormal_vert,fragmentShader:Ze.meshnormal_frag},sprite:{uniforms:zt([be.sprite,be.fog]),vertexShader:Ze.sprite_vert,fragmentShader:Ze.sprite_frag},background:{uniforms:{uvTransform:{value:new We},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ze.background_vert,fragmentShader:Ze.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new We}},vertexShader:Ze.backgroundCube_vert,fragmentShader:Ze.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ze.cube_vert,fragmentShader:Ze.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ze.equirect_vert,fragmentShader:Ze.equirect_frag},distance:{uniforms:zt([be.common,be.displacementmap,{referencePosition:{value:new G},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ze.distance_vert,fragmentShader:Ze.distance_frag},shadow:{uniforms:zt([be.lights,be.fog,{color:{value:new Qe(0)},opacity:{value:1}}]),vertexShader:Ze.shadow_vert,fragmentShader:Ze.shadow_frag}};vn.physical={uniforms:zt([vn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new We},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new We},clearcoatNormalScale:{value:new ct(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new We},dispersion:{value:0},retroreflectivity:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new We},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new We},sheen:{value:0},sheenColor:{value:new Qe(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new We},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new We},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new We},transmissionSamplerSize:{value:new ct},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new We},attenuationDistance:{value:0},attenuationColor:{value:new Qe(0)},specularColor:{value:new Qe(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new We},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new We},anisotropyVector:{value:new ct},anisotropyMap:{value:null},anisotropyMapTransform:{value:new We}}]),vertexShader:Ze.meshphysical_vert,fragmentShader:Ze.meshphysical_frag};const sr={r:0,b:0,g:0},Op=new Je,Ic=new We;Ic.set(-1,0,0,0,1,0,0,0,1);function Bp(i,e,t,n,s,r){const a=new Qe(0);let o=s===!0?0:1,l,c,u=null,h=0,d=null;function f(T){let P=T.isScene===!0?T.background:null;if(P&&P.isTexture){const S=T.backgroundBlurriness>0;P=e.get(P,S)}return P}function _(T){let P=!1;const S=f(T);S===null?m(a,o):S&&S.isColor&&(m(S,1),P=!0);const R=i.xr.getEnvironmentBlendMode();R==="additive"?t.buffers.color.setClear(0,0,0,1,r):R==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,r),(i.autoClear||P)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function b(T,P){const S=f(P);S&&(S.isCubeTexture||S.mapping===Pr)?(c===void 0&&(c=new kt(new pn(1,1,1),new Tn({name:"BackgroundCubeMaterial",uniforms:ki(vn.backgroundCube.uniforms),vertexShader:vn.backgroundCube.vertexShader,fragmentShader:vn.backgroundCube.fragmentShader,side:qt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(R,A,L){this.matrixWorld.copyPosition(L.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=S,c.material.uniforms.backgroundBlurriness.value=P.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=P.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Op.makeRotationFromEuler(P.backgroundRotation)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(Ic),c.material.toneMapped=et.getTransfer(S.colorSpace)!==_t,(u!==S||h!==S.version||d!==i.toneMapping)&&(c.material.needsUpdate=!0,u=S,h=S.version,d=i.toneMapping),c.layers.enableAll(),T.unshift(c,c.geometry,c.material,0,0,null)):S&&S.isTexture&&(l===void 0&&(l=new kt(new Oi(2,2),new Tn({name:"BackgroundMaterial",uniforms:ki(vn.background.uniforms),vertexShader:vn.background.vertexShader,fragmentShader:vn.background.fragmentShader,side:Yn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=S,l.material.uniforms.backgroundIntensity.value=P.backgroundIntensity,l.material.toneMapped=et.getTransfer(S.colorSpace)!==_t,S.matrixAutoUpdate===!0&&S.updateMatrix(),l.material.uniforms.uvTransform.value.copy(S.matrix),(u!==S||h!==S.version||d!==i.toneMapping)&&(l.material.needsUpdate=!0,u=S,h=S.version,d=i.toneMapping),l.layers.enableAll(),T.unshift(l,l.geometry,l.material,0,0,null))}function m(T,P){T.getRGB(sr,Ac(i)),t.buffers.color.setClear(sr.r,sr.g,sr.b,P,r)}function p(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return a},setClearColor:function(T,P=1){a.set(T),o=P,m(a,o)},getClearAlpha:function(){return o},setClearAlpha:function(T){o=T,m(a,o)},render:_,addToRenderList:b,dispose:p}}function zp(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,a=!1;function o(N,W,z,C,V){let O=!1;const I=h(N,C,z,W);r!==I&&(r=I,c(r.object)),O=f(N,C,z,V),O&&_(N,C,z,V),V!==null&&e.update(V,i.ELEMENT_ARRAY_BUFFER),(O||a)&&(a=!1,S(N,W,z,C),V!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(V).buffer))}function l(){return i.createVertexArray()}function c(N){return i.bindVertexArray(N)}function u(N){return i.deleteVertexArray(N)}function h(N,W,z,C){const V=C.wireframe===!0;let O=n[W.id];O===void 0&&(O={},n[W.id]=O);const I=N.isInstancedMesh===!0?N.id:0;let j=O[I];j===void 0&&(j={},O[I]=j);let H=j[z.id];H===void 0&&(H={},j[z.id]=H);let X=H[V];return X===void 0&&(X=d(l()),H[V]=X),X}function d(N){const W=[],z=[],C=[];for(let V=0;V<t;V++)W[V]=0,z[V]=0,C[V]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:W,enabledAttributes:z,attributeDivisors:C,object:N,attributes:{},index:null}}function f(N,W,z,C){const V=r.attributes,O=W.attributes;let I=0;const j=z.getAttributes();for(const H in j)if(j[H].location>=0){const J=V[H];let Se=O[H];if(Se===void 0&&(H==="instanceMatrix"&&N.instanceMatrix&&(Se=N.instanceMatrix),H==="instanceColor"&&N.instanceColor&&(Se=N.instanceColor)),J===void 0||J.attribute!==Se||Se&&J.data!==Se.data)return!0;I++}return r.attributesNum!==I||r.index!==C}function _(N,W,z,C){const V={},O=W.attributes;let I=0;const j=z.getAttributes();for(const H in j)if(j[H].location>=0){let J=O[H];J===void 0&&(H==="instanceMatrix"&&N.instanceMatrix&&(J=N.instanceMatrix),H==="instanceColor"&&N.instanceColor&&(J=N.instanceColor));const Se={};Se.attribute=J,J&&J.data&&(Se.data=J.data),V[H]=Se,I++}r.attributes=V,r.attributesNum=I,r.index=C}function b(){const N=r.newAttributes;for(let W=0,z=N.length;W<z;W++)N[W]=0}function m(N){p(N,0)}function p(N,W){const z=r.newAttributes,C=r.enabledAttributes,V=r.attributeDivisors;z[N]=1,C[N]===0&&(i.enableVertexAttribArray(N),C[N]=1),V[N]!==W&&(i.vertexAttribDivisor(N,W),V[N]=W)}function T(){const N=r.newAttributes,W=r.enabledAttributes;for(let z=0,C=W.length;z<C;z++)W[z]!==N[z]&&(i.disableVertexAttribArray(z),W[z]=0)}function P(N,W,z,C,V,O,I){I===!0?i.vertexAttribIPointer(N,W,z,V,O):i.vertexAttribPointer(N,W,z,C,V,O)}function S(N,W,z,C){b();const V=C.attributes,O=z.getAttributes(),I=W.defaultAttributeValues;for(const j in O){const H=O[j];if(H.location>=0){let X=V[j];if(X===void 0&&(j==="instanceMatrix"&&N.instanceMatrix&&(X=N.instanceMatrix),j==="instanceColor"&&N.instanceColor&&(X=N.instanceColor)),X!==void 0){const J=X.normalized,Se=X.itemSize,ve=e.get(X);if(ve===void 0)continue;const He=ve.buffer,Ne=ve.type,Oe=ve.bytesPerElement,$=Ne===i.INT||Ne===i.UNSIGNED_INT||X.gpuType===Lr;if(X.isInterleavedBufferAttribute){const ne=X.data,le=ne.stride,Ee=X.offset;if(ne.isInstancedInterleavedBuffer){for(let he=0;he<H.locationSize;he++)p(H.location+he,ne.meshPerAttribute);N.isInstancedMesh!==!0&&C._maxInstanceCount===void 0&&(C._maxInstanceCount=ne.meshPerAttribute*ne.count)}else for(let he=0;he<H.locationSize;he++)m(H.location+he);i.bindBuffer(i.ARRAY_BUFFER,He);for(let he=0;he<H.locationSize;he++)P(H.location+he,Se/H.locationSize,Ne,J,le*Oe,(Ee+Se/H.locationSize*he)*Oe,$)}else{if(X.isInstancedBufferAttribute){for(let ne=0;ne<H.locationSize;ne++)p(H.location+ne,X.meshPerAttribute);N.isInstancedMesh!==!0&&C._maxInstanceCount===void 0&&(C._maxInstanceCount=X.meshPerAttribute*X.count)}else for(let ne=0;ne<H.locationSize;ne++)m(H.location+ne);i.bindBuffer(i.ARRAY_BUFFER,He);for(let ne=0;ne<H.locationSize;ne++)P(H.location+ne,Se/H.locationSize,Ne,J,Se*Oe,Se/H.locationSize*ne*Oe,$)}}else if(I!==void 0){const J=I[j];if(J!==void 0)switch(J.length){case 2:i.vertexAttrib2fv(H.location,J);break;case 3:i.vertexAttrib3fv(H.location,J);break;case 4:i.vertexAttrib4fv(H.location,J);break;default:i.vertexAttrib1fv(H.location,J)}}}}T()}function R(){w();for(const N in n){const W=n[N];for(const z in W){const C=W[z];for(const V in C){const O=C[V];for(const I in O)u(O[I].object),delete O[I];delete C[V]}}delete n[N]}}function A(N){if(n[N.id]===void 0)return;const W=n[N.id];for(const z in W){const C=W[z];for(const V in C){const O=C[V];for(const I in O)u(O[I].object),delete O[I];delete C[V]}}delete n[N.id]}function L(N){for(const W in n){const z=n[W];for(const C in z){const V=z[C];if(V[N.id]===void 0)continue;const O=V[N.id];for(const I in O)u(O[I].object),delete O[I];delete V[N.id]}}}function y(N){for(const W in n){const z=n[W],C=N.isInstancedMesh===!0?N.id:0,V=z[C];if(V!==void 0){for(const O in V){const I=V[O];for(const j in I)u(I[j].object),delete I[j];delete V[O]}delete z[C],Object.keys(z).length===0&&delete n[W]}}}function w(){M(),a=!0,r!==s&&(r=s,c(r.object))}function M(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:w,resetDefaultState:M,dispose:R,releaseStatesOfGeometry:A,releaseStatesOfObject:y,releaseStatesOfProgram:L,initAttributes:b,enableAttribute:m,disableUnusedAttributes:T}}function Gp(i,e,t){let n;function s(l){n=l}function r(l,c){i.drawArrays(n,l,c),t.update(c,n,1)}function a(l,c,u){u!==0&&(i.drawArraysInstanced(n,l,c,u),t.update(c,n,u))}function o(l,c,u){if(u===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,u);let d=0;for(let f=0;f<u;f++)d+=c[f];t.update(d,n,1)}this.setMode=s,this.render=r,this.renderInstances=a,this.renderMultiDraw=o}function Vp(i,e,t,n){let s;function r(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const L=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(L.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function a(L){return!(L!==nn&&n.convert(L)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(L){const y=L===wn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(L!==en&&L!==hn&&!y&&n.convert(L)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE))}function l(L){if(L==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";L="mediump"}return L==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const u=l(c);u!==c&&(ze("WebGLRenderer:",c,"not supported, using",u,"instead."),c=u);const h=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&d===!1&&ze("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),_=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),b=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),T=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),P=i.getParameter(i.MAX_VARYING_VECTORS),S=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),R=i.getParameter(i.MAX_SAMPLES),A=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:h,reversedDepthBuffer:d,maxTextures:f,maxVertexTextures:_,maxTextureSize:b,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:T,maxVaryings:P,maxFragmentUniforms:S,maxSamples:R,samples:A}}function Hp(i){const e=this;let t=null,n=0,s=!1,r=!1;const a=new qn,o=new We,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(h,d){const f=h.length!==0||d||n!==0||s;return s=d,n=h.length,f},this.beginShadows=function(){r=!0,u(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(h,d){t=u(h,d,0)},this.setState=function(h,d,f){const _=h.clippingPlanes,b=h.clipIntersection,m=h.clipShadows,p=i.get(h);if(!s||_===null||_.length===0||r&&!m)r?u(null):c();else{const T=r?0:n,P=T*4;let S=p.clippingState||null;l.value=S,S=u(_,d,P,f);for(let R=0;R!==P;++R)S[R]=t[R];p.clippingState=S,this.numIntersection=b?this.numPlanes:0,this.numPlanes+=T}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function u(h,d,f,_){const b=h!==null?h.length:0;let m=null;if(b!==0){if(m=l.value,_!==!0||m===null){const p=f+b*4,T=d.matrixWorldInverse;o.getNormalMatrix(T),(m===null||m.length<p)&&(m=new Float32Array(p));for(let P=0,S=f;P!==b;++P,S+=4)a.copy(h[P]).applyMatrix4(T,o),a.normal.toArray(m,S),m[S+3]=a.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=b,e.numIntersection=0,m}}const Ci=4,Wp=6,Xp=20,qp=256,Qi=new Cc,_l=new Qe;let ha=null,fa=0,pa=0,ma=!1;const Kp=new G,ni=new G;class yl{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,r={}){const{size:a=256,position:o=Kp}=r;ha=this._renderer.getRenderTarget(),fa=this._renderer.getActiveCubeFace(),pa=this._renderer.getActiveMipmapLevel(),ma=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=bl(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=vl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(ha,fa,pa),this._renderer.xr.enabled=ma,e.scissorTest=!1,Ei(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===ri||e.mapping===Ui?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),ha=this._renderer.getRenderTarget(),fa=this._renderer.getActiveCubeFace(),pa=this._renderer.getActiveMipmapLevel(),ma=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Ut,minFilter:Ut,generateMipmaps:!1,type:wn,format:nn,colorSpace:ps,depthBuffer:!1},s=xl(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=xl(e,t,n);const{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods}=Yp(r)),this._blurMaterial=Zp(r,e,t),this._ggxMaterial=$p(r,e,t)}return s}_compileMaterial(e){const t=new kt(new Tt,e);this._renderer.compile(t,Qi)}_sceneToCubeUV(e,t,n,s,r){const l=new Jt(90,1,t,n),c=[1,-1,1,1,1,1],u=[1,1,1,-1,-1,-1],h=this._renderer,d=h.autoClear,f=h.toneMapping;h.getClearColor(_l),h.toneMapping=Sn,h.autoClear=!1,h.state.buffers.depth.getReversed()&&(h.setRenderTarget(s),h.clearDepth(),h.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new kt(new pn,new kn({name:"PMREM.Background",side:qt,depthWrite:!1,depthTest:!1})));const b=this._backgroundBox,m=b.material;let p=!1;const T=e.background;T?T.isColor&&(m.color.copy(T),e.background=null,p=!0):(m.color.copy(_l),p=!0);for(let P=0;P<6;P++){const S=P%3;S===0?(l.up.set(0,c[P],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x+u[P],r.y,r.z)):S===1?(l.up.set(0,0,c[P]),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y+u[P],r.z)):(l.up.set(0,c[P],0),l.position.set(r.x,r.y,r.z),l.lookAt(r.x,r.y,r.z+u[P]));const R=this._cubeSize;Ei(s,S*R,P>2?R:0,R,R),h.setRenderTarget(s),p&&h.render(b,l),h.render(e,l)}h.toneMapping=f,h.autoClear=d,e.background=T}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===ri||e.mapping===Ui;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=bl()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=vl());const r=s?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=r;const o=r.uniforms;o.envMap.value=e;const l=this._cubeSize;Ei(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(a,Qi)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodMeshes.length;for(let r=1;r<s;r++)this._applyGGXFilter(e,r-1,r);t.autoClear=n}_applyGGXFilter(e,t,n){const s=this._renderer,r=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;const l=a.uniforms,c=n/(this._lodMeshes.length-1),u=t/(this._lodMeshes.length-1),h=Math.sqrt(c*c-u*u),d=c*1.25,f=h*d,{_lodMax:_}=this,b=this._sizeLods[n],m=3*b*(n>_-Ci?n-_+Ci:0),p=4*(this._cubeSize-b);l.envMap.value=e.texture,l.roughness.value=f,l.mipInt.value=_-t,Ei(r,m,p,3*b,2*b),s.setRenderTarget(r),s.render(o,Qi),l.envMap.value=r.texture,l.roughness.value=0,l.mipInt.value=_-n,Ei(e,m,p,3*b,2*b),s.setRenderTarget(e),s.render(o,Qi)}_blur(e,t,n,s){const r=this._pingPongRenderTarget,a=Math.min(s,Math.PI)/Math.SQRT2;this._blurPass(e,r,t,n,a),this._blurPass(r,e,n,n,a)}_blurPass(e,t,n,s,r){const a=this._renderer,o=this._blurMaterial,l=this._lodMeshes[s];l.material=o;const c=o.uniforms;c.envMap.value=e.texture,c.sigma.value=r,c.mipInt.value=this._lodMax-n;const u=this._sizeLods[s],h=3*u*(s>this._lodMax-Ci?s-this._lodMax+Ci:0),d=4*(this._cubeSize-u);Ei(t,h,d,3*u,2*u),a.setRenderTarget(t),a.render(l,Qi)}}function Yp(i){const e=[],t=[];let n=i;const s=i-Ci+1+Wp;for(let r=0;r<s;r++){const a=Math.pow(2,n);e.push(a);const o=1/(a-2),l=-o,c=1+o,u=[l,l,c,l,c,c,l,l,c,c,l,c],h=6,d=6,f=3,_=new Float32Array(f*d*h),b=new Float32Array(f*d*h);for(let p=0;p<h;p++){const T=p%3*2/3-1,P=p>2?0:-1,S=[T,P,0,T+2/3,P,0,T+2/3,P+1,0,T,P,0,T+2/3,P+1,0,T,P+1,0];_.set(S,f*d*p);for(let R=0;R<d;R++){const A=u[R*2]*2-1,L=u[R*2+1]*2-1;p===0?ni.set(1,L,A):p===1?ni.set(-A,1,-L):p===2?ni.set(-A,L,1):p===3?ni.set(-1,L,-A):p===4?ni.set(-A,-1,L):ni.set(A,L,-1),ni.toArray(b,(p*d+R)*f)}}const m=new Tt;m.setAttribute("position",new Rt(_,f)),m.setAttribute("outputDirection",new Rt(b,f)),t.push(new kt(m,null)),n>Ci&&n--}return{lodMeshes:t,sizeLods:e}}function xl(i,e,t){const n=new rn(i,e,t);return n.texture.mapping=Pr,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ei(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function $p(i,e,t){return new Tn({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:qp,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:Dr(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function Zp(i,e,t){return new Tn({name:"SphericalGaussianBlur",defines:{SAMPLES:Xp,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},sigma:{value:0},mipInt:{value:0}},vertexShader:Dr(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float sigma;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359
			#define GOLDEN_ANGLE 2.39996322973

			void main() {

				if ( sigma == 0.0 ) {

					gl_FragColor = vec4( bilinearCubeUV( envMap, vOutputDirection, mipInt ), 1.0 );
					return;

				}

				vec3 outputDirection = normalize( vOutputDirection );

				vec3 up = abs( outputDirection.z ) < 0.999 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
				vec3 tangent = normalize( cross( up, outputDirection ) );
				vec3 bitangent = cross( outputDirection, tangent );

				// Truncate the kernel at three standard deviations or at the antipode.
				float thetaMax = min( 3.0 * sigma, PI );
				float truncation = 1.0 - exp( - 0.5 * thetaMax * thetaMax / ( sigma * sigma ) );

				vec3 accumColor = vec3( 0.0 );
				float accumWeight = 0.0;

				for ( int i = 0; i < SAMPLES; i ++ ) {

					// Stratified inverse-CDF sampling of the Gaussian, placed on a golden-angle spiral.
					float stratum = ( float( i ) + 0.5 ) / float( SAMPLES );
					float theta = sigma * sqrt( - 2.0 * log( 1.0 - stratum * truncation ) );
					float phi = float( i ) * GOLDEN_ANGLE;

					vec3 offset = cos( phi ) * tangent + sin( phi ) * bitangent;
					vec3 sampleDirection = cos( theta ) * outputDirection + sin( theta ) * offset;

					// Correct the planar sample density to solid angle.
					float weight = sin( theta ) / theta;

					accumColor += weight * bilinearCubeUV( envMap, sampleDirection, mipInt );
					accumWeight += weight;

				}

				gl_FragColor = vec4( accumColor / accumWeight, 1.0 );

			}
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function vl(){return new Tn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Dr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function bl(){return new Tn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Dr(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Dn,depthTest:!1,depthWrite:!1})}function Dr(){return`

		precision mediump float;
		precision mediump int;

		attribute vec3 outputDirection;

		varying vec3 vOutputDirection;

		void main() {

			vOutputDirection = outputDirection;
			gl_Position = vec4( position, 1.0 );

		}
	`}class Dc extends rn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new Tc(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new pn(5,5,5),r=new Tn({name:"CubemapFromEquirect",uniforms:ki(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:qt,blending:Dn});r.uniforms.tEquirect.value=t;const a=new kt(s,r),o=t.minFilter;return t.minFilter===Kn&&(t.minFilter=Ut),new jd(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const r=e.getRenderTarget();for(let a=0;a<6;a++)e.setRenderTarget(this,a),e.clear(t,n,s);e.setRenderTarget(r)}}function Jp(i){let e=new WeakMap,t=new WeakMap,n=null;function s(d,f=!1){return d==null?null:f?a(d):r(d)}function r(d){if(d&&d.isTexture){const f=d.mapping;if(f===Br||f===zr)if(e.has(d)){const _=e.get(d).texture;return o(_,d.mapping)}else{const _=d.image;if(_&&_.height>0){const b=new Dc(_.height);return b.fromEquirectangularTexture(i,d),e.set(d,b),d.addEventListener("dispose",c),o(b.texture,d.mapping)}else return null}}return d}function a(d){if(d&&d.isTexture){const f=d.mapping,_=f===Br||f===zr,b=f===ri||f===Ui;if(_||b){let m=t.get(d);const p=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==p)return n===null&&(n=new yl(i)),m=_?n.fromEquirectangular(d,m):n.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{const T=d.image;return _&&T&&T.height>0||b&&T&&l(T)?(n===null&&(n=new yl(i)),m=_?n.fromEquirectangular(d):n.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",u),m.texture):null}}}return d}function o(d,f){return f===Br?d.mapping=ri:f===zr&&(d.mapping=Ui),d}function l(d){let f=0;const _=6;for(let b=0;b<_;b++)d[b]!==void 0&&f++;return f===_}function c(d){const f=d.target;f.removeEventListener("dispose",c);const _=e.get(f);_!==void 0&&(e.delete(f),_.dispose())}function u(d){const f=d.target;f.removeEventListener("dispose",u);const _=t.get(f);_!==void 0&&(t.delete(f),_.dispose())}function h(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:h}}function Qp(i){const e={};function t(n){if(e[n]!==void 0)return e[n];const s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&Li("WebGLRenderer: "+n+" extension not supported."),s}}}function jp(i,e,t,n){const s={},r=new WeakMap;function a(h){const d=h.target;d.index!==null&&e.remove(d.index);for(const _ in d.attributes)e.remove(d.attributes[_]);d.removeEventListener("dispose",a),delete s[d.id];const f=r.get(d);f&&(e.remove(f),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(h,d){return s[d.id]===!0||(d.addEventListener("dispose",a),s[d.id]=!0,t.memory.geometries++),d}function l(h){const d=h.attributes;for(const f in d)e.update(d[f],i.ARRAY_BUFFER)}function c(h){const d=[],f=h.index,_=h.attributes.position;let b=0;if(_===void 0)return;if(f!==null){const T=f.array;b=f.version;for(let P=0,S=T.length;P<S;P+=3){const R=T[P+0],A=T[P+1],L=T[P+2];d.push(R,A,A,L,L,R)}}else{const T=_.array;b=_.version;for(let P=0,S=T.length/3-1;P<S;P+=3){const R=P+0,A=P+1,L=P+2;d.push(R,A,A,L,L,R)}}const m=new(_.count>=65535?bc:vc)(d,1);m.version=b;const p=r.get(h);p&&e.remove(p),r.set(h,m)}function u(h){const d=r.get(h);if(d){const f=h.index;f!==null&&d.version<f.version&&c(h)}else c(h);return r.get(h)}return{get:o,update:l,getWireframeAttribute:u}}function em(i,e,t){let n;function s(h){n=h}let r,a;function o(h){r=h.type,a=h.bytesPerElement}function l(h,d){i.drawElements(n,d,r,h*a),t.update(d,n,1)}function c(h,d,f){f!==0&&(i.drawElementsInstanced(n,d,r,h*a,f),t.update(d,n,f))}function u(h,d,f){if(f===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,r,h,0,f);let b=0;for(let m=0;m<f;m++)b+=d[m];t.update(b,n,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=u}function tm(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,a,o){switch(t.calls++,a){case i.TRIANGLES:t.triangles+=o*(r/3);break;case i.LINES:t.lines+=o*(r/2);break;case i.LINE_STRIP:t.lines+=o*(r-1);break;case i.LINE_LOOP:t.lines+=o*r;break;case i.POINTS:t.points+=o*r;break;default:dt("WebGLInfo: Unknown draw mode:",a);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function nm(i,e,t){const n=new WeakMap,s=new Mt;function r(a,o,l){const c=a.morphTargetInfluences,u=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,h=u!==void 0?u.length:0;let d=n.get(o);if(d===void 0||d.count!==h){let w=function(){L.dispose(),n.delete(o),o.removeEventListener("dispose",w)};d!==void 0&&d.texture.dispose();const f=o.morphAttributes.position!==void 0,_=o.morphAttributes.normal!==void 0,b=o.morphAttributes.color!==void 0,m=o.morphAttributes.position||[],p=o.morphAttributes.normal||[],T=o.morphAttributes.color||[];let P=0;f===!0&&(P=1),_===!0&&(P=2),b===!0&&(P=3);let S=o.attributes.position.count*P,R=1;S>e.maxTextureSize&&(R=Math.ceil(S/e.maxTextureSize),S=e.maxTextureSize);const A=new Float32Array(S*R*4*h),L=new Co(A,S,R,h);L.type=hn,L.needsUpdate=!0;const y=P*4;for(let M=0;M<h;M++){const N=m[M],W=p[M],z=T[M],C=S*R*4*M;for(let V=0;V<N.count;V++){const O=V*y;f===!0&&(s.fromBufferAttribute(N,V),A[C+O+0]=s.x,A[C+O+1]=s.y,A[C+O+2]=s.z,A[C+O+3]=0),_===!0&&(s.fromBufferAttribute(W,V),A[C+O+4]=s.x,A[C+O+5]=s.y,A[C+O+6]=s.z,A[C+O+7]=0),b===!0&&(s.fromBufferAttribute(z,V),A[C+O+8]=s.x,A[C+O+9]=s.y,A[C+O+10]=s.z,A[C+O+11]=z.itemSize===4?s.w:1)}}d={count:h,texture:L,size:new ct(S,R)},n.set(o,d),o.addEventListener("dispose",w)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",a.morphTexture,t);else{let f=0;for(let b=0;b<c.length;b++)f+=c[b];const _=o.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",_),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function im(i,e,t,n,s){let r=new WeakMap;function a(c){const u=s.render.frame,h=c.geometry,d=e.get(c,h);if(r.get(d)!==u&&(e.update(d),r.set(d,u)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),r.get(c)!==u&&(t.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,i.ARRAY_BUFFER),r.set(c,u))),c.isSkinnedMesh){const f=c.skeleton;r.get(f)!==u&&(f.update(),r.set(f,u))}return d}function o(){r=new WeakMap}function l(c){const u=c.target;u.removeEventListener("dispose",l),n.releaseStatesOfObject(u),t.remove(u.instanceMatrix),u.instanceColor!==null&&t.remove(u.instanceColor)}return{update:a,dispose:o}}const sm={[nc]:"LINEAR_TONE_MAPPING",[ic]:"REINHARD_TONE_MAPPING",[sc]:"CINEON_TONE_MAPPING",[rc]:"ACES_FILMIC_TONE_MAPPING",[oc]:"AGX_TONE_MAPPING",[lc]:"NEUTRAL_TONE_MAPPING",[ac]:"CUSTOM_TONE_MAPPING"};function rm(i,e,t,n,s,r){const a=new rn(e,t,{type:i,depthBuffer:s,stencilBuffer:r,samples:n?4:0,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,resolveDepthBuffer:!1,resolveStencilBuffer:!1});let o=null,l=null;const c=new Tt;c.setAttribute("position",new Bt([-1,3,0,-1,-1,0,3,-1,0],3)),c.setAttribute("uv",new Bt([0,2,0,0,2,0],2));const u=new Ir({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new kt(c,u),d=new Cc(-1,1,1,-1,0,1);let f=null,_=null,b=!1,m,p=null,T=[],P=!1;this.setSize=function(S,R){a.setSize(S,R),o!==null&&o.setSize(S,R),l!==null&&l.setSize(S,R);for(let A=0;A<T.length;A++){const L=T[A];L.setSize&&L.setSize(S,R)}},this.setEffects=function(S){T=S,P=T.length>0&&T[0].isRenderPass===!0;const R=a.width,A=a.height;T.length>0&&o===null&&(o=new rn(R,A,{type:wn,depthBuffer:!1,stencilBuffer:!1}),l=new rn(R,A,{type:wn,depthBuffer:!1,stencilBuffer:!1}));for(let L=0;L<T.length;L++){const y=T[L];y.setSize&&y.setSize(R,A)}},this.begin=function(S,R){if(b||S.toneMapping===Sn&&T.length===0)return!1;if(p=R,R!==null){const A=R.width,L=R.height;(a.width!==A||a.height!==L)&&this.setSize(A,L)}return P===!1&&S.setRenderTarget(a),m=S.toneMapping,S.toneMapping=Sn,!0},this.hasRenderPass=function(){return P},this.end=function(S,R){S.toneMapping=m,b=!0;let A=a,L=o;for(let y=0;y<T.length;y++){const w=T[y];w.enabled!==!1&&(w.render(S,L,A,R),w.needsSwap!==!1&&(A=L,L=L===o?l:o))}if(f!==S.outputColorSpace||_!==S.toneMapping){f=S.outputColorSpace,_=S.toneMapping,u.defines={},et.getTransfer(f)===_t&&(u.defines.SRGB_TRANSFER="");const y=sm[_];y&&(u.defines[y]=""),u.needsUpdate=!0}u.uniforms.tDiffuse.value=A.texture,S.setRenderTarget(p),S.render(h,d),p=null,b=!1},this.isCompositing=function(){return b},this.dispose=function(){a.dispose(),o!==null&&o.dispose(),l!==null&&l.dispose(),c.dispose(),u.dispose()}}const Uc=new Vt,po=new gs(1,1),kc=new Co,Nc=new Ad,Fc=new Tc,Sl=[],Ml=[],wl=new Float32Array(16),Tl=new Float32Array(9),El=new Float32Array(4);function Bi(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let r=Sl[s];if(r===void 0&&(r=new Float32Array(s),Sl[s]=r),e!==0){n.toArray(r,0);for(let a=1,o=0;a!==e;++a)o+=t,i[a].toArray(r,o)}return r}function Ct(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function Pt(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function Ur(i,e){let t=Ml[e];t===void 0&&(t=new Int32Array(e),Ml[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function am(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function om(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ct(t,e))return;i.uniform2fv(this.addr,e),Pt(t,e)}}function lm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Ct(t,e))return;i.uniform3fv(this.addr,e),Pt(t,e)}}function cm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ct(t,e))return;i.uniform4fv(this.addr,e),Pt(t,e)}}function um(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Ct(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),Pt(t,e)}else{if(Ct(t,n))return;El.set(n),i.uniformMatrix2fv(this.addr,!1,El),Pt(t,n)}}function dm(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Ct(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),Pt(t,e)}else{if(Ct(t,n))return;Tl.set(n),i.uniformMatrix3fv(this.addr,!1,Tl),Pt(t,n)}}function hm(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Ct(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),Pt(t,e)}else{if(Ct(t,n))return;wl.set(n),i.uniformMatrix4fv(this.addr,!1,wl),Pt(t,n)}}function fm(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function pm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ct(t,e))return;i.uniform2iv(this.addr,e),Pt(t,e)}}function mm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Ct(t,e))return;i.uniform3iv(this.addr,e),Pt(t,e)}}function gm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ct(t,e))return;i.uniform4iv(this.addr,e),Pt(t,e)}}function _m(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function ym(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Ct(t,e))return;i.uniform2uiv(this.addr,e),Pt(t,e)}}function xm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Ct(t,e))return;i.uniform3uiv(this.addr,e),Pt(t,e)}}function vm(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Ct(t,e))return;i.uniform4uiv(this.addr,e),Pt(t,e)}}function bm(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(po.compareFunction=t.isReversedDepthBuffer()?Ao:Eo,r=po):r=Uc,t.setTexture2D(e||r,s)}function Sm(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||Nc,s)}function Mm(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||Fc,s)}function wm(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||kc,s)}function Tm(i){switch(i){case 5126:return am;case 35664:return om;case 35665:return lm;case 35666:return cm;case 35674:return um;case 35675:return dm;case 35676:return hm;case 5124:case 35670:return fm;case 35667:case 35671:return pm;case 35668:case 35672:return mm;case 35669:case 35673:return gm;case 5125:return _m;case 36294:return ym;case 36295:return xm;case 36296:return vm;case 35678:case 36198:case 36298:case 36306:case 35682:return bm;case 35679:case 36299:case 36307:return Sm;case 35680:case 36300:case 36308:case 36293:return Mm;case 36289:case 36303:case 36311:case 36292:return wm}}function Em(i,e){i.uniform1fv(this.addr,e)}function Am(i,e){const t=Bi(e,this.size,2);i.uniform2fv(this.addr,t)}function Rm(i,e){const t=Bi(e,this.size,3);i.uniform3fv(this.addr,t)}function Cm(i,e){const t=Bi(e,this.size,4);i.uniform4fv(this.addr,t)}function Pm(i,e){const t=Bi(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Lm(i,e){const t=Bi(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Im(i,e){const t=Bi(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function Dm(i,e){i.uniform1iv(this.addr,e)}function Um(i,e){i.uniform2iv(this.addr,e)}function km(i,e){i.uniform3iv(this.addr,e)}function Nm(i,e){i.uniform4iv(this.addr,e)}function Fm(i,e){i.uniform1uiv(this.addr,e)}function Om(i,e){i.uniform2uiv(this.addr,e)}function Bm(i,e){i.uniform3uiv(this.addr,e)}function zm(i,e){i.uniform4uiv(this.addr,e)}function Gm(i,e,t){const n=this.cache,s=e.length,r=Ur(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Pt(n,r));let a;this.type===i.SAMPLER_2D_SHADOW?a=po:a=Uc;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||a,r[o])}function Vm(i,e,t){const n=this.cache,s=e.length,r=Ur(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Pt(n,r));for(let a=0;a!==s;++a)t.setTexture3D(e[a]||Nc,r[a])}function Hm(i,e,t){const n=this.cache,s=e.length,r=Ur(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Pt(n,r));for(let a=0;a!==s;++a)t.setTextureCube(e[a]||Fc,r[a])}function Wm(i,e,t){const n=this.cache,s=e.length,r=Ur(t,s);Ct(n,r)||(i.uniform1iv(this.addr,r),Pt(n,r));for(let a=0;a!==s;++a)t.setTexture2DArray(e[a]||kc,r[a])}function Xm(i){switch(i){case 5126:return Em;case 35664:return Am;case 35665:return Rm;case 35666:return Cm;case 35674:return Pm;case 35675:return Lm;case 35676:return Im;case 5124:case 35670:return Dm;case 35667:case 35671:return Um;case 35668:case 35672:return km;case 35669:case 35673:return Nm;case 5125:return Fm;case 36294:return Om;case 36295:return Bm;case 36296:return zm;case 35678:case 36198:case 36298:case 36306:case 35682:return Gm;case 35679:case 36299:case 36307:return Vm;case 35680:case 36300:case 36308:case 36293:return Hm;case 36289:case 36303:case 36311:case 36292:return Wm}}class qm{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Tm(t.type)}}class Km{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Xm(t.type)}}class Ym{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let r=0,a=s.length;r!==a;++r){const o=s[r];o.setValue(e,t[o.id],n)}}}const ga=/(\w+)(\])?(\[|\.)?/g;function Al(i,e){i.seq.push(e),i.map[e.id]=e}function $m(i,e,t){const n=i.name,s=n.length;for(ga.lastIndex=0;;){const r=ga.exec(n),a=ga.lastIndex;let o=r[1];const l=r[2]==="]",c=r[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===s){Al(t,c===void 0?new qm(o,i,e):new Km(o,i,e));break}else{let h=t.map[o];h===void 0&&(h=new Ym(o),Al(t,h)),t=h}}}class _r{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let a=0;a<n;++a){const o=e.getActiveUniform(t,a),l=e.getUniformLocation(t,o.name);$m(o,l,this)}const s=[],r=[];for(const a of this.seq)a.type===e.SAMPLER_2D_SHADOW||a.type===e.SAMPLER_CUBE_SHADOW||a.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(a):r.push(a);s.length>0&&(this.seq=s.concat(r))}setValue(e,t,n,s){const r=this.map[t];r!==void 0&&r.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let r=0,a=t.length;r!==a;++r){const o=t[r],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,r=e.length;s!==r;++s){const a=e[s];a.id in t&&n.push(a)}return n}}function Rl(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const Zm=37297;let Jm=0;function Qm(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),r=Math.min(e+6,t.length);for(let a=s;a<r;a++){const o=a+1;n.push(`${o===e?">":" "} ${o}: ${t[a]}`)}return n.join(`
`)}const Cl=new We;function jm(i){et._getMatrix(Cl,et.workingColorSpace,i);const e=`mat3( ${Cl.elements.map(t=>t.toFixed(4))} )`;switch(et.getTransfer(i)){case br:return[e,"LinearTransferOETF"];case _t:return[e,"sRGBTransferOETF"];default:return ze("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function Pl(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),r=(i.getShaderInfoLog(e)||"").trim();if(n&&r==="")return"";const a=/ERROR: 0:(\d+)/.exec(r);if(a){const o=parseInt(a[1]);return t.toUpperCase()+`

`+r+`

`+Qm(i.getShaderSource(e),o)}else return r}function eg(i,e){const t=jm(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const tg={[nc]:"Linear",[ic]:"Reinhard",[sc]:"Cineon",[rc]:"ACESFilmic",[oc]:"AgX",[lc]:"Neutral",[ac]:"Custom"};function ng(i,e){const t=tg[e];return t===void 0?(ze("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const rr=new G;function ig(){et.getLuminanceCoefficients(rr);const i=rr.x.toFixed(4),e=rr.y.toFixed(4),t=rr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function sg(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(os).join(`
`)}function rg(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function ag(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(e,s),a=r.name;let o=1;r.type===i.FLOAT_MAT2&&(o=2),r.type===i.FLOAT_MAT3&&(o=3),r.type===i.FLOAT_MAT4&&(o=4),t[a]={type:r.type,location:i.getAttribLocation(e,a),locationSize:o}}return t}function os(i){return i!==""}function Ll(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_SUN_LIGHTS/g,e.numSunLights).replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_SUN_LIGHT_SHADOWS/g,e.numSunLightShadows).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Il(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const og=/^[ \t]*#include +<([\w\d./]+)>/gm;function mo(i){return i.replace(og,cg)}const lg=new Map;function cg(i,e){let t=Ze[e];if(t===void 0){const n=lg.get(e);if(n!==void 0)t=Ze[n],ze('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return mo(t)}const ug=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Dl(i){return i.replace(ug,dg)}function dg(i,e,t,n){let s="";for(let r=parseInt(e);r<parseInt(t);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function Ul(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const hg={[dr]:"SHADOWMAP_TYPE_PCF",[as]:"SHADOWMAP_TYPE_VSM"};function fg(i){return hg[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const pg={[ri]:"ENVMAP_TYPE_CUBE",[Ui]:"ENVMAP_TYPE_CUBE",[Pr]:"ENVMAP_TYPE_CUBE_UV"};function mg(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":pg[i.envMapMode]||"ENVMAP_TYPE_CUBE"}const gg={[Ui]:"ENVMAP_MODE_REFRACTION"};function _g(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":gg[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}const yg={[tc]:"ENVMAP_BLENDING_MULTIPLY",[sd]:"ENVMAP_BLENDING_MIX",[rd]:"ENVMAP_BLENDING_ADD"};function xg(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":yg[i.combine]||"ENVMAP_BLENDING_NONE"}function vg(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function bg(i,e,t,n){const s=i.getContext(),r=t.defines;let a=t.vertexShader,o=t.fragmentShader;const l=fg(t),c=mg(t),u=_g(t),h=xg(t),d=vg(t),f=sg(t),_=rg(r),b=s.createProgram();let m,p,T=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(os).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_].filter(os).join(`
`),p.length>0&&(p+=`
`)):(m=[Ul(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+u:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(os).join(`
`),p=[Ul(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,_,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+u:"",t.envMap?"#define "+h:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.retroreflection?"#define USE_RETROREFLECTION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Sn?"#define TONE_MAPPING":"",t.toneMapping!==Sn?Ze.tonemapping_pars_fragment:"",t.toneMapping!==Sn?ng("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ze.colorspace_pars_fragment,eg("linearToOutputTexel",t.outputColorSpace),ig(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(os).join(`
`)),a=mo(a),a=Ll(a,t),a=Il(a,t),o=mo(o),o=Ll(o,t),o=Il(o,t),a=Dl(a),o=Dl(o),t.isRawShaderMaterial!==!0&&(T=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",t.glslVersion===ms?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===ms?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const P=T+m+a,S=T+p+o,R=Rl(s,s.VERTEX_SHADER,P),A=Rl(s,s.FRAGMENT_SHADER,S);s.attachShader(b,R),s.attachShader(b,A),t.index0AttributeName!==void 0?s.bindAttribLocation(b,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(b,0,"position"),s.linkProgram(b);function L(N){if(i.debug.checkShaderErrors){const W=s.getProgramInfoLog(b)||"",z=s.getShaderInfoLog(R)||"",C=s.getShaderInfoLog(A)||"",V=W.trim(),O=z.trim(),I=C.trim();let j=!0,H=!0;if(s.getProgramParameter(b,s.LINK_STATUS)===!1)if(j=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,b,R,A);else{const X=Pl(s,R,"vertex"),J=Pl(s,A,"fragment");dt("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(b,s.VALIDATE_STATUS)+`

Material Name: `+N.name+`
Material Type: `+N.type+`

Program Info Log: `+V+`
`+X+`
`+J)}else V!==""?ze("WebGLProgram: Program Info Log:",V):(O===""||I==="")&&(H=!1);H&&(N.diagnostics={runnable:j,programLog:V,vertexShader:{log:O,prefix:m},fragmentShader:{log:I,prefix:p}})}s.deleteShader(R),s.deleteShader(A),y=new _r(s,b),w=ag(s,b)}let y;this.getUniforms=function(){return y===void 0&&L(this),y};let w;this.getAttributes=function(){return w===void 0&&L(this),w};let M=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return M===!1&&(M=s.getProgramParameter(b,Zm)),M},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(b),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Jm++,this.cacheKey=e,this.usedTimes=1,this.program=b,this.vertexShader=R,this.fragmentShader=A,this}let Sg=0;class Mg{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){const s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new wg(e),t.set(e,n)),n}}class wg{constructor(e){this.id=Sg++,this.code=e,this.usedTimes=0}}function Tg(i){return i===ai||i===xr||i===vr}function Eg(i,e,t,n,s,r){const a=new _c,o=new Mg,l=new Set,c=[],u=new Map,h=n.logarithmicDepthBuffer;let d=n.precision;const f={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(y){return l.add(y),y===0?"uv":`uv${y}`}function b(y,w,M,N,W,z){const C=N.fog,V=W.geometry,O=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?N.environment:null,I=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap,j=e.get(y.envMap||O,I),H=j&&j.mapping===Pr?j.image.height:null,X=f[y.type];y.precision!==null&&(d=n.getMaxPrecision(y.precision),d!==y.precision&&ze("WebGLProgram.getParameters:",y.precision,"not supported, using",d,"instead."));const J=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,Se=J!==void 0?J.length:0;let ve=0;V.morphAttributes.position!==void 0&&(ve=1),V.morphAttributes.normal!==void 0&&(ve=2),V.morphAttributes.color!==void 0&&(ve=3);let He,Ne,Oe,$;if(X){const it=vn[X];He=it.vertexShader,Ne=it.fragmentShader}else{He=y.vertexShader,Ne=y.fragmentShader;const it=o.getVertexShaderStage(y),Ye=o.getFragmentShaderStage(y);o.update(y,it,Ye),Oe=it.id,$=Ye.id}const ne=i.getRenderTarget(),le=i.state.buffers.depth.getReversed(),Ee=W.isInstancedMesh===!0,he=W.isBatchedMesh===!0,Fe=!!y.map,ft=!!y.matcap,Ue=!!j,Ve=!!y.aoMap,nt=!!y.lightMap,Ke=!!y.bumpMap&&y.wireframe===!1,yt=!!y.normalMap,bt=!!y.displacementMap,Dt=!!y.emissiveMap,mt=!!y.metalnessMap,St=!!y.roughnessMap,k=y.anisotropy>0,wt=y.clearcoat>0,at=y.dispersion>0,E=y.retroreflectivity>0,g=y.iridescence>0,B=y.sheen>0,Y=y.transmission>0,ee=k&&!!y.anisotropyMap,ae=wt&&!!y.clearcoatMap,ce=wt&&!!y.clearcoatNormalMap,Q=wt&&!!y.clearcoatRoughnessMap,re=g&&!!y.iridescenceMap,fe=g&&!!y.iridescenceThicknessMap,Ae=B&&!!y.sheenColorMap,ue=B&&!!y.sheenRoughnessMap,de=!!y.specularMap,Le=!!y.specularColorMap,De=!!y.specularIntensityMap,Be=Y&&!!y.transmissionMap,D=Y&&!!y.thicknessMap,ge=!!y.gradientMap,se=!!y.alphaMap,pe=y.alphaTest>0,_e=!!y.alphaHash,te=!!y.extensions;let Ce=Sn;y.toneMapped&&(ne===null||ne.isXRRenderTarget===!0)&&(Ce=i.toneMapping);const Pe={shaderID:X,shaderType:y.type,shaderName:y.name,vertexShader:He,fragmentShader:Ne,defines:y.defines,customVertexShaderID:Oe,customFragmentShaderID:$,isRawShaderMaterial:y.isRawShaderMaterial===!0,glslVersion:y.glslVersion,precision:d,batching:he,batchingColor:he&&W._colorsTexture!==null,instancing:Ee,instancingColor:Ee&&W.instanceColor!==null,instancingMorph:Ee&&W.morphTexture!==null,outputColorSpace:ne===null?i.outputColorSpace:ne.isXRRenderTarget===!0?ne.texture.colorSpace:et.workingColorSpace,alphaToCoverage:!!y.alphaToCoverage,map:Fe,matcap:ft,envMap:Ue,envMapMode:Ue&&j.mapping,envMapCubeUVHeight:H,aoMap:Ve,lightMap:nt,bumpMap:Ke,normalMap:yt,displacementMap:bt,emissiveMap:Dt,normalMapObjectSpace:yt&&y.normalMapType===ld,normalMapTangentSpace:yt&&y.normalMapType===Vo,packedNormalMap:yt&&y.normalMapType===Vo&&Tg(y.normalMap.format),metalnessMap:mt,roughnessMap:St,anisotropy:k,anisotropyMap:ee,clearcoat:wt,clearcoatMap:ae,clearcoatNormalMap:ce,clearcoatRoughnessMap:Q,dispersion:at,retroreflection:E,iridescence:g,iridescenceMap:re,iridescenceThicknessMap:fe,sheen:B,sheenColorMap:Ae,sheenRoughnessMap:ue,specularMap:de,specularColorMap:Le,specularIntensityMap:De,transmission:Y,transmissionMap:Be,thicknessMap:D,gradientMap:ge,opaque:y.transparent===!1&&y.blending===cs&&y.alphaToCoverage===!1,alphaMap:se,alphaTest:pe,alphaHash:_e,combine:y.combine,mapUv:Fe&&_(y.map.channel),aoMapUv:Ve&&_(y.aoMap.channel),lightMapUv:nt&&_(y.lightMap.channel),bumpMapUv:Ke&&_(y.bumpMap.channel),normalMapUv:yt&&_(y.normalMap.channel),displacementMapUv:bt&&_(y.displacementMap.channel),emissiveMapUv:Dt&&_(y.emissiveMap.channel),metalnessMapUv:mt&&_(y.metalnessMap.channel),roughnessMapUv:St&&_(y.roughnessMap.channel),anisotropyMapUv:ee&&_(y.anisotropyMap.channel),clearcoatMapUv:ae&&_(y.clearcoatMap.channel),clearcoatNormalMapUv:ce&&_(y.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:Q&&_(y.clearcoatRoughnessMap.channel),iridescenceMapUv:re&&_(y.iridescenceMap.channel),iridescenceThicknessMapUv:fe&&_(y.iridescenceThicknessMap.channel),sheenColorMapUv:Ae&&_(y.sheenColorMap.channel),sheenRoughnessMapUv:ue&&_(y.sheenRoughnessMap.channel),specularMapUv:de&&_(y.specularMap.channel),specularColorMapUv:Le&&_(y.specularColorMap.channel),specularIntensityMapUv:De&&_(y.specularIntensityMap.channel),transmissionMapUv:Be&&_(y.transmissionMap.channel),thicknessMapUv:D&&_(y.thicknessMap.channel),alphaMapUv:se&&_(y.alphaMap.channel),vertexTangents:!!V.attributes.tangent&&(yt||k),vertexNormals:!!V.attributes.normal,vertexColors:y.vertexColors,vertexAlphas:y.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,pointsUvs:W.isPoints===!0&&!!V.attributes.uv&&(Fe||se),fog:!!C,useFog:y.fog===!0,fogExp2:!!C&&C.isFogExp2,flatShading:y.wireframe===!1&&(y.flatShading===!0||V.attributes.normal===void 0&&yt===!1&&(y.isMeshLambertMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isMeshPhysicalMaterial)),sizeAttenuation:y.sizeAttenuation===!0,logarithmicDepthBuffer:h,reversedDepthBuffer:le,skinning:W.isSkinnedMesh===!0,hasPositionAttribute:V.attributes.position!==void 0,morphTargets:V.morphAttributes.position!==void 0,morphNormals:V.morphAttributes.normal!==void 0,morphColors:V.morphAttributes.color!==void 0,morphTargetsCount:Se,morphTextureStride:ve,numSunLights:w.sun.length,numDirLights:w.directional.length,numPointLights:w.point.length,numSpotLights:w.spot.length,numSpotLightMaps:w.spotLightMap.length,numRectAreaLights:w.rectArea.length,numHemiLights:w.hemi.length,numSunLightShadows:w.sunShadowMap.length,numDirLightShadows:w.directionalShadowMap.length,numPointLightShadows:w.pointShadowMap.length,numSpotLightShadows:w.spotShadowMap.length,numSpotLightShadowsWithMaps:w.numSpotLightShadowsWithMaps,numLightProbes:w.numLightProbes,numLightProbeGrids:z.length,numClippingPlanes:r.numPlanes,numClipIntersection:r.numIntersection,dithering:y.dithering,shadowMapEnabled:i.shadowMap.enabled&&M.length>0,shadowMapType:i.shadowMap.type,toneMapping:Ce,decodeVideoTexture:Fe&&y.map.isVideoTexture===!0&&et.getTransfer(y.map.colorSpace)===_t,decodeVideoTextureEmissive:Dt&&y.emissiveMap.isVideoTexture===!0&&et.getTransfer(y.emissiveMap.colorSpace)===_t,premultipliedAlpha:y.premultipliedAlpha,doubleSided:y.side===jt,flipSided:y.side===qt,useDepthPacking:y.depthPacking>=0,depthPacking:y.depthPacking||0,index0AttributeName:y.index0AttributeName,extensionClipCullDistance:te&&y.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(te&&y.extensions.multiDraw===!0||he)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:y.customProgramCacheKey()};return Pe.vertexUv1s=l.has(1),Pe.vertexUv2s=l.has(2),Pe.vertexUv3s=l.has(3),l.clear(),Pe}function m(y){const w=[];if(y.shaderID?w.push(y.shaderID):(w.push(y.customVertexShaderID),w.push(y.customFragmentShaderID)),y.defines!==void 0)for(const M in y.defines)w.push(M),w.push(y.defines[M]);return y.isRawShaderMaterial===!1&&(p(w,y),T(w,y),w.push(i.outputColorSpace)),w.push(y.customProgramCacheKey),w.join()}function p(y,w){y.push(w.precision),y.push(w.outputColorSpace),y.push(w.envMapMode),y.push(w.envMapCubeUVHeight),y.push(w.mapUv),y.push(w.alphaMapUv),y.push(w.lightMapUv),y.push(w.aoMapUv),y.push(w.bumpMapUv),y.push(w.normalMapUv),y.push(w.displacementMapUv),y.push(w.emissiveMapUv),y.push(w.metalnessMapUv),y.push(w.roughnessMapUv),y.push(w.anisotropyMapUv),y.push(w.clearcoatMapUv),y.push(w.clearcoatNormalMapUv),y.push(w.clearcoatRoughnessMapUv),y.push(w.iridescenceMapUv),y.push(w.iridescenceThicknessMapUv),y.push(w.sheenColorMapUv),y.push(w.sheenRoughnessMapUv),y.push(w.specularMapUv),y.push(w.specularColorMapUv),y.push(w.specularIntensityMapUv),y.push(w.transmissionMapUv),y.push(w.thicknessMapUv),y.push(w.combine),y.push(w.fogExp2),y.push(w.sizeAttenuation),y.push(w.morphTargetsCount),y.push(w.morphAttributeCount),y.push(w.numSunLights),y.push(w.numDirLights),y.push(w.numPointLights),y.push(w.numSpotLights),y.push(w.numSpotLightMaps),y.push(w.numHemiLights),y.push(w.numRectAreaLights),y.push(w.numSunLightShadows),y.push(w.numDirLightShadows),y.push(w.numPointLightShadows),y.push(w.numSpotLightShadows),y.push(w.numSpotLightShadowsWithMaps),y.push(w.numLightProbes),y.push(w.shadowMapType),y.push(w.toneMapping),y.push(w.numClippingPlanes),y.push(w.numClipIntersection),y.push(w.depthPacking)}function T(y,w){a.disableAll(),w.instancing&&a.enable(0),w.instancingColor&&a.enable(1),w.instancingMorph&&a.enable(2),w.matcap&&a.enable(3),w.envMap&&a.enable(4),w.normalMapObjectSpace&&a.enable(5),w.normalMapTangentSpace&&a.enable(6),w.clearcoat&&a.enable(7),w.iridescence&&a.enable(8),w.alphaTest&&a.enable(9),w.vertexColors&&a.enable(10),w.vertexAlphas&&a.enable(11),w.vertexUv1s&&a.enable(12),w.vertexUv2s&&a.enable(13),w.vertexUv3s&&a.enable(14),w.vertexTangents&&a.enable(15),w.anisotropy&&a.enable(16),w.alphaHash&&a.enable(17),w.batching&&a.enable(18),w.dispersion&&a.enable(19),w.retroreflection&&a.enable(24),w.batchingColor&&a.enable(20),w.gradientMap&&a.enable(21),w.packedNormalMap&&a.enable(22),w.vertexNormals&&a.enable(23),y.push(a.mask),a.disableAll(),w.fog&&a.enable(0),w.useFog&&a.enable(1),w.flatShading&&a.enable(2),w.logarithmicDepthBuffer&&a.enable(3),w.reversedDepthBuffer&&a.enable(4),w.skinning&&a.enable(5),w.morphTargets&&a.enable(6),w.morphNormals&&a.enable(7),w.morphColors&&a.enable(8),w.premultipliedAlpha&&a.enable(9),w.shadowMapEnabled&&a.enable(10),w.doubleSided&&a.enable(11),w.flipSided&&a.enable(12),w.useDepthPacking&&a.enable(13),w.dithering&&a.enable(14),w.transmission&&a.enable(15),w.sheen&&a.enable(16),w.opaque&&a.enable(17),w.pointsUvs&&a.enable(18),w.decodeVideoTexture&&a.enable(19),w.decodeVideoTextureEmissive&&a.enable(20),w.alphaToCoverage&&a.enable(21),w.numLightProbeGrids>0&&a.enable(22),w.hasPositionAttribute&&a.enable(23),y.push(a.mask)}function P(y){const w=f[y.type];let M;if(w){const N=vn[w];M=Yd.clone(N.uniforms)}else M=y.uniforms;return M}function S(y,w){let M=u.get(w);return M!==void 0?++M.usedTimes:(M=new bg(i,w,y,s),c.push(M),u.set(w,M)),M}function R(y){if(--y.usedTimes===0){const w=c.indexOf(y);c[w]=c[c.length-1],c.pop(),u.delete(y.cacheKey),y.destroy()}}function A(y){o.remove(y)}function L(){o.dispose()}return{getParameters:b,getProgramCacheKey:m,getUniforms:P,acquireProgram:S,releaseProgram:R,releaseShaderCache:A,programs:c,dispose:L}}function Ag(){let i=new WeakMap;function e(a){return i.has(a)}function t(a){let o=i.get(a);return o===void 0&&(o={},i.set(a,o)),o}function n(a){i.delete(a)}function s(a,o,l){i.get(a)[o]=l}function r(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:r}}function Rg(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function kl(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function Nl(){const i=[];let e=0;const t=[],n=[],s=[];function r(){e=0,t.length=0,n.length=0,s.length=0}function a(d){let f=0;return d.isInstancedMesh&&(f+=2),d.isSkinnedMesh&&(f+=1),f}function o(d,f,_,b,m,p){let T=i[e];return T===void 0?(T={id:d.id,object:d,geometry:f,material:_,materialVariant:a(d),groupOrder:b,renderOrder:d.renderOrder,z:m,group:p},i[e]=T):(T.id=d.id,T.object=d,T.geometry=f,T.material=_,T.materialVariant=a(d),T.groupOrder=b,T.renderOrder=d.renderOrder,T.z=m,T.group=p),e++,T}function l(d,f,_,b,m,p,T){T.reversedDepth===!0&&(m=-m);const P=o(d,f,_,b,m,p);_.transmission>0?n.push(P):_.transparent===!0?s.push(P):t.push(P)}function c(d,f,_,b,m,p){const T=o(d,f,_,b,m,p);_.transmission>0?n.unshift(T):_.transparent===!0?s.unshift(T):t.unshift(T)}function u(d,f){t.length>1&&t.sort(d||Rg),n.length>1&&n.sort(f||kl),s.length>1&&s.sort(f||kl)}function h(){for(let d=e,f=i.length;d<f;d++){const _=i[d];if(_.id===null)break;_.id=null,_.object=null,_.geometry=null,_.material=null,_.group=null}}return{opaque:t,transmissive:n,transparent:s,init:r,push:l,unshift:c,finish:h,sort:u}}function Cg(){let i=new WeakMap;function e(n,s){const r=i.get(n);let a;return r===void 0?(a=new Nl,i.set(n,[a])):s>=r.length?(a=new Nl,r.push(a)):a=r[s],a}function t(){i=new WeakMap}return{get:e,dispose:t}}function Pg(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={direction:new G,color:new Qe};break;case"SpotLight":t={position:new G,direction:new G,color:new Qe,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new G,color:new Qe,distance:0,decay:0};break;case"HemisphereLight":t={direction:new G,skyColor:new Qe,groundColor:new Qe};break;case"RectAreaLight":t={color:new Qe,position:new G,halfWidth:new G,halfHeight:new G};break}return i[e.id]=t,t}}}function Lg(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"SunLight":case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ct,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let Ig=0;function Dg(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function Ug(i){const e=new Pg,t=Lg(),n={version:0,hash:{sunLength:-1,directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numSunShadows:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],sun:[],sunShadow:[],sunShadowMap:[],sunShadowMatrix:[],sunShadowCascade:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new G);const s=new G,r=new Je,a=new Je;function o(c){let u=0,h=0,d=0;for(let W=0;W<9;W++)n.probe[W].set(0,0,0);let f=0,_=0,b=0,m=0,p=0,T=0,P=0,S=0,R=0,A=0,L=0,y=0,w=0,M=0;c.sort(Dg);for(let W=0,z=c.length;W<z;W++){const C=c[W],V=C.color,O=C.intensity,I=C.distance;let j=null;if(C.shadow&&C.shadow.map&&(C.shadow.map.texture.format===ai?j=C.shadow.map.texture:j=C.shadow.map.depthTexture||C.shadow.map.texture),C.isAmbientLight)u+=V.r*O,h+=V.g*O,d+=V.b*O;else if(C.isLightProbe){for(let H=0;H<9;H++)n.probe[H].addScaledVector(C.sh.coefficients[H],O);M++}else if(C.isSunLight){const H=e.get(C);if(H.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){const X=C.shadow,J=t.get(C);J.shadowIntensity=X.intensity,J.shadowBias=X.bias,J.shadowNormalBias=X.normalBias,J.shadowRadius=X.radius,J.shadowMapSize.copy(X.mapSize).multiply(X.getFrameExtents()),n.sunShadow[_]=J,n.sunShadowMap[_]=j;const Se=X.getViewportCount();for(let ve=0;ve<Se;ve++)n.sunShadowMatrix[b+ve]=X.getMatrix(ve),n.sunShadowCascade[b+ve]=X._cascadeData[ve];b+=Se,_++}n.sun[f]=H,f++}else if(C.isDirectionalLight){const H=e.get(C);if(H.color.copy(C.color).multiplyScalar(C.intensity),C.castShadow){const X=C.shadow,J=t.get(C);J.shadowIntensity=X.intensity,J.shadowBias=X.bias,J.shadowNormalBias=X.normalBias,J.shadowRadius=X.radius,J.shadowMapSize=X.mapSize,n.directionalShadow[m]=J,n.directionalShadowMap[m]=j,n.directionalShadowMatrix[m]=C.shadow.matrix,R++}n.directional[m]=H,m++}else if(C.isSpotLight){const H=e.get(C);H.position.setFromMatrixPosition(C.matrixWorld),H.color.copy(V).multiplyScalar(O),H.distance=I,H.coneCos=Math.cos(C.angle),H.penumbraCos=Math.cos(C.angle*(1-C.penumbra)),H.decay=C.decay,n.spot[T]=H;const X=C.shadow;if(C.map&&(n.spotLightMap[y]=C.map,y++,X.updateMatrices(C),C.castShadow&&w++),n.spotLightMatrix[T]=X.matrix,C.castShadow){const J=t.get(C);J.shadowIntensity=X.intensity,J.shadowBias=X.bias,J.shadowNormalBias=X.normalBias,J.shadowRadius=X.radius,J.shadowMapSize=X.mapSize,n.spotShadow[T]=J,n.spotShadowMap[T]=j,L++}T++}else if(C.isRectAreaLight){const H=e.get(C);H.color.copy(V).multiplyScalar(O),H.halfWidth.set(C.width*.5,0,0),H.halfHeight.set(0,C.height*.5,0),n.rectArea[P]=H,P++}else if(C.isPointLight){const H=e.get(C);if(H.color.copy(C.color).multiplyScalar(C.intensity),H.distance=C.distance,H.decay=C.decay,C.castShadow){const X=C.shadow,J=t.get(C);J.shadowIntensity=X.intensity,J.shadowBias=X.bias,J.shadowNormalBias=X.normalBias,J.shadowRadius=X.radius,J.shadowMapSize=X.mapSize,J.shadowCameraNear=X.camera.near,J.shadowCameraFar=X.camera.far,n.pointShadow[p]=J,n.pointShadowMap[p]=j,n.pointShadowMatrix[p]=C.shadow.matrix,A++}n.point[p]=H,p++}else if(C.isHemisphereLight){const H=e.get(C);H.skyColor.copy(C.color).multiplyScalar(O),H.groundColor.copy(C.groundColor).multiplyScalar(O),n.hemi[S]=H,S++}}P>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=be.LTC_FLOAT_1,n.rectAreaLTC2=be.LTC_FLOAT_2):(n.rectAreaLTC1=be.LTC_HALF_1,n.rectAreaLTC2=be.LTC_HALF_2)),n.ambient[0]=u,n.ambient[1]=h,n.ambient[2]=d;const N=n.hash;(N.sunLength!==f||N.directionalLength!==m||N.pointLength!==p||N.spotLength!==T||N.rectAreaLength!==P||N.hemiLength!==S||N.numSunShadows!==_||N.numDirectionalShadows!==R||N.numPointShadows!==A||N.numSpotShadows!==L||N.numSpotMaps!==y||N.numLightProbes!==M)&&(n.sun.length=f,n.directional.length=m,n.spot.length=T,n.rectArea.length=P,n.point.length=p,n.hemi.length=S,n.sunShadow.length=_,n.sunShadowMap.length=_,n.sunShadowMatrix.length=b,n.sunShadowCascade.length=b,n.directionalShadow.length=R,n.directionalShadowMap.length=R,n.directionalShadowMatrix.length=R,n.pointShadow.length=A,n.pointShadowMap.length=A,n.pointShadowMatrix.length=A,n.spotShadow.length=L,n.spotShadowMap.length=L,n.spotLightMatrix.length=L+y-w,n.spotLightMap.length=y,n.numSpotLightShadowsWithMaps=w,n.numLightProbes=M,N.sunLength=f,N.directionalLength=m,N.pointLength=p,N.spotLength=T,N.rectAreaLength=P,N.hemiLength=S,N.numSunShadows=_,N.numDirectionalShadows=R,N.numPointShadows=A,N.numSpotShadows=L,N.numSpotMaps=y,N.numLightProbes=M,n.version=Ig++)}function l(c,u){let h=0,d=0,f=0,_=0,b=0,m=0;const p=u.matrixWorldInverse;for(let T=0,P=c.length;T<P;T++){const S=c[T];if(S.isSunLight){const R=n.sun[h];R.direction.setFromMatrixPosition(S.matrixWorld),R.direction.transformDirection(p),h++}else if(S.isDirectionalLight){const R=n.directional[d];R.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),R.direction.sub(s),R.direction.transformDirection(p),d++}else if(S.isSpotLight){const R=n.spot[_];R.position.setFromMatrixPosition(S.matrixWorld),R.position.applyMatrix4(p),R.direction.setFromMatrixPosition(S.matrixWorld),s.setFromMatrixPosition(S.target.matrixWorld),R.direction.sub(s),R.direction.transformDirection(p),_++}else if(S.isRectAreaLight){const R=n.rectArea[b];R.position.setFromMatrixPosition(S.matrixWorld),R.position.applyMatrix4(p),a.identity(),r.copy(S.matrixWorld),r.premultiply(p),a.extractRotation(r),R.halfWidth.set(S.width*.5,0,0),R.halfHeight.set(0,S.height*.5,0),R.halfWidth.applyMatrix4(a),R.halfHeight.applyMatrix4(a),b++}else if(S.isPointLight){const R=n.point[f];R.position.setFromMatrixPosition(S.matrixWorld),R.position.applyMatrix4(p),f++}else if(S.isHemisphereLight){const R=n.hemi[m];R.direction.setFromMatrixPosition(S.matrixWorld),R.direction.transformDirection(p),m++}}}return{setup:o,setupView:l,state:n}}function Fl(i){const e=new Ug(i),t=[],n=[],s=[];function r(d){h.camera=d,t.length=0,n.length=0,s.length=0}function a(d){t.push(d)}function o(d){n.push(d)}function l(d){s.push(d)}function c(){e.setup(t)}function u(d){e.setupView(t,d)}const h={lightsArray:t,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:r,state:h,setupLights:c,setupLightsView:u,pushLight:a,pushShadow:o,pushLightProbeGrid:l}}function kg(i){let e=new WeakMap;function t(s,r=0){const a=e.get(s);let o;return a===void 0?(o=new Fl(i),e.set(s,[o])):r>=a.length?(o=new Fl(i),a.push(o)):o=a[r],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const Ng=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Fg=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Og=[new G(1,0,0),new G(-1,0,0),new G(0,1,0),new G(0,-1,0),new G(0,0,1),new G(0,0,-1)],Bg=[new G(0,-1,0),new G(0,-1,0),new G(0,0,1),new G(0,0,-1),new G(0,-1,0),new G(0,-1,0)],Ol=new Je,ji=new G,_a=new G;function zg(i,e,t){let n=new Sc;const s=new ct,r=new ct,a=new Mt,o=new Jd,l=new Qd,c={},u=t.maxTextureSize,h={[Yn]:qt,[qt]:Yn,[jt]:jt},d=new Tn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ct},radius:{value:4}},vertexShader:Ng,fragmentShader:Fg}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const _=new Tt;_.setAttribute("position",new Rt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const b=new kt(_,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=dr;let p=this.type;this.render=function(A,L,y){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;this.type===Bu&&(ze("WebGLShadowMap: PCFSoftShadowMap has been removed. Using PCFShadowMap instead."),this.type=dr);const w=i.getRenderTarget(),M=i.getActiveCubeFace(),N=i.getActiveMipmapLevel(),W=i.state;W.setBlending(Dn),W.buffers.depth.getReversed()===!0?W.buffers.color.setClear(0,0,0,0):W.buffers.color.setClear(1,1,1,1),W.buffers.depth.setTest(!0),W.setScissorTest(!1);const z=p!==this.type;z&&L.traverse(function(C){C.material&&(Array.isArray(C.material)?C.material.forEach(V=>V.needsUpdate=!0):C.material.needsUpdate=!0)});for(let C=0,V=A.length;C<V;C++){const O=A[C],I=O.shadow;if(I===void 0){ze("WebGLShadowMap:",O,"has no shadow.");continue}if(I.autoUpdate===!1&&I.needsUpdate===!1)continue;s.copy(I.mapSize);const j=I.getFrameExtents();s.multiply(j),r.copy(I.mapSize),(s.x>u||s.y>u)&&(s.x>u&&(r.x=Math.floor(u/j.x),s.x=r.x*j.x,I.mapSize.x=r.x),s.y>u&&(r.y=Math.floor(u/j.y),s.y=r.y*j.y,I.mapSize.y=r.y));const H=i.state.buffers.depth.getReversed();if(I.camera._reversedDepth=H,I.map===null||z===!0){if(I.map!==null&&(I.map.depthTexture!==null&&(I.map.depthTexture.dispose(),I.map.depthTexture=null),I.map.dispose()),this.type===as){if(O.isPointLight){ze("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}I.map=new rn(s.x,s.y,{format:ai,type:wn,minFilter:Ut,magFilter:Ut,generateMipmaps:!1}),I.map.texture.name=O.name+".shadowMap",I.map.depthTexture=new gs(s.x,s.y,hn),I.map.depthTexture.name=O.name+".shadowMapDepth",I.map.depthTexture.format=Nn,I.map.depthTexture.compareFunction=null,I.map.depthTexture.minFilter=At,I.map.depthTexture.magFilter=At}else O.isPointLight?(I.map=new Dc(s.x),I.map.depthTexture=new Xd(s.x,Mn)):(I.map=new rn(s.x,s.y),I.map.depthTexture=new gs(s.x,s.y,Mn)),I.map.depthTexture.name=O.name+".shadowMap",I.map.depthTexture.format=Nn,this.type===dr?(I.map.depthTexture.compareFunction=H?Ao:Eo,I.map.depthTexture.minFilter=Ut,I.map.depthTexture.magFilter=Ut):(I.map.depthTexture.compareFunction=null,I.map.depthTexture.minFilter=At,I.map.depthTexture.magFilter=At);I.camera.updateProjectionMatrix()}I.map.isWebGLCubeRenderTarget!==!0&&(I.map.width!==s.x||I.map.height!==s.y)&&I.map.setSize(s.x,s.y);const X=I.map.isWebGLCubeRenderTarget?6:I.getViewportCount();O.isPointLight!==!0&&I.updateMatrices(O,y);for(let J=0;J<X;J++){const Se=I.getCamera(J);if(O.isPointLight){const ve=I.camera,He=I.matrix,Ne=O.distance||ve.far;Ne!==ve.far&&(ve.far=Ne,ve.updateProjectionMatrix()),ji.setFromMatrixPosition(O.matrixWorld),ve.position.copy(ji),_a.copy(ve.position),_a.add(Og[J]),ve.up.copy(Bg[J]),ve.lookAt(_a),ve.updateMatrixWorld(),He.makeTranslation(-ji.x,-ji.y,-ji.z),Ol.multiplyMatrices(ve.projectionMatrix,ve.matrixWorldInverse),I._frustum.setFromProjectionMatrix(Ol,ve.coordinateSystem,ve.reversedDepth)}if(I.map.isWebGLCubeRenderTarget)i.setRenderTarget(I.map,J),i.clear();else{J===0&&(i.setRenderTarget(I.map),i.clear());const ve=I.getViewport(J);a.set(r.x*ve.x,r.y*ve.y,r.x*ve.z,r.y*ve.w),W.viewport(a)}n=I.getFrustum(J),S(L,y,Se,O,this.type)}I.isPointLightShadow!==!0&&this.type===as&&T(I,y),I.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(w,M,N)};function T(A,L){const y=e.update(b);d.defines.VSM_SAMPLES!==A.blurSamples&&(d.defines.VSM_SAMPLES=A.blurSamples,f.defines.VSM_SAMPLES=A.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),A.mapPass===null?A.mapPass=new rn(s.x,s.y,{format:ai,type:wn}):(A.mapPass.width!==A.map.width||A.mapPass.height!==A.map.height)&&A.mapPass.setSize(A.map.width,A.map.height),d.uniforms.shadow_pass.value=A.map.depthTexture,d.uniforms.resolution.value.set(A.map.width,A.map.height),d.uniforms.radius.value=A.radius,i.setRenderTarget(A.mapPass),i.clear(),i.renderBufferDirect(L,null,y,d,b,null),f.uniforms.shadow_pass.value=A.mapPass.texture,f.uniforms.resolution.value.set(A.map.width,A.map.height),f.uniforms.radius.value=A.radius,i.setRenderTarget(A.map),i.clear(),i.renderBufferDirect(L,null,y,f,b,null)}function P(A,L,y,w){let M=null;const N=y.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(N!==void 0)M=N;else if(M=y.isPointLight===!0?l:o,i.localClippingEnabled&&L.clipShadows===!0&&Array.isArray(L.clippingPlanes)&&L.clippingPlanes.length!==0||L.displacementMap&&L.displacementScale!==0||L.alphaMap&&L.alphaTest>0||L.map&&L.alphaTest>0||L.alphaToCoverage===!0){const W=M.uuid,z=L.uuid;let C=c[W];C===void 0&&(C={},c[W]=C);let V=C[z];V===void 0&&(V=M.clone(),C[z]=V,L.addEventListener("dispose",R)),M=V}if(M.visible=L.visible,M.wireframe=L.wireframe,w===as?M.side=L.shadowSide!==null?L.shadowSide:L.side:M.side=L.shadowSide!==null?L.shadowSide:h[L.side],M.alphaMap=L.alphaMap,M.alphaTest=L.alphaToCoverage===!0?.5:L.alphaTest,M.map=L.map,M.clipShadows=L.clipShadows,M.clippingPlanes=L.clippingPlanes,M.clipIntersection=L.clipIntersection,M.displacementMap=L.displacementMap,M.displacementScale=L.displacementScale,M.displacementBias=L.displacementBias,M.wireframeLinewidth=L.wireframeLinewidth,M.linewidth=L.linewidth,y.isPointLight===!0&&M.isMeshDistanceMaterial===!0){const W=i.properties.get(M);W.light=y}return M}function S(A,L,y,w,M){if(A.visible===!1)return;if(A.layers.test(L.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&M===as)&&(!A.frustumCulled||A.intersectsFrustum(n))){A.modelViewMatrix.multiplyMatrices(y.matrixWorldInverse,A.matrixWorld);const z=e.update(A),C=A.material;if(Array.isArray(C)){const V=z.groups;for(let O=0,I=V.length;O<I;O++){const j=V[O],H=C[j.materialIndex];if(H&&H.visible){const X=P(A,H,w,M);A.onBeforeShadow(i,A,L,y,z,X,j),i.renderBufferDirect(y,null,z,X,A,j),A.onAfterShadow(i,A,L,y,z,X,j)}}}else if(C.visible){const V=P(A,C,w,M);A.onBeforeShadow(i,A,L,y,z,V,null),i.renderBufferDirect(y,null,z,V,A,null),A.onAfterShadow(i,A,L,y,z,V,null)}}const W=A.children;for(let z=0,C=W.length;z<C;z++)S(W[z],L,y,w,M)}function R(A){A.target.removeEventListener("dispose",R);for(const y in c){const w=c[y],M=A.target.uuid;M in w&&(w[M].dispose(),delete w[M])}}}function Gg(i,e){function t(){let D=!1;const ge=new Mt;let se=null;const pe=new Mt(0,0,0,0);return{setMask:function(_e){se!==_e&&!D&&(i.colorMask(_e,_e,_e,_e),se=_e)},setLocked:function(_e){D=_e},setClear:function(_e,te,Ce,Pe,it){it===!0&&(_e*=Pe,te*=Pe,Ce*=Pe),ge.set(_e,te,Ce,Pe),pe.equals(ge)===!1&&(i.clearColor(_e,te,Ce,Pe),pe.copy(ge))},reset:function(){D=!1,se=null,pe.set(-1,0,0,0)}}}function n(){let D=!1,ge=!1,se=null,pe=null,_e=null;return{setReversed:function(te){if(ge!==te){const Ce=e.get("EXT_clip_control");te?Ce.clipControlEXT(Ce.LOWER_LEFT_EXT,Ce.ZERO_TO_ONE_EXT):Ce.clipControlEXT(Ce.LOWER_LEFT_EXT,Ce.NEGATIVE_ONE_TO_ONE_EXT),ge=te;const Pe=_e;_e=null,this.setClear(Pe)}},getReversed:function(){return ge},setTest:function(te){te?ne(i.DEPTH_TEST):le(i.DEPTH_TEST)},setMask:function(te){se!==te&&!D&&(i.depthMask(te),se=te)},setFunc:function(te){if(ge&&(te=vd[te]),pe!==te){switch(te){case Ea:i.depthFunc(i.NEVER);break;case Aa:i.depthFunc(i.ALWAYS);break;case Ra:i.depthFunc(i.LESS);break;case us:i.depthFunc(i.LEQUAL);break;case Ca:i.depthFunc(i.EQUAL);break;case Pa:i.depthFunc(i.GEQUAL);break;case La:i.depthFunc(i.GREATER);break;case Ia:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}pe=te}},setLocked:function(te){D=te},setClear:function(te){_e!==te&&(_e=te,ge&&(te=1-te),i.clearDepth(te))},reset:function(){D=!1,se=null,pe=null,_e=null,ge=!1}}}function s(){let D=!1,ge=null,se=null,pe=null,_e=null,te=null,Ce=null,Pe=null,it=null;return{setTest:function(Ye){D||(Ye?ne(i.STENCIL_TEST):le(i.STENCIL_TEST))},setMask:function(Ye){ge!==Ye&&!D&&(i.stencilMask(Ye),ge=Ye)},setFunc:function(Ye,ke,vt){(se!==Ye||pe!==ke||_e!==vt)&&(i.stencilFunc(Ye,ke,vt),se=Ye,pe=ke,_e=vt)},setOp:function(Ye,ke,vt){(te!==Ye||Ce!==ke||Pe!==vt)&&(i.stencilOp(Ye,ke,vt),te=Ye,Ce=ke,Pe=vt)},setLocked:function(Ye){D=Ye},setClear:function(Ye){it!==Ye&&(i.clearStencil(Ye),it=Ye)},reset:function(){D=!1,ge=null,se=null,pe=null,_e=null,te=null,Ce=null,Pe=null,it=null}}}const r=new t,a=new n,o=new s,l=new WeakMap,c=new WeakMap;let u={},h={},d={},f=new WeakMap,_=[],b=null,m=!1,p=null,T=null,P=null,S=null,R=null,A=null,L=null,y=new Qe(0,0,0),w=0,M=!1,N=null,W=null,z=null,C=null,V=null;const O=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let I=!1,j=0;const H=i.getParameter(i.VERSION);H.indexOf("WebGL")!==-1?(j=parseFloat(/^WebGL (\d)/.exec(H)[1]),I=j>=1):H.indexOf("OpenGL ES")!==-1&&(j=parseFloat(/^OpenGL ES (\d)/.exec(H)[1]),I=j>=2);let X=null,J={};const Se=i.getParameter(i.SCISSOR_BOX),ve=i.getParameter(i.VIEWPORT),He=new Mt().fromArray(Se),Ne=new Mt().fromArray(ve);function Oe(D,ge,se,pe){const _e=new Uint8Array(4),te=i.createTexture();i.bindTexture(D,te),i.texParameteri(D,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(D,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Ce=0;Ce<se;Ce++)D===i.TEXTURE_3D||D===i.TEXTURE_2D_ARRAY?i.texImage3D(ge,0,i.RGBA,1,1,pe,0,i.RGBA,i.UNSIGNED_BYTE,_e):i.texImage2D(ge+Ce,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,_e);return te}const $={};$[i.TEXTURE_2D]=Oe(i.TEXTURE_2D,i.TEXTURE_2D,1),$[i.TEXTURE_CUBE_MAP]=Oe(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),$[i.TEXTURE_2D_ARRAY]=Oe(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),$[i.TEXTURE_3D]=Oe(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),a.setClear(1),o.setClear(0),ne(i.DEPTH_TEST),a.setFunc(us),Ke(!1),yt(Oo),ne(i.CULL_FACE),Ve(Dn);function ne(D){u[D]!==!0&&(i.enable(D),u[D]=!0)}function le(D){u[D]!==!1&&(i.disable(D),u[D]=!1)}function Ee(D,ge){return d[D]!==ge?(i.bindFramebuffer(D,ge),d[D]=ge,D===i.DRAW_FRAMEBUFFER&&(d[i.FRAMEBUFFER]=ge),D===i.FRAMEBUFFER&&(d[i.DRAW_FRAMEBUFFER]=ge),!0):!1}function he(D,ge){let se=_,pe=!1;if(D){se=f.get(ge),se===void 0&&(se=[],f.set(ge,se));const _e=D.textures;if(se.length!==_e.length||se[0]!==i.COLOR_ATTACHMENT0){for(let te=0,Ce=_e.length;te<Ce;te++)se[te]=i.COLOR_ATTACHMENT0+te;se.length=_e.length,pe=!0}}else se[0]!==i.BACK&&(se[0]=i.BACK,pe=!0);pe&&i.drawBuffers(se)}function Fe(D){return b!==D?(i.useProgram(D),b=D,!0):!1}const ft={[Ai]:i.FUNC_ADD,[Gu]:i.FUNC_SUBTRACT,[Vu]:i.FUNC_REVERSE_SUBTRACT};ft[Hu]=i.MIN,ft[Wu]=i.MAX;const Ue={[Xu]:i.ZERO,[qu]:i.ONE,[Ku]:i.SRC_COLOR,[jl]:i.SRC_ALPHA,[ju]:i.SRC_ALPHA_SATURATE,[Ju]:i.DST_COLOR,[$u]:i.DST_ALPHA,[Yu]:i.ONE_MINUS_SRC_COLOR,[ec]:i.ONE_MINUS_SRC_ALPHA,[Qu]:i.ONE_MINUS_DST_COLOR,[Zu]:i.ONE_MINUS_DST_ALPHA,[ed]:i.CONSTANT_COLOR,[td]:i.ONE_MINUS_CONSTANT_COLOR,[nd]:i.CONSTANT_ALPHA,[id]:i.ONE_MINUS_CONSTANT_ALPHA};function Ve(D,ge,se,pe,_e,te,Ce,Pe,it,Ye){if(D===Dn){m===!0&&(le(i.BLEND),m=!1);return}if(m===!1&&(ne(i.BLEND),m=!0),D!==zu){if(D!==p||Ye!==M){if((T!==Ai||R!==Ai)&&(i.blendEquation(i.FUNC_ADD),T=Ai,R=Ai),Ye)switch(D){case cs:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Bo:i.blendFunc(i.ONE,i.ONE);break;case zo:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Go:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:dt("WebGLState: Invalid blending: ",D);break}else switch(D){case cs:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Bo:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case zo:dt("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Go:dt("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:dt("WebGLState: Invalid blending: ",D);break}P=null,S=null,A=null,L=null,y.set(0,0,0),w=0,p=D,M=Ye}return}_e=_e||ge,te=te||se,Ce=Ce||pe,(ge!==T||_e!==R)&&(i.blendEquationSeparate(ft[ge],ft[_e]),T=ge,R=_e),(se!==P||pe!==S||te!==A||Ce!==L)&&(i.blendFuncSeparate(Ue[se],Ue[pe],Ue[te],Ue[Ce]),P=se,S=pe,A=te,L=Ce),(Pe.equals(y)===!1||it!==w)&&(i.blendColor(Pe.r,Pe.g,Pe.b,it),y.copy(Pe),w=it),p=D,M=!1}function nt(D,ge){D.side===jt?le(i.CULL_FACE):ne(i.CULL_FACE);let se=D.side===qt;ge&&(se=!se),Ke(se),D.blending===cs&&D.transparent===!1?Ve(Dn):Ve(D.blending,D.blendEquation,D.blendSrc,D.blendDst,D.blendEquationAlpha,D.blendSrcAlpha,D.blendDstAlpha,D.blendColor,D.blendAlpha,D.premultipliedAlpha),a.setFunc(D.depthFunc),a.setTest(D.depthTest),a.setMask(D.depthWrite),r.setMask(D.colorWrite);const pe=D.stencilWrite;o.setTest(pe),pe&&(o.setMask(D.stencilWriteMask),o.setFunc(D.stencilFunc,D.stencilRef,D.stencilFuncMask),o.setOp(D.stencilFail,D.stencilZFail,D.stencilZPass)),Dt(D.polygonOffset,D.polygonOffsetFactor,D.polygonOffsetUnits),D.alphaToCoverage===!0?ne(i.SAMPLE_ALPHA_TO_COVERAGE):le(i.SAMPLE_ALPHA_TO_COVERAGE)}function Ke(D){N!==D&&(D?i.frontFace(i.CW):i.frontFace(i.CCW),N=D)}function yt(D){D!==Fu?(ne(i.CULL_FACE),D!==W&&(D===Oo?i.cullFace(i.BACK):D===Ou?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):le(i.CULL_FACE),W=D}function bt(D){D!==z&&(I&&i.lineWidth(D),z=D)}function Dt(D,ge,se){D?(ne(i.POLYGON_OFFSET_FILL),(C!==ge||V!==se)&&(C=ge,V=se,a.getReversed()&&(ge=-ge),i.polygonOffset(ge,se))):le(i.POLYGON_OFFSET_FILL)}function mt(D){D?ne(i.SCISSOR_TEST):le(i.SCISSOR_TEST)}function St(D){D===void 0&&(D=i.TEXTURE0+O-1),X!==D&&(i.activeTexture(D),X=D)}function k(D,ge,se){se===void 0&&(X===null?se=i.TEXTURE0+O-1:se=X);let pe=J[se];pe===void 0&&(pe={type:void 0,texture:void 0},J[se]=pe),(pe.type!==D||pe.texture!==ge)&&(X!==se&&(i.activeTexture(se),X=se),i.bindTexture(D,ge||$[D]),pe.type=D,pe.texture=ge)}function wt(){const D=J[X];D!==void 0&&D.type!==void 0&&(i.bindTexture(D.type,null),D.type=void 0,D.texture=void 0)}function at(){try{i.compressedTexImage2D(...arguments)}catch(D){dt("WebGLState:",D)}}function E(){try{i.compressedTexImage3D(...arguments)}catch(D){dt("WebGLState:",D)}}function g(){try{i.texSubImage2D(...arguments)}catch(D){dt("WebGLState:",D)}}function B(){try{i.texSubImage3D(...arguments)}catch(D){dt("WebGLState:",D)}}function Y(){try{i.compressedTexSubImage2D(...arguments)}catch(D){dt("WebGLState:",D)}}function ee(){try{i.compressedTexSubImage3D(...arguments)}catch(D){dt("WebGLState:",D)}}function ae(){try{i.texStorage2D(...arguments)}catch(D){dt("WebGLState:",D)}}function ce(){try{i.texStorage3D(...arguments)}catch(D){dt("WebGLState:",D)}}function Q(){try{i.texImage2D(...arguments)}catch(D){dt("WebGLState:",D)}}function re(){try{i.texImage3D(...arguments)}catch(D){dt("WebGLState:",D)}}function fe(D){return h[D]!==void 0?h[D]:i.getParameter(D)}function Ae(D,ge){h[D]!==ge&&(i.pixelStorei(D,ge),h[D]=ge)}function ue(D){He.equals(D)===!1&&(i.scissor(D.x,D.y,D.z,D.w),He.copy(D))}function de(D){Ne.equals(D)===!1&&(i.viewport(D.x,D.y,D.z,D.w),Ne.copy(D))}function Le(D,ge){let se=c.get(ge);se===void 0&&(se=new WeakMap,c.set(ge,se));let pe=se.get(D);pe===void 0&&(pe=i.getUniformBlockIndex(ge,D.name),se.set(D,pe))}function De(D,ge){const pe=c.get(ge).get(D);l.get(ge)!==pe&&(i.uniformBlockBinding(ge,pe,D.__bindingPointIndex),l.set(ge,pe))}function Be(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),a.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),u={},h={},X=null,J={},d={},f=new WeakMap,_=[],b=null,m=!1,p=null,T=null,P=null,S=null,R=null,A=null,L=null,y=new Qe(0,0,0),w=0,M=!1,N=null,W=null,z=null,C=null,V=null,He.set(0,0,i.canvas.width,i.canvas.height),Ne.set(0,0,i.canvas.width,i.canvas.height),r.reset(),a.reset(),o.reset()}return{buffers:{color:r,depth:a,stencil:o},enable:ne,disable:le,bindFramebuffer:Ee,drawBuffers:he,useProgram:Fe,setBlending:Ve,setMaterial:nt,setFlipSided:Ke,setCullFace:yt,setLineWidth:bt,setPolygonOffset:Dt,setScissorTest:mt,activeTexture:St,bindTexture:k,unbindTexture:wt,compressedTexImage2D:at,compressedTexImage3D:E,texImage2D:Q,texImage3D:re,pixelStorei:Ae,getParameter:fe,updateUBOMapping:Le,uniformBlockBinding:De,texStorage2D:ae,texStorage3D:ce,texSubImage2D:g,texSubImage3D:B,compressedTexSubImage2D:Y,compressedTexSubImage3D:ee,scissor:ue,viewport:de,reset:Be}}function Vg(i,e,t,n,s,r,a){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ct,u=new WeakMap,h=new Set;let d;const f=new WeakMap;let _=!1;try{_=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function b(E,g){return _?new OffscreenCanvas(E,g):Mr("canvas")}function m(E,g,B){let Y=1;const ee=at(E);if((ee.width>B||ee.height>B)&&(Y=B/Math.max(ee.width,ee.height)),Y<1)if(typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&E instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&E instanceof ImageBitmap||typeof VideoFrame<"u"&&E instanceof VideoFrame){const ae=Math.floor(Y*ee.width),ce=Math.floor(Y*ee.height);d===void 0&&(d=b(ae,ce));const Q=g?b(ae,ce):d;return Q.width=ae,Q.height=ce,Q.getContext("2d").drawImage(E,0,0,ae,ce),ze("WebGLRenderer: Texture has been resized from ("+ee.width+"x"+ee.height+") to ("+ae+"x"+ce+")."),Q}else return"data"in E&&ze("WebGLRenderer: Image in DataTexture is too big ("+ee.width+"x"+ee.height+")."),E;return E}function p(E){return E.generateMipmaps}function T(E){i.generateMipmap(E)}function P(E){return E.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:E.isWebGL3DRenderTarget?i.TEXTURE_3D:E.isWebGLArrayRenderTarget||E.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function S(E,g,B,Y,ee,ae=!1){if(E!==null){if(i[E]!==void 0)return i[E];ze("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+E+"'")}let ce;Y&&(ce=e.get("EXT_texture_norm16"),ce||ze("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let Q=g;if(g===i.RED&&(B===i.FLOAT&&(Q=i.R32F),B===i.HALF_FLOAT&&(Q=i.R16F),B===i.UNSIGNED_BYTE&&(Q=i.R8),B===i.UNSIGNED_SHORT&&ce&&(Q=ce.R16_EXT),B===i.SHORT&&ce&&(Q=ce.R16_SNORM_EXT)),g===i.RED_INTEGER&&(B===i.UNSIGNED_BYTE&&(Q=i.R8UI),B===i.UNSIGNED_SHORT&&(Q=i.R16UI),B===i.UNSIGNED_INT&&(Q=i.R32UI),B===i.BYTE&&(Q=i.R8I),B===i.SHORT&&(Q=i.R16I),B===i.INT&&(Q=i.R32I)),g===i.RG&&(B===i.FLOAT&&(Q=i.RG32F),B===i.HALF_FLOAT&&(Q=i.RG16F),B===i.UNSIGNED_BYTE&&(Q=i.RG8),B===i.UNSIGNED_SHORT&&ce&&(Q=ce.RG16_EXT),B===i.SHORT&&ce&&(Q=ce.RG16_SNORM_EXT)),g===i.RG_INTEGER&&(B===i.UNSIGNED_BYTE&&(Q=i.RG8UI),B===i.UNSIGNED_SHORT&&(Q=i.RG16UI),B===i.UNSIGNED_INT&&(Q=i.RG32UI),B===i.BYTE&&(Q=i.RG8I),B===i.SHORT&&(Q=i.RG16I),B===i.INT&&(Q=i.RG32I)),g===i.RGB_INTEGER&&(B===i.UNSIGNED_BYTE&&(Q=i.RGB8UI),B===i.UNSIGNED_SHORT&&(Q=i.RGB16UI),B===i.UNSIGNED_INT&&(Q=i.RGB32UI),B===i.BYTE&&(Q=i.RGB8I),B===i.SHORT&&(Q=i.RGB16I),B===i.INT&&(Q=i.RGB32I)),g===i.RGBA_INTEGER&&(B===i.UNSIGNED_BYTE&&(Q=i.RGBA8UI),B===i.UNSIGNED_SHORT&&(Q=i.RGBA16UI),B===i.UNSIGNED_INT&&(Q=i.RGBA32UI),B===i.BYTE&&(Q=i.RGBA8I),B===i.SHORT&&(Q=i.RGBA16I),B===i.INT&&(Q=i.RGBA32I)),g===i.RGB&&(B===i.UNSIGNED_SHORT&&ce&&(Q=ce.RGB16_EXT),B===i.SHORT&&ce&&(Q=ce.RGB16_SNORM_EXT),B===i.UNSIGNED_INT_5_9_9_9_REV&&(Q=i.RGB9_E5),B===i.UNSIGNED_INT_10F_11F_11F_REV&&(Q=i.R11F_G11F_B10F)),g===i.RGBA){const re=ae?br:et.getTransfer(ee);B===i.FLOAT&&(Q=i.RGBA32F),B===i.HALF_FLOAT&&(Q=i.RGBA16F),B===i.UNSIGNED_BYTE&&(Q=re===_t?i.SRGB8_ALPHA8:i.RGBA8),B===i.UNSIGNED_SHORT&&ce&&(Q=ce.RGBA16_EXT),B===i.SHORT&&ce&&(Q=ce.RGBA16_SNORM_EXT),B===i.UNSIGNED_SHORT_4_4_4_4&&(Q=i.RGBA4),B===i.UNSIGNED_SHORT_5_5_5_1&&(Q=i.RGB5_A1)}return(Q===i.R16F||Q===i.R32F||Q===i.RG16F||Q===i.RG32F||Q===i.RGBA16F||Q===i.RGBA32F)&&e.get("EXT_color_buffer_float"),Q}function R(E,g){let B;return E?g===null||g===Mn||g===fs?B=i.DEPTH24_STENCIL8:g===hn?B=i.DEPTH32F_STENCIL8:g===hs&&(B=i.DEPTH24_STENCIL8,ze("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):g===null||g===Mn||g===fs?B=i.DEPTH_COMPONENT24:g===hn?B=i.DEPTH_COMPONENT32F:g===hs&&(B=i.DEPTH_COMPONENT16),B}function A(E,g){return p(E)===!0||E.isFramebufferTexture&&E.minFilter!==At&&E.minFilter!==Ut?Math.log2(Math.max(g.width,g.height))+1:E.mipmaps!==void 0&&E.mipmaps.length>0?E.mipmaps.length:E.isCompressedTexture&&Array.isArray(E.image)?g.mipmaps.length:1}function L(E){const g=E.target;g.removeEventListener("dispose",L),w(g),g.isVideoTexture&&u.delete(g),g.isHTMLTexture&&h.delete(g)}function y(E){const g=E.target;g.removeEventListener("dispose",y),N(g)}function w(E){const g=n.get(E);if(g.__webglInit===void 0)return;const B=E.source,Y=f.get(B);if(Y){const ee=Y[g.__cacheKey];ee.usedTimes--,ee.usedTimes===0&&M(E),Object.keys(Y).length===0&&f.delete(B)}n.remove(E)}function M(E){const g=n.get(E);i.deleteTexture(g.__webglTexture);const B=E.source,Y=f.get(B);delete Y[g.__cacheKey],a.memory.textures--}function N(E){const g=n.get(E);if(E.depthTexture&&(E.depthTexture.dispose(),n.remove(E.depthTexture)),E.isWebGLCubeRenderTarget)for(let Y=0;Y<6;Y++){if(Array.isArray(g.__webglFramebuffer[Y]))for(let ee=0;ee<g.__webglFramebuffer[Y].length;ee++)i.deleteFramebuffer(g.__webglFramebuffer[Y][ee]);else i.deleteFramebuffer(g.__webglFramebuffer[Y]);g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer[Y])}else{if(Array.isArray(g.__webglFramebuffer))for(let Y=0;Y<g.__webglFramebuffer.length;Y++)i.deleteFramebuffer(g.__webglFramebuffer[Y]);else i.deleteFramebuffer(g.__webglFramebuffer);if(g.__webglDepthbuffer&&i.deleteRenderbuffer(g.__webglDepthbuffer),g.__webglMultisampledFramebuffer&&i.deleteFramebuffer(g.__webglMultisampledFramebuffer),g.__webglColorRenderbuffer)for(let Y=0;Y<g.__webglColorRenderbuffer.length;Y++)g.__webglColorRenderbuffer[Y]&&i.deleteRenderbuffer(g.__webglColorRenderbuffer[Y]);g.__webglDepthRenderbuffer&&i.deleteRenderbuffer(g.__webglDepthRenderbuffer)}const B=E.textures;for(let Y=0,ee=B.length;Y<ee;Y++){const ae=n.get(B[Y]);ae.__webglTexture&&(i.deleteTexture(ae.__webglTexture),a.memory.textures--),n.remove(B[Y])}n.remove(E)}let W=0;function z(){W=0}function C(){return W}function V(E){W=E}function O(){const E=W;return E>=s.maxTextures&&ze("WebGLTextures: Trying to use "+(E+1)+" texture units while this GPU supports only "+s.maxTextures),W+=1,E}function I(E){const g=[];return g.push(E.wrapS),g.push(E.wrapT),g.push(E.wrapR||0),g.push(E.magFilter),g.push(E.minFilter),g.push(E.anisotropy),g.push(E.internalFormat),g.push(E.format),g.push(E.type),g.push(E.generateMipmaps),g.push(E.premultiplyAlpha),g.push(E.flipY),g.push(E.unpackAlignment),g.push(E.colorSpace),g.join()}function j(E,g){const B=n.get(E);if(E.isVideoTexture&&k(E),E.isRenderTargetTexture===!1&&E.isExternalTexture!==!0&&E.version>0&&B.__version!==E.version){const Y=E.image;if(Y===null)ze("WebGLRenderer: Texture marked for update but no image data found.");else if(Y.complete===!1)ze("WebGLRenderer: Texture marked for update but image is incomplete");else{le(B,E,g);return}}else E.isExternalTexture&&(B.__webglTexture=E.sourceTexture?E.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,B.__webglTexture,i.TEXTURE0+g)}function H(E,g){const B=n.get(E);if(E.isRenderTargetTexture===!1&&E.version>0&&B.__version!==E.version){le(B,E,g);return}else E.isExternalTexture&&(B.__webglTexture=E.sourceTexture?E.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,B.__webglTexture,i.TEXTURE0+g)}function X(E,g){const B=n.get(E);if(E.isRenderTargetTexture===!1&&E.version>0&&B.__version!==E.version){le(B,E,g);return}t.bindTexture(i.TEXTURE_3D,B.__webglTexture,i.TEXTURE0+g)}function J(E,g){const B=n.get(E);if(E.isCubeDepthTexture!==!0&&E.version>0&&B.__version!==E.version){Ee(B,E,g);return}t.bindTexture(i.TEXTURE_CUBE_MAP,B.__webglTexture,i.TEXTURE0+g)}const Se={[ds]:i.REPEAT,[In]:i.CLAMP_TO_EDGE,[Da]:i.MIRRORED_REPEAT},ve={[At]:i.NEAREST,[ad]:i.NEAREST_MIPMAP_NEAREST,[Ps]:i.NEAREST_MIPMAP_LINEAR,[Ut]:i.LINEAR,[Gr]:i.LINEAR_MIPMAP_NEAREST,[Kn]:i.LINEAR_MIPMAP_LINEAR},He={[ud]:i.NEVER,[md]:i.ALWAYS,[dd]:i.LESS,[Eo]:i.LEQUAL,[hd]:i.EQUAL,[Ao]:i.GEQUAL,[fd]:i.GREATER,[pd]:i.NOTEQUAL};function Ne(E,g){if(g.type===hn&&e.has("OES_texture_float_linear")===!1&&(g.magFilter===Ut||g.magFilter===Gr||g.magFilter===Ps||g.magFilter===Kn||g.minFilter===Ut||g.minFilter===Gr||g.minFilter===Ps||g.minFilter===Kn)&&ze("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(E,i.TEXTURE_WRAP_S,Se[g.wrapS]),i.texParameteri(E,i.TEXTURE_WRAP_T,Se[g.wrapT]),(E===i.TEXTURE_3D||E===i.TEXTURE_2D_ARRAY)&&i.texParameteri(E,i.TEXTURE_WRAP_R,Se[g.wrapR]),i.texParameteri(E,i.TEXTURE_MAG_FILTER,ve[g.magFilter]),i.texParameteri(E,i.TEXTURE_MIN_FILTER,ve[g.minFilter]),g.compareFunction&&(i.texParameteri(E,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(E,i.TEXTURE_COMPARE_FUNC,He[g.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(g.magFilter===At||g.minFilter!==Ps&&g.minFilter!==Kn||g.type===hn&&e.has("OES_texture_float_linear")===!1)return;if(g.anisotropy>1||n.get(g).__currentAnisotropy){const B=e.get("EXT_texture_filter_anisotropic");i.texParameterf(E,B.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(g.anisotropy,s.getMaxAnisotropy())),n.get(g).__currentAnisotropy=g.anisotropy}}}function Oe(E,g){let B=!1;E.__webglInit===void 0&&(E.__webglInit=!0,g.addEventListener("dispose",L));const Y=g.source;let ee=f.get(Y);ee===void 0&&(ee={},f.set(Y,ee));const ae=I(g);if(ae!==E.__cacheKey){ee[ae]===void 0&&(ee[ae]={texture:i.createTexture(),usedTimes:0},a.memory.textures++,B=!0),ee[ae].usedTimes++;const ce=ee[E.__cacheKey];ce!==void 0&&(ee[E.__cacheKey].usedTimes--,ce.usedTimes===0&&M(g)),E.__cacheKey=ae,E.__webglTexture=ee[ae].texture}return B}function $(E,g,B){return Math.floor(Math.floor(E/B)/g)}function ne(E,g,B,Y){const ae=E.updateRanges;if(ae.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,g.width,g.height,B,Y,g.data);else{ae.sort((Ae,ue)=>Ae.start-ue.start);let ce=0;for(let Ae=1;Ae<ae.length;Ae++){const ue=ae[ce],de=ae[Ae],Le=ue.start+ue.count,De=$(de.start,g.width,4),Be=$(ue.start,g.width,4);de.start<=Le+1&&De===Be&&$(de.start+de.count-1,g.width,4)===De?ue.count=Math.max(ue.count,de.start+de.count-ue.start):(++ce,ae[ce]=de)}ae.length=ce+1;const Q=t.getParameter(i.UNPACK_ROW_LENGTH),re=t.getParameter(i.UNPACK_SKIP_PIXELS),fe=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,g.width);for(let Ae=0,ue=ae.length;Ae<ue;Ae++){const de=ae[Ae],Le=Math.floor(de.start/4),De=Math.ceil(de.count/4),Be=Le%g.width,D=Math.floor(Le/g.width),ge=De,se=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Be),t.pixelStorei(i.UNPACK_SKIP_ROWS,D),t.texSubImage2D(i.TEXTURE_2D,0,Be,D,ge,se,B,Y,g.data)}E.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,Q),t.pixelStorei(i.UNPACK_SKIP_PIXELS,re),t.pixelStorei(i.UNPACK_SKIP_ROWS,fe)}}function le(E,g,B){let Y=i.TEXTURE_2D;(g.isDataArrayTexture||g.isCompressedArrayTexture)&&(Y=i.TEXTURE_2D_ARRAY),g.isData3DTexture&&(Y=i.TEXTURE_3D);const ee=Oe(E,g),ae=g.source;t.bindTexture(Y,E.__webglTexture,i.TEXTURE0+B);const ce=n.get(ae);if(ae.version!==ce.__version||ee===!0){if(t.activeTexture(i.TEXTURE0+B),(typeof ImageBitmap<"u"&&g.image instanceof ImageBitmap)===!1){const se=et.getPrimaries(et.workingColorSpace),pe=g.colorSpace===Ln?null:et.getPrimaries(g.colorSpace),_e=g.colorSpace===Ln||se===pe?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,_e)}t.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment);let re=m(g.image,!1,s.maxTextureSize);re=wt(g,re);const fe=r.convert(g.format,g.colorSpace),Ae=r.convert(g.type);let ue=S(g.internalFormat,fe,Ae,g.normalized,g.colorSpace,g.isVideoTexture);Ne(Y,g);let de;const Le=g.mipmaps,De=g.isVideoTexture!==!0,Be=ce.__version===void 0||ee===!0,D=ae.dataReady,ge=A(g,re);if(g.isDepthTexture)ue=R(g.format===ii,g.type),Be&&(De?t.texStorage2D(i.TEXTURE_2D,1,ue,re.width,re.height):t.texImage2D(i.TEXTURE_2D,0,ue,re.width,re.height,0,fe,Ae,null));else if(g.isDataTexture)if(Le.length>0){De&&Be&&t.texStorage2D(i.TEXTURE_2D,ge,ue,Le[0].width,Le[0].height);for(let se=0,pe=Le.length;se<pe;se++)de=Le[se],De?D&&t.texSubImage2D(i.TEXTURE_2D,se,0,0,de.width,de.height,fe,Ae,de.data):t.texImage2D(i.TEXTURE_2D,se,ue,de.width,de.height,0,fe,Ae,de.data);g.generateMipmaps=!1}else De?(Be&&t.texStorage2D(i.TEXTURE_2D,ge,ue,re.width,re.height),D&&ne(g,re,fe,Ae)):t.texImage2D(i.TEXTURE_2D,0,ue,re.width,re.height,0,fe,Ae,re.data);else if(g.isCompressedTexture)if(g.isCompressedArrayTexture){De&&Be&&t.texStorage3D(i.TEXTURE_2D_ARRAY,ge,ue,Le[0].width,Le[0].height,re.depth);for(let se=0,pe=Le.length;se<pe;se++)if(de=Le[se],g.format!==nn)if(fe!==null)if(De){if(D)if(g.layerUpdates.size>0){const _e=gl(de.width,de.height,g.format,g.type);for(const te of g.layerUpdates){const Ce=de.data.subarray(te*_e/de.data.BYTES_PER_ELEMENT,(te+1)*_e/de.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,se,0,0,te,de.width,de.height,1,fe,Ce)}}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,se,0,0,0,de.width,de.height,re.depth,fe,de.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,se,ue,de.width,de.height,re.depth,0,de.data,0,0);else ze("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else De?D&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,se,0,0,0,de.width,de.height,re.depth,fe,Ae,de.data):t.texImage3D(i.TEXTURE_2D_ARRAY,se,ue,de.width,de.height,re.depth,0,fe,Ae,de.data);g.layerUpdates.size>0&&g.clearLayerUpdates()}else{De&&Be&&t.texStorage2D(i.TEXTURE_2D,ge,ue,Le[0].width,Le[0].height);for(let se=0,pe=Le.length;se<pe;se++)de=Le[se],g.format!==nn?fe!==null?De?D&&t.compressedTexSubImage2D(i.TEXTURE_2D,se,0,0,de.width,de.height,fe,de.data):t.compressedTexImage2D(i.TEXTURE_2D,se,ue,de.width,de.height,0,de.data):ze("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):De?D&&t.texSubImage2D(i.TEXTURE_2D,se,0,0,de.width,de.height,fe,Ae,de.data):t.texImage2D(i.TEXTURE_2D,se,ue,de.width,de.height,0,fe,Ae,de.data)}else if(g.isDataArrayTexture)if(De){if(Be&&t.texStorage3D(i.TEXTURE_2D_ARRAY,ge,ue,re.width,re.height,re.depth),D)if(g.layerUpdates.size>0){const se=gl(re.width,re.height,g.format,g.type);for(const pe of g.layerUpdates){const _e=re.data.subarray(pe*se/re.data.BYTES_PER_ELEMENT,(pe+1)*se/re.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,pe,re.width,re.height,1,fe,Ae,_e)}g.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,re.width,re.height,re.depth,fe,Ae,re.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,ue,re.width,re.height,re.depth,0,fe,Ae,re.data);else if(g.isData3DTexture)De?(Be&&t.texStorage3D(i.TEXTURE_3D,ge,ue,re.width,re.height,re.depth),D&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,re.width,re.height,re.depth,fe,Ae,re.data)):t.texImage3D(i.TEXTURE_3D,0,ue,re.width,re.height,re.depth,0,fe,Ae,re.data);else if(g.isFramebufferTexture){if(Be)if(De)t.texStorage2D(i.TEXTURE_2D,ge,ue,re.width,re.height);else{let se=re.width,pe=re.height;for(let _e=0;_e<ge;_e++)t.texImage2D(i.TEXTURE_2D,_e,ue,se,pe,0,fe,Ae,null),se>>=1,pe>>=1}}else if(g.isHTMLTexture){if("texElementImage2D"in i){const se=i.canvas;if(se.hasAttribute("layoutsubtree")||se.setAttribute("layoutsubtree","true"),re.parentNode!==se){se.appendChild(re),h.add(g),se.onpaint=pe=>{const _e=pe.changedElements;for(const te of h)_e.includes(te.image)&&(te.needsUpdate=!0)},se.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,re);else{const _e=i.RGBA,te=i.RGBA,Ce=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,_e,te,Ce,re)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Le.length>0){if(De&&Be){const se=at(Le[0]);t.texStorage2D(i.TEXTURE_2D,ge,ue,se.width,se.height)}for(let se=0,pe=Le.length;se<pe;se++)de=Le[se],De?D&&t.texSubImage2D(i.TEXTURE_2D,se,0,0,fe,Ae,de):t.texImage2D(i.TEXTURE_2D,se,ue,fe,Ae,de);g.generateMipmaps=!1}else if(De){if(Be){const se=at(re);t.texStorage2D(i.TEXTURE_2D,ge,ue,se.width,se.height)}D&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,fe,Ae,re)}else t.texImage2D(i.TEXTURE_2D,0,ue,fe,Ae,re);p(g)&&T(Y),ce.__version=ae.version,g.onUpdate&&g.onUpdate(g)}E.__version=g.version}function Ee(E,g,B){if(g.image.length!==6)return;const Y=Oe(E,g),ee=g.source;t.bindTexture(i.TEXTURE_CUBE_MAP,E.__webglTexture,i.TEXTURE0+B);const ae=n.get(ee);if(ee.version!==ae.__version||Y===!0){t.activeTexture(i.TEXTURE0+B);const ce=et.getPrimaries(et.workingColorSpace),Q=g.colorSpace===Ln?null:et.getPrimaries(g.colorSpace),re=g.colorSpace===Ln||ce===Q?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,g.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,g.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,g.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,re);const fe=g.isCompressedTexture||g.image[0].isCompressedTexture,Ae=g.image[0]&&g.image[0].isDataTexture,ue=[];for(let te=0;te<6;te++)!fe&&!Ae?ue[te]=m(g.image[te],!0,s.maxCubemapSize):ue[te]=Ae?g.image[te].image:g.image[te],ue[te]=wt(g,ue[te]);const de=ue[0],Le=r.convert(g.format,g.colorSpace),De=r.convert(g.type),Be=S(g.internalFormat,Le,De,g.normalized,g.colorSpace),D=g.isVideoTexture!==!0,ge=ae.__version===void 0||Y===!0,se=ee.dataReady;let pe=A(g,de);Ne(i.TEXTURE_CUBE_MAP,g);let _e;if(fe){D&&ge&&t.texStorage2D(i.TEXTURE_CUBE_MAP,pe,Be,de.width,de.height);for(let te=0;te<6;te++){_e=ue[te].mipmaps;for(let Ce=0;Ce<_e.length;Ce++){const Pe=_e[Ce];g.format!==nn?Le!==null?D?se&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,0,0,Pe.width,Pe.height,Le,Pe.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,Be,Pe.width,Pe.height,0,Pe.data):ze("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,0,0,Pe.width,Pe.height,Le,De,Pe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce,Be,Pe.width,Pe.height,0,Le,De,Pe.data)}}}else{if(_e=g.mipmaps,D&&ge){_e.length>0&&pe++;const te=at(ue[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,pe,Be,te.width,te.height)}for(let te=0;te<6;te++)if(Ae){D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,ue[te].width,ue[te].height,Le,De,ue[te].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,Be,ue[te].width,ue[te].height,0,Le,De,ue[te].data);for(let Ce=0;Ce<_e.length;Ce++){const it=_e[Ce].image[te].image;D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,0,0,it.width,it.height,Le,De,it.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,Be,it.width,it.height,0,Le,De,it.data)}}else{D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,0,0,Le,De,ue[te]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,0,Be,Le,De,ue[te]);for(let Ce=0;Ce<_e.length;Ce++){const Pe=_e[Ce];D?se&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,0,0,Le,De,Pe.image[te]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+te,Ce+1,Be,Le,De,Pe.image[te])}}}p(g)&&T(i.TEXTURE_CUBE_MAP),ae.__version=ee.version,g.onUpdate&&g.onUpdate(g)}E.__version=g.version}function he(E,g,B,Y,ee,ae){const ce=r.convert(B.format,B.colorSpace),Q=r.convert(B.type),re=S(B.internalFormat,ce,Q,B.normalized,B.colorSpace),fe=n.get(g),Ae=n.get(B);if(Ae.__renderTarget=g,!fe.__hasExternalTextures){const ue=Math.max(1,g.width>>ae),de=Math.max(1,g.height>>ae);ee===i.TEXTURE_3D||ee===i.TEXTURE_2D_ARRAY?t.texImage3D(ee,ae,re,ue,de,g.depth,0,ce,Q,null):t.texImage2D(ee,ae,re,ue,de,0,ce,Q,null)}t.bindFramebuffer(i.FRAMEBUFFER,E),St(g)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Y,ee,Ae.__webglTexture,0,mt(g)):(ee===i.TEXTURE_2D||ee>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&ee<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,Y,ee,Ae.__webglTexture,ae),t.bindFramebuffer(i.FRAMEBUFFER,null)}function Fe(E,g,B){if(i.bindRenderbuffer(i.RENDERBUFFER,E),g.depthBuffer){const Y=g.depthTexture,ee=Y&&Y.isDepthTexture?Y.type:null,ae=R(g.stencilBuffer,ee),ce=g.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;St(g)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,mt(g),ae,g.width,g.height):B?i.renderbufferStorageMultisample(i.RENDERBUFFER,mt(g),ae,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,ae,g.width,g.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,ce,i.RENDERBUFFER,E)}else{const Y=g.textures;for(let ee=0;ee<Y.length;ee++){const ae=Y[ee],ce=r.convert(ae.format,ae.colorSpace),Q=r.convert(ae.type),re=S(ae.internalFormat,ce,Q,ae.normalized,ae.colorSpace);St(g)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,mt(g),re,g.width,g.height):B?i.renderbufferStorageMultisample(i.RENDERBUFFER,mt(g),re,g.width,g.height):i.renderbufferStorage(i.RENDERBUFFER,re,g.width,g.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function ft(E,g,B){const Y=g.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,E),!(g.depthTexture&&g.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const ee=n.get(g.depthTexture);if(ee.__renderTarget=g,(!ee.__webglTexture||g.depthTexture.image.width!==g.width||g.depthTexture.image.height!==g.height)&&(g.depthTexture.image.width=g.width,g.depthTexture.image.height=g.height,g.depthTexture.needsUpdate=!0),Y){if(ee.__webglInit===void 0&&(ee.__webglInit=!0,g.depthTexture.addEventListener("dispose",L)),ee.__webglTexture===void 0){ee.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,ee.__webglTexture),Ne(i.TEXTURE_CUBE_MAP,g.depthTexture);const fe=r.convert(g.depthTexture.format),Ae=r.convert(g.depthTexture.type);let ue;g.depthTexture.format===Nn?ue=i.DEPTH_COMPONENT24:g.depthTexture.format===ii&&(ue=i.DEPTH24_STENCIL8);for(let de=0;de<6;de++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+de,0,ue,g.width,g.height,0,fe,Ae,null)}}else j(g.depthTexture,0);const ae=ee.__webglTexture,ce=mt(g),Q=Y?i.TEXTURE_CUBE_MAP_POSITIVE_X+B:i.TEXTURE_2D,re=g.depthTexture.format===ii?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(g.depthTexture.format===Nn)St(g)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,re,Q,ae,0,ce):i.framebufferTexture2D(i.FRAMEBUFFER,re,Q,ae,0);else if(g.depthTexture.format===ii)St(g)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,re,Q,ae,0,ce):i.framebufferTexture2D(i.FRAMEBUFFER,re,Q,ae,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Ue(E){const g=n.get(E),B=E.isWebGLCubeRenderTarget===!0;if(g.__boundDepthTexture!==E.depthTexture){const Y=E.depthTexture;if(g.__depthDisposeCallback&&g.__depthDisposeCallback(),Y){const ee=()=>{delete g.__boundDepthTexture,delete g.__depthDisposeCallback,Y.removeEventListener("dispose",ee)};Y.addEventListener("dispose",ee),g.__depthDisposeCallback=ee}g.__boundDepthTexture=Y}if(E.depthTexture&&!g.__autoAllocateDepthBuffer)if(B)for(let Y=0;Y<6;Y++)ft(g.__webglFramebuffer[Y],E,Y);else{const Y=E.texture.mipmaps;Y&&Y.length>0?ft(g.__webglFramebuffer[0],E,0):ft(g.__webglFramebuffer,E,0)}else if(B){g.__webglDepthbuffer=[];for(let Y=0;Y<6;Y++)if(t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[Y]),g.__webglDepthbuffer[Y]===void 0)g.__webglDepthbuffer[Y]=i.createRenderbuffer(),Fe(g.__webglDepthbuffer[Y],E,!1);else{const ee=E.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ae=g.__webglDepthbuffer[Y];i.bindRenderbuffer(i.RENDERBUFFER,ae),i.framebufferRenderbuffer(i.FRAMEBUFFER,ee,i.RENDERBUFFER,ae)}}else{const Y=E.texture.mipmaps;if(Y&&Y.length>0?t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,g.__webglFramebuffer),g.__webglDepthbuffer===void 0)g.__webglDepthbuffer=i.createRenderbuffer(),Fe(g.__webglDepthbuffer,E,!1);else{const ee=E.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ae=g.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ae),i.framebufferRenderbuffer(i.FRAMEBUFFER,ee,i.RENDERBUFFER,ae)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function Ve(E,g,B){const Y=n.get(E);g!==void 0&&he(Y.__webglFramebuffer,E,E.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),B!==void 0&&Ue(E)}function nt(E){const g=E.texture,B=n.get(E),Y=n.get(g);E.addEventListener("dispose",y);const ee=E.textures,ae=E.isWebGLCubeRenderTarget===!0,ce=ee.length>1;if(ce||(Y.__webglTexture===void 0&&(Y.__webglTexture=i.createTexture()),Y.__version=g.version,a.memory.textures++),ae){B.__webglFramebuffer=[];for(let Q=0;Q<6;Q++)if(g.mipmaps&&g.mipmaps.length>0){B.__webglFramebuffer[Q]=[];for(let re=0;re<g.mipmaps.length;re++)B.__webglFramebuffer[Q][re]=i.createFramebuffer()}else B.__webglFramebuffer[Q]=i.createFramebuffer()}else{if(g.mipmaps&&g.mipmaps.length>0){B.__webglFramebuffer=[];for(let Q=0;Q<g.mipmaps.length;Q++)B.__webglFramebuffer[Q]=i.createFramebuffer()}else B.__webglFramebuffer=i.createFramebuffer();if(ce)for(let Q=0,re=ee.length;Q<re;Q++){const fe=n.get(ee[Q]);fe.__webglTexture===void 0&&(fe.__webglTexture=i.createTexture(),a.memory.textures++)}if(E.samples>0&&St(E)===!1){B.__webglMultisampledFramebuffer=i.createFramebuffer(),B.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,B.__webglMultisampledFramebuffer);for(let Q=0;Q<ee.length;Q++){const re=ee[Q];B.__webglColorRenderbuffer[Q]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,B.__webglColorRenderbuffer[Q]);const fe=r.convert(re.format,re.colorSpace),Ae=r.convert(re.type),ue=S(re.internalFormat,fe,Ae,re.normalized,re.colorSpace,E.isXRRenderTarget===!0),de=mt(E);i.renderbufferStorageMultisample(i.RENDERBUFFER,de,ue,E.width,E.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Q,i.RENDERBUFFER,B.__webglColorRenderbuffer[Q])}i.bindRenderbuffer(i.RENDERBUFFER,null),E.depthBuffer&&(B.__webglDepthRenderbuffer=i.createRenderbuffer(),Fe(B.__webglDepthRenderbuffer,E,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ae){t.bindTexture(i.TEXTURE_CUBE_MAP,Y.__webglTexture),Ne(i.TEXTURE_CUBE_MAP,g);for(let Q=0;Q<6;Q++)if(g.mipmaps&&g.mipmaps.length>0)for(let re=0;re<g.mipmaps.length;re++)he(B.__webglFramebuffer[Q][re],E,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,re);else he(B.__webglFramebuffer[Q],E,g,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+Q,0);p(g)&&T(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(ce){for(let Q=0,re=ee.length;Q<re;Q++){const fe=ee[Q],Ae=n.get(fe);let ue=i.TEXTURE_2D;(E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(ue=E.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ue,Ae.__webglTexture),Ne(ue,fe),he(B.__webglFramebuffer,E,fe,i.COLOR_ATTACHMENT0+Q,ue,0),p(fe)&&T(ue)}t.unbindTexture()}else{let Q=i.TEXTURE_2D;if((E.isWebGL3DRenderTarget||E.isWebGLArrayRenderTarget)&&(Q=E.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(Q,Y.__webglTexture),Ne(Q,g),g.mipmaps&&g.mipmaps.length>0)for(let re=0;re<g.mipmaps.length;re++)he(B.__webglFramebuffer[re],E,g,i.COLOR_ATTACHMENT0,Q,re);else he(B.__webglFramebuffer,E,g,i.COLOR_ATTACHMENT0,Q,0);p(g)&&T(Q),t.unbindTexture()}E.depthBuffer&&Ue(E)}function Ke(E){const g=E.textures;for(let B=0,Y=g.length;B<Y;B++){const ee=g[B];if(p(ee)){const ae=P(E),ce=n.get(ee).__webglTexture;t.bindTexture(ae,ce),T(ae),t.unbindTexture()}}}const yt=[],bt=[];function Dt(E){if(E.samples>0){if(St(E)===!1){const g=E.textures,B=E.width,Y=E.height;let ee=i.COLOR_BUFFER_BIT;const ae=E.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ce=n.get(E),Q=g.length>1;if(Q)for(let fe=0;fe<g.length;fe++)t.bindFramebuffer(i.FRAMEBUFFER,ce.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+fe,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,ce.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+fe,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,ce.__webglMultisampledFramebuffer);const re=E.texture.mipmaps;re&&re.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ce.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ce.__webglFramebuffer);for(let fe=0;fe<g.length;fe++){if(E.resolveDepthBuffer&&(E.depthBuffer&&(ee|=i.DEPTH_BUFFER_BIT),E.stencilBuffer&&E.resolveStencilBuffer&&(ee|=i.STENCIL_BUFFER_BIT)),Q){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,ce.__webglColorRenderbuffer[fe]);const Ae=n.get(g[fe]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Ae,0)}i.blitFramebuffer(0,0,B,Y,0,0,B,Y,ee,i.NEAREST),l===!0&&(yt.length=0,bt.length=0,yt.push(i.COLOR_ATTACHMENT0+fe),E.depthBuffer&&E.storeMultisampledDepthBuffer===!1&&(yt.push(ae),bt.push(ae),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,bt)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,yt))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),Q)for(let fe=0;fe<g.length;fe++){t.bindFramebuffer(i.FRAMEBUFFER,ce.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+fe,i.RENDERBUFFER,ce.__webglColorRenderbuffer[fe]);const Ae=n.get(g[fe]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,ce.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+fe,i.TEXTURE_2D,Ae,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,ce.__webglMultisampledFramebuffer)}else if(E.depthBuffer&&E.storeMultisampledDepthBuffer===!1&&l){const g=E.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[g])}}}function mt(E){return Math.min(s.maxSamples,E.samples)}function St(E){const g=n.get(E);return E.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&g.__useRenderToTexture!==!1}function k(E){const g=a.render.frame;u.get(E)!==g&&(u.set(E,g),E.update())}function wt(E,g){const B=E.colorSpace,Y=E.format,ee=E.type;return E.isCompressedTexture===!0||E.isVideoTexture===!0||B!==ps&&B!==Ln&&(et.getTransfer(B)===_t?(Y!==nn||ee!==en)&&ze("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):dt("WebGLTextures: Unsupported texture color space:",B)),g}function at(E){return typeof HTMLImageElement<"u"&&E instanceof HTMLImageElement?(c.width=E.naturalWidth||E.width,c.height=E.naturalHeight||E.height):typeof VideoFrame<"u"&&E instanceof VideoFrame?(c.width=E.displayWidth,c.height=E.displayHeight):(c.width=E.width,c.height=E.height),c}this.allocateTextureUnit=O,this.resetTextureUnits=z,this.getTextureUnits=C,this.setTextureUnits=V,this.setTexture2D=j,this.setTexture2DArray=H,this.setTexture3D=X,this.setTextureCube=J,this.rebindTextures=Ve,this.setupRenderTarget=nt,this.updateRenderTargetMipmap=Ke,this.updateMultisampleRenderTarget=Dt,this.setupDepthRenderbuffer=Ue,this.setupFrameBufferTexture=he,this.useMultisampledRTT=St,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function Hg(i,e){function t(n,s=Ln){let r;const a=et.getTransfer(s);if(n===en)return i.UNSIGNED_BYTE;if(n===vo)return i.UNSIGNED_SHORT_4_4_4_4;if(n===bo)return i.UNSIGNED_SHORT_5_5_5_1;if(n===hc)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===fc)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===uc)return i.BYTE;if(n===dc)return i.SHORT;if(n===hs)return i.UNSIGNED_SHORT;if(n===Lr)return i.INT;if(n===Mn)return i.UNSIGNED_INT;if(n===hn)return i.FLOAT;if(n===wn)return i.HALF_FLOAT;if(n===pc)return i.ALPHA;if(n===mc)return i.RGB;if(n===nn)return i.RGBA;if(n===Nn)return i.DEPTH_COMPONENT;if(n===ii)return i.DEPTH_STENCIL;if(n===So)return i.RED;if(n===Mo)return i.RED_INTEGER;if(n===ai)return i.RG;if(n===wo)return i.RG_INTEGER;if(n===To)return i.RGBA_INTEGER;if(n===hr||n===fr||n===pr||n===mr)if(a===_t)if(r=e.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===hr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===fr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===pr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===mr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=e.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===hr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===fr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===pr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===mr)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ua||n===ka||n===Na||n===Fa)if(r=e.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===Ua)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===ka)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Na)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Fa)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Oa||n===Ba||n===za||n===Ga||n===Va||n===xr||n===Ha)if(r=e.get("WEBGL_compressed_texture_etc"),r!==null){if(n===Oa||n===Ba)return a===_t?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===za)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC;if(n===Ga)return r.COMPRESSED_R11_EAC;if(n===Va)return r.COMPRESSED_SIGNED_R11_EAC;if(n===xr)return r.COMPRESSED_RG11_EAC;if(n===Ha)return r.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Wa||n===Xa||n===qa||n===Ka||n===Ya||n===$a||n===Za||n===Ja||n===Qa||n===ja||n===eo||n===to||n===no||n===io)if(r=e.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Wa)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Xa)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===qa)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Ka)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Ya)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===$a)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Za)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Ja)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Qa)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===ja)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===eo)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===to)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===no)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===io)return a===_t?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===so||n===ro||n===ao)if(r=e.get("EXT_texture_compression_bptc"),r!==null){if(n===so)return a===_t?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===ro)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===ao)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===oo||n===lo||n===vr||n===co)if(r=e.get("EXT_texture_compression_rgtc"),r!==null){if(n===oo)return r.COMPRESSED_RED_RGTC1_EXT;if(n===lo)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===vr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===co)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===fs?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const Wg=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Xg=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class qg{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new Ec(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new Tn({vertexShader:Wg,fragmentShader:Xg,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new kt(new Oi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Kg extends ci{constructor(e,t){super();const n=this;let s=null,r=1,a=null,o="local-floor",l=1,c=null,u=null,h=null,d=null,f=null,_=null;const b=typeof XRWebGLBinding<"u",m=new qg,p={},T=t.getContextAttributes();let P=null,S=null;const R=[],A=[],L=new ct;let y=null,w=null;const M=new Jt;M.viewport=new Mt;const N=new Jt;N.viewport=new Mt;const W=[M,N],z=new eh;let C=null,V=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let ne=R[$];return ne===void 0&&(ne=new $r,R[$]=ne),ne.getTargetRaySpace()},this.getControllerGrip=function($){let ne=R[$];return ne===void 0&&(ne=new $r,R[$]=ne),ne.getGripSpace()},this.getHand=function($){let ne=R[$];return ne===void 0&&(ne=new $r,R[$]=ne),ne.getHandSpace()};function O($){const ne=A.indexOf($.inputSource);if(ne===-1)return;const le=R[ne];le!==void 0&&(le.update($.inputSource,$.frame,c||a),le.dispatchEvent({type:$.type,data:$.inputSource}))}function I(){s.removeEventListener("select",O),s.removeEventListener("selectstart",O),s.removeEventListener("selectend",O),s.removeEventListener("squeeze",O),s.removeEventListener("squeezestart",O),s.removeEventListener("squeezeend",O),s.removeEventListener("end",I),s.removeEventListener("inputsourceschange",j);for(let $=0;$<R.length;$++){const ne=A[$];ne!==null&&(A[$]=null,R[$].disconnect(ne))}C=null,V=null,m.reset();for(const $ in p)delete p[$];if(e.setRenderTarget(P),f=null,d=null,h=null,s=null,S=null,Oe.stop(),n.isPresenting=!1,e.setPixelRatio(y),e.setSize(L.width,L.height,!1),w!==null){const $=w.camera;$.fov=w.fov,$.zoom=w.zoom,$.updateProjectionMatrix(),w=null}n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){r=$,n.isPresenting===!0&&ze("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){o=$,n.isPresenting===!0&&ze("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return h===null&&b&&(h=new XRWebGLBinding(s,t)),h},this.getFrame=function(){return _},this.getSession=function(){return s},this.setSession=async function($){if(s=$,s!==null){if(P=e.getRenderTarget(),s.addEventListener("select",O),s.addEventListener("selectstart",O),s.addEventListener("selectend",O),s.addEventListener("squeeze",O),s.addEventListener("squeezestart",O),s.addEventListener("squeezeend",O),s.addEventListener("end",I),s.addEventListener("inputsourceschange",j),T.xrCompatible!==!0&&await t.makeXRCompatible(),y=e.getPixelRatio(),e.getSize(L),b&&"createProjectionLayer"in XRWebGLBinding.prototype){let le=null,Ee=null,he=null;T.depth&&(he=T.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,le=T.stencil?ii:Nn,Ee=T.stencil?fs:Mn);const Fe={colorFormat:t.RGBA8,depthFormat:he,scaleFactor:r};h=this.getBinding(),d=h.createProjectionLayer(Fe),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),S=new rn(d.textureWidth,d.textureHeight,{format:nn,type:en,depthTexture:new gs(d.textureWidth,d.textureHeight,Ee,void 0,void 0,void 0,void 0,void 0,void 0,le),stencilBuffer:T.stencil,colorSpace:e.outputColorSpace,samples:T.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1,storeMultisampledDepthBuffer:d.ignoreDepthValues===!1,storeMultisampledStencilBuffer:d.ignoreDepthValues===!1})}else{const le={antialias:T.antialias,alpha:!0,depth:T.depth,stencil:T.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,t,le),s.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),S=new rn(f.framebufferWidth,f.framebufferHeight,{format:nn,type:en,colorSpace:e.outputColorSpace,stencilBuffer:T.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1,storeMultisampledDepthBuffer:f.ignoreDepthValues===!1,storeMultisampledStencilBuffer:f.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await s.requestReferenceSpace(o),Oe.setContext(s),Oe.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function j($){for(let ne=0;ne<$.removed.length;ne++){const le=$.removed[ne],Ee=A.indexOf(le);Ee>=0&&(A[Ee]=null,R[Ee].disconnect(le))}for(let ne=0;ne<$.added.length;ne++){const le=$.added[ne];let Ee=A.indexOf(le);if(Ee===-1){for(let Fe=0;Fe<R.length;Fe++)if(Fe>=A.length){A.push(le),Ee=Fe;break}else if(A[Fe]===null){A[Fe]=le,Ee=Fe;break}if(Ee===-1)break}const he=R[Ee];he&&he.connect(le)}}const H=new G,X=new G;function J($,ne,le){H.setFromMatrixPosition(ne.matrixWorld),X.setFromMatrixPosition(le.matrixWorld);const Ee=H.distanceTo(X),he=ne.projectionMatrix.elements,Fe=le.projectionMatrix.elements,ft=he[14]/(he[10]-1),Ue=he[14]/(he[10]+1),Ve=(he[9]+1)/he[5],nt=(he[9]-1)/he[5],Ke=(he[8]-1)/he[0],yt=(Fe[8]+1)/Fe[0],bt=ft*Ke,Dt=ft*yt,mt=Ee/(-Ke+yt),St=mt*-Ke;if(ne.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(St),$.translateZ(mt),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),he[10]===-1)$.projectionMatrix.copy(ne.projectionMatrix),$.projectionMatrixInverse.copy(ne.projectionMatrixInverse);else{const k=ft+mt,wt=Ue+mt,at=bt-St,E=Dt+(Ee-St),g=Ve*Ue/wt*k,B=nt*Ue/wt*k;$.projectionMatrix.makePerspective(at,E,g,B,k,wt),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function Se($,ne){ne===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(ne.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(s===null)return;let ne=$.near,le=$.far;m.texture!==null&&(m.depthNear>0&&(ne=m.depthNear),m.depthFar>0&&(le=m.depthFar)),z.near=N.near=M.near=ne,z.far=N.far=M.far=le,(C!==z.near||V!==z.far)&&(s.updateRenderState({depthNear:z.near,depthFar:z.far}),C=z.near,V=z.far),z.layers.mask=$.layers.mask|6,M.layers.mask=z.layers.mask&-5,N.layers.mask=z.layers.mask&-3;const Ee=$.parent,he=z.cameras;Se(z,Ee);for(let Fe=0;Fe<he.length;Fe++)Se(he[Fe],Ee);he.length===2?J(z,M,N):z.projectionMatrix.copy(M.projectionMatrix),w===null&&$.isPerspectiveCamera&&(w={camera:$,fov:$.fov,zoom:$.zoom}),ve($,z,Ee)};function ve($,ne,le){le===null?$.matrix.copy(ne.matrixWorld):($.matrix.copy(le.matrixWorld),$.matrix.invert(),$.matrix.multiply(ne.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(ne.projectionMatrix),$.projectionMatrixInverse.copy(ne.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=uo*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return z},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function($){l=$,d!==null&&(d.fixedFoveation=$),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=$)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(z)},this.getCameraTexture=function($){return p[$]};let He=null;function Ne($,ne){if(u=ne.getViewerPose(c||a),_=ne,u!==null){const le=u.views;f!==null&&(e.setRenderTargetFramebuffer(S,f.framebuffer),e.setRenderTarget(S));let Ee=!1;le.length!==z.cameras.length&&(z.cameras.length=0,Ee=!0);for(let Ue=0;Ue<le.length;Ue++){const Ve=le[Ue];let nt=null;if(f!==null)nt=f.getViewport(Ve);else{const yt=h.getViewSubImage(d,Ve);nt=yt.viewport,Ue===0&&(e.setRenderTargetTextures(S,yt.colorTexture,yt.depthStencilTexture),e.setRenderTarget(S))}let Ke=W[Ue];Ke===void 0&&(Ke=new Jt,Ke.layers.enable(Ue),Ke.viewport=new Mt,W[Ue]=Ke),Ke.matrix.fromArray(Ve.transform.matrix),Ke.matrix.decompose(Ke.position,Ke.quaternion,Ke.scale),Ke.projectionMatrix.fromArray(Ve.projectionMatrix),Ke.projectionMatrixInverse.copy(Ke.projectionMatrix).invert(),Ke.viewport.set(nt.x,nt.y,nt.width,nt.height),Ue===0&&(z.matrix.copy(Ke.matrix),z.matrix.decompose(z.position,z.quaternion,z.scale)),Ee===!0&&z.cameras.push(Ke)}const he=s.enabledFeatures;if(he&&he.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&b){h=n.getBinding();const Ue=h.getDepthInformation(le[0]);Ue&&Ue.isValid&&Ue.texture&&m.init(Ue,s.renderState)}if(he&&he.includes("camera-access")&&b){e.state.unbindTexture(),h=n.getBinding();for(let Ue=0;Ue<le.length;Ue++){const Ve=le[Ue].camera;if(Ve){let nt=p[Ve];nt||(nt=new Ec,p[Ve]=nt);const Ke=h.getCameraImage(Ve);nt.sourceTexture=Ke}}}}for(let le=0;le<R.length;le++){const Ee=A[le],he=R[le];Ee!==null&&he!==void 0&&he.update(Ee,ne,c||a)}He&&He($,ne),ne.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ne}),_=null}const Oe=new Lc;Oe.setAnimationLoop(Ne),this.setAnimationLoop=function($){He=$},this.dispose=function(){}}}const Yg=new Je,Oc=new We;Oc.set(-1,0,0,0,1,0,0,0,1);function $g(i,e){function t(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Ac(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,T,P,S){p.isNodeMaterial?p.uniformsNeedUpdate=!1:p.isMeshBasicMaterial?r(m,p):p.isMeshLambertMaterial?(r(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshToonMaterial?(r(m,p),h(m,p)):p.isMeshPhongMaterial?(r(m,p),u(m,p),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)):p.isMeshStandardMaterial?(r(m,p),d(m,p),p.isMeshPhysicalMaterial&&f(m,p,S)):p.isMeshMatcapMaterial?(r(m,p),_(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),b(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,T,P):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,t(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===qt&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,t(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===qt&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,t(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,t(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,t(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const T=e.get(p),P=T.envMap,S=T.envMapRotation;P&&(m.envMap.value=P,m.envMapRotation.value.setFromMatrix4(Yg.makeRotationFromEuler(S)).transpose(),P.isCubeTexture&&P.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(Oc),m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,t(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,t(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,T,P){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*T,m.scale.value=P*.5,p.map&&(m.map.value=p.map,t(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,t(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,t(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function u(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function h(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function d(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,t(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,t(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,T){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,t(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,t(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,t(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,t(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,t(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===qt&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.retroreflectivity>0&&(m.retroreflectivity.value=p.retroreflectivity),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,t(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,t(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=T.texture,m.transmissionSamplerSize.value.set(T.width,T.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,t(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,t(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,t(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,t(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,t(p.specularIntensityMap,m.specularIntensityMapTransform))}function _(m,p){p.matcap&&(m.matcap.value=p.matcap)}function b(m,p){const T=e.get(p).light;m.referencePosition.value.setFromMatrixPosition(T.matrixWorld),m.nearDistance.value=T.shadow.camera.near,m.farDistance.value=T.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Zg(i,e,t,n){let s={},r={},a=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(S,R){const A=R.program;n.uniformBlockBinding(S,A)}function c(S,R){let A=s[S.id];A===void 0&&(m(S),A=u(S),s[S.id]=A,S.addEventListener("dispose",T));const L=R.program;n.updateUBOMapping(S,L);const y=e.render.frame;r[S.id]!==y&&(d(S),r[S.id]=y)}function u(S){const R=h();S.__bindingPointIndex=R;const A=i.createBuffer(),L=S.__size,y=S.usage;return i.bindBuffer(i.UNIFORM_BUFFER,A),i.bufferData(i.UNIFORM_BUFFER,L,y),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,R,A),A}function h(){for(let S=0;S<o;S++)if(a.indexOf(S)===-1)return a.push(S),S;return dt("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(S){const R=s[S.id],A=S.uniforms,L=S.__cache;i.bindBuffer(i.UNIFORM_BUFFER,R);for(let y=0,w=A.length;y<w;y++){const M=A[y];if(Array.isArray(M))for(let N=0,W=M.length;N<W;N++)f(M[N],y,N,L);else f(M,y,0,L)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(S,R,A,L){if(b(S,R,A,L)===!0){const y=S.__offset,w=S.value;if(Array.isArray(w)){let M=0;for(let N=0;N<w.length;N++){const W=w[N],z=p(W);_(W,S.__data,M),typeof W!="number"&&typeof W!="boolean"&&!W.isMatrix3&&!ArrayBuffer.isView(W)&&(M+=z.storage/Float32Array.BYTES_PER_ELEMENT)}}else _(w,S.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,y,S.__data)}}function _(S,R,A){typeof S=="number"||typeof S=="boolean"?R[0]=S:S.isMatrix3?(R[0]=S.elements[0],R[1]=S.elements[1],R[2]=S.elements[2],R[3]=0,R[4]=S.elements[3],R[5]=S.elements[4],R[6]=S.elements[5],R[7]=0,R[8]=S.elements[6],R[9]=S.elements[7],R[10]=S.elements[8],R[11]=0):ArrayBuffer.isView(S)?R.set(new S.constructor(S.buffer,S.byteOffset,R.length)):S.toArray(R,A)}function b(S,R,A,L){const y=S.value,w=R+"_"+A;if(L[w]===void 0)return typeof y=="number"||typeof y=="boolean"?L[w]=y:ArrayBuffer.isView(y)?L[w]=y.slice():L[w]=y.clone(),!0;{const M=L[w];if(typeof y=="number"||typeof y=="boolean"){if(M!==y)return L[w]=y,!0}else{if(ArrayBuffer.isView(y))return!0;if(M.equals(y)===!1)return M.copy(y),!0}}return!1}function m(S){const R=S.uniforms;let A=0;const L=16;for(let w=0,M=R.length;w<M;w++){const N=Array.isArray(R[w])?R[w]:[R[w]];for(let W=0,z=N.length;W<z;W++){const C=N[W],V=Array.isArray(C.value)?C.value:[C.value];for(let O=0,I=V.length;O<I;O++){const j=V[O],H=p(j),X=A%L,J=X%H.boundary,Se=X+J;A+=J,Se!==0&&L-Se<H.storage&&(A+=L-Se),C.__data=new Float32Array(H.storage/Float32Array.BYTES_PER_ELEMENT),C.__offset=A,A+=H.storage}}}const y=A%L;return y>0&&(A+=L-y),S.__size=A,S.__cache={},this}function p(S){const R={boundary:0,storage:0};return typeof S=="number"||typeof S=="boolean"?(R.boundary=4,R.storage=4):S.isVector2?(R.boundary=8,R.storage=8):S.isVector3||S.isColor?(R.boundary=16,R.storage=12):S.isVector4?(R.boundary=16,R.storage=16):S.isMatrix3?(R.boundary=48,R.storage=48):S.isMatrix4?(R.boundary=64,R.storage=64):S.isTexture?ze("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(S)?(R.boundary=16,R.storage=S.byteLength):ze("WebGLRenderer: Unsupported uniform value type.",S),R}function T(S){const R=S.target;R.removeEventListener("dispose",T);const A=a.indexOf(R.__bindingPointIndex);a.splice(A,1),i.deleteBuffer(s[R.id]),delete s[R.id],delete r[R.id]}function P(){for(const S in s)i.deleteBuffer(s[S]);a=[],s={},r={}}return{bind:l,update:c,dispose:P}}const Jg=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let xn=null;function Qg(){return xn===null&&(xn=new Di(Jg,16,16,ai,wn),xn.name="DFG_LUT",xn.minFilter=Ut,xn.magFilter=Ut,xn.wrapS=In,xn.wrapT=In,xn.generateMipmaps=!1,xn.needsUpdate=!0),xn}class jg{constructor(e={}){const{canvas:t=yd(),context:n=null,depth:s=!0,stencil:r=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:u="default",failIfMajorPerformanceCaveat:h=!1,reversedDepthBuffer:d=!1,outputBufferType:f=en}=e;this.isWebGLRenderer=!0;let _;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");_=n.getContextAttributes().alpha}else _=a;const b=f,m=new Set([To,wo,Mo]),p=new Set([en,Mn,hs,fs,vo,bo]),T=new Uint32Array(4),P=new Int32Array(4),S=new G;let R=null,A=null;const L=[],y=[];let w=null;this.domElement=t,this.debug={checkShaderErrors:!0,diagnostics:{keywords:!1},onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Sn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const M=this;let N=!1,W=null,z=null,C=null,V=null;this._outputColorSpace=Gt;let O=0,I=0,j=null,H=-1,X=null;const J=new Mt,Se=new Mt;let ve=null;const He=new Qe(0);let Ne=0,Oe=t.width,$=t.height,ne=1,le=null,Ee=null;const he=new Mt(0,0,Oe,$),Fe=new Mt(0,0,Oe,$);let ft=!1;const Ue=new Sc;let Ve=!1,nt=!1;const Ke=new Je,yt=new G,bt=new Mt,Dt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let mt=!1;function St(){return j===null?ne:1}let k=n;function wt(x,U){return t.getContext(x,U)}let at,E,g,B,Y,ee,ae,ce,Q,re,fe,Ae,ue,de,Le,De,Be,D,ge,se,pe,_e,te;try{const x={alpha:!0,depth:s,stencil:r,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:u,failIfMajorPerformanceCaveat:h};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${xo}`),t.addEventListener("webglcontextlost",it,!1),t.addEventListener("webglcontextrestored",Ye,!1),t.addEventListener("webglcontextcreationerror",ke,!1),k===null){const U="webgl2";if(k=wt(U,x),k===null)throw wt(U)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}Ce()}catch(x){throw t.removeEventListener("webglcontextlost",it,!1),t.removeEventListener("webglcontextrestored",Ye,!1),t.removeEventListener("webglcontextcreationerror",ke,!1),dt("WebGLRenderer: "+x.message),x}function Ce(){at=new Qp(k),at.init(),pe=new Hg(k,at),E=new Vp(k,at,e,pe),g=new Gg(k,at),E.reversedDepthBuffer&&d&&g.buffers.depth.setReversed(!0),z=k.createFramebuffer(),C=k.createFramebuffer(),V=k.createFramebuffer(),B=new tm(k),Y=new Ag,ee=new Vg(k,at,g,Y,E,pe,B),ae=new Jp(M),ce=new nh(k),_e=new zp(k,ce),Q=new jp(k,ce,B,_e),re=new im(k,Q,ce,_e,B),D=new nm(k,E,ee),Le=new Hp(Y),fe=new Eg(M,ae,at,E,_e,Le),Ae=new $g(M,Y),ue=new Cg,de=new kg(at),Be=new Bp(M,ae,g,re,_,l),De=new zg(M,re,E),te=new Zg(k,B,E,g),ge=new Gp(k,at,B),se=new em(k,at,B),B.programs=fe.programs,M.capabilities=E,M.extensions=at,M.properties=Y,M.renderLists=ue,M.shadowMap=De,M.state=g,M.info=B}b!==en&&(w=new rm(b,t.width,t.height,o,s,r));const Pe=new Kg(M,k);this.xr=Pe,this.getContext=function(){return k},this.getContextAttributes=function(){return k.getContextAttributes()},this.forceContextLoss=function(){const x=at.get("WEBGL_lose_context");x&&x.loseContext()},this.forceContextRestore=function(){const x=at.get("WEBGL_lose_context");x&&x.restoreContext()},this.getPixelRatio=function(){return ne},this.setPixelRatio=function(x){x!==void 0&&(ne=x,this.setSize(Oe,$,!1))},this.getSize=function(x){return x.set(Oe,$)},this.setSize=function(x,U,Z=!0){if(Pe.isPresenting){ze("WebGLRenderer: Can't change size while VR device is presenting.");return}Oe=x,$=U,t.width=Math.floor(x*ne),t.height=Math.floor(U*ne),Z===!0&&(t.style.width=x+"px",t.style.height=U+"px"),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,x,U)},this.getDrawingBufferSize=function(x){return x.set(Oe*ne,$*ne).floor()},this.setDrawingBufferSize=function(x,U,Z){Oe=x,$=U,ne=Z,t.width=Math.floor(x*Z),t.height=Math.floor(U*Z),this.setViewport(0,0,x,U)},this.setEffects=function(x){if(b===en){dt("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(x){for(let U=0;U<x.length;U++)if(x[U].isOutputPass===!0){ze("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}w.setEffects(x||[])},this.getCurrentViewport=function(x){return x.copy(J)},this.getViewport=function(x){return x.copy(he)},this.setViewport=function(x,U,Z,q){x.isVector4?he.set(x.x,x.y,x.z,x.w):he.set(x,U,Z,q),g.viewport(J.copy(he).multiplyScalar(ne).round())},this.getScissor=function(x){return x.copy(Fe)},this.setScissor=function(x,U,Z,q){x.isVector4?Fe.set(x.x,x.y,x.z,x.w):Fe.set(x,U,Z,q),g.scissor(Se.copy(Fe).multiplyScalar(ne).round())},this.getScissorTest=function(){return ft},this.setScissorTest=function(x){g.setScissorTest(ft=x)},this.setOpaqueSort=function(x){le=x},this.setTransparentSort=function(x){Ee=x},this.getClearColor=function(x){return x.copy(Be.getClearColor())},this.setClearColor=function(){Be.setClearColor(...arguments)},this.getClearAlpha=function(){return Be.getClearAlpha()},this.setClearAlpha=function(){Be.setClearAlpha(...arguments)},this.clear=function(x=!0,U=!0,Z=!0){let q=0;if(x){let K=!1;if(j!==null){const xe=j.texture.format;K=m.has(xe)}if(K){const xe=j.texture.type,we=p.has(xe),ye=Be.getClearColor(),Re=Be.getClearAlpha(),Ie=ye.r,Xe=ye.g,$e=ye.b;we?(T[0]=Ie,T[1]=Xe,T[2]=$e,T[3]=Re,k.clearBufferuiv(k.COLOR,0,T)):(P[0]=Ie,P[1]=Xe,P[2]=$e,P[3]=Re,k.clearBufferiv(k.COLOR,0,P))}else q|=k.COLOR_BUFFER_BIT}U&&(q|=k.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Z&&(q|=k.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),q!==0&&k.clear(q)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(x){x.setRenderer(this),W=x},this.dispose=function(){t.removeEventListener("webglcontextlost",it,!1),t.removeEventListener("webglcontextrestored",Ye,!1),t.removeEventListener("webglcontextcreationerror",ke,!1),Be.dispose(),ue.dispose(),de.dispose(),Y.dispose(),ae.dispose(),re.dispose(),_e.dispose(),te.dispose(),fe.dispose(),Pe.dispose(),Pe.removeEventListener("sessionstart",Wt),Pe.removeEventListener("sessionend",Ss),an.stop()};function it(x){x.preventDefault(),Wo("WebGLRenderer: Context Lost."),N=!0}function Ye(){Wo("WebGLRenderer: Context Restored."),N=!1;const x=B.autoReset,U=De.enabled,Z=De.autoUpdate,q=De.needsUpdate,K=De.type;Ce(),B.autoReset=x,De.enabled=U,De.autoUpdate=Z,De.needsUpdate=q,De.type=K}function ke(x){dt("WebGLRenderer: A WebGL context could not be created. Reason: ",x.statusMessage)}function vt(x){const U=x.target;U.removeEventListener("dispose",vt),mn(U)}function mn(x){Kt(x),Y.remove(x)}function Kt(x){const U=Y.get(x).programs;U!==void 0&&(U.forEach(function(Z){fe.releaseProgram(Z)}),x.isShaderMaterial&&fe.releaseShaderCache(x))}this.renderBufferDirect=function(x,U,Z,q,K,xe){U===null&&(U=Dt);const we=K.isMesh&&K.matrixWorld.determinantAffine()<0,ye=As(x,U,Z,q,K);g.setMaterial(q,we);let Re=Z.index,Ie=1;if(q.wireframe===!0){if(Re=Q.getWireframeAttribute(Z),Re===void 0)return;Ie=2}const Xe=Z.drawRange,$e=Z.attributes.position;let Te=Xe.start*Ie,ot=(Xe.start+Xe.count)*Ie;xe!==null&&(Te=Math.max(Te,xe.start*Ie),ot=Math.min(ot,(xe.start+xe.count)*Ie)),Re!==null?(Te=Math.max(Te,0),ot=Math.min(ot,Re.count)):$e!=null&&(Te=Math.max(Te,0),ot=Math.min(ot,$e.count));const st=ot-Te;if(st<0||st===1/0)return;_e.setup(K,q,ye,Z,Re);let gt,pt=ge;if(Re!==null&&(gt=ce.get(Re),pt=se,pt.setIndex(gt)),K.isMesh)q.wireframe===!0?(g.setLineWidth(q.wireframeLinewidth*St()),pt.setMode(k.LINES)):pt.setMode(k.TRIANGLES);else if(K.isLine){let v=q.linewidth;v===void 0&&(v=1),g.setLineWidth(v*St()),K.isLineSegments?pt.setMode(k.LINES):K.isLineLoop?pt.setMode(k.LINE_LOOP):pt.setMode(k.LINE_STRIP)}else K.isPoints?pt.setMode(k.POINTS):K.isSprite&&pt.setMode(k.TRIANGLES);if(K.isBatchedMesh)if(at.get("WEBGL_multi_draw"))pt.renderMultiDraw(K._multiDrawStarts,K._multiDrawCounts,K._multiDrawCount);else{const v=K._multiDrawStarts,F=K._multiDrawCounts,oe=K._multiDrawCount,me=Re?ce.get(Re).bytesPerElement:1,Me=Y.get(q).currentProgram.getUniforms();for(let lt=0;lt<oe;lt++)Me.setValue(k,"_gl_DrawID",lt),pt.render(v[lt]/me,F[lt])}else if(K.isInstancedMesh)pt.renderInstances(Te,st,K.count);else if(Z.isInstancedBufferGeometry){const v=Z._maxInstanceCount!==void 0?Z._maxInstanceCount:1/0,F=Math.min(Z.instanceCount,v);pt.renderInstances(Te,st,F)}else pt.render(Te,st)};function zi(x,U,Z,q){W!==null&&x.isNodeMaterial&&W.setObject(q,x),Ve===!0&&Le.setState(x,Z,!1),x.transparent===!0&&x.side===jt&&x.forceSinglePass===!1?(x.side=qt,x.needsUpdate=!0,_n(x,U,q),x.side=Yn,x.needsUpdate=!0,_n(x,U,q),x.side=jt):_n(x,U,q)}this.compile=function(x,U,Z=null){Z===null&&(Z=x),W!==null&&W.renderStart(x,U,Z),A=de.get(Z),A.init(U),y.push(A),Z.traverseVisible(function(K){K.isLight&&K.layers.test(U.layers)&&(A.pushLight(K),K.castShadow&&A.pushShadow(K))}),x!==Z&&x.traverseVisible(function(K){K.isLight&&K.layers.test(U.layers)&&(A.pushLight(K),K.castShadow&&A.pushShadow(K))}),A.setupLights(),W!==null&&W.updateLights(A.state.lightsArray),nt=this.localClippingEnabled,Ve=Le.init(this.clippingPlanes,nt),Ve===!0&&Le.setGlobalState(this.clippingPlanes,U),W!==null&&De.render(A.state.shadowsArray,Z,U);const q=new Set;return x.traverse(function(K){if(!(K.isMesh||K.isPoints||K.isLine||K.isSprite))return;const xe=K.material;if(xe)if(Array.isArray(xe))for(let we=0;we<xe.length;we++){const ye=xe[we];zi(ye,Z,U,K),q.add(ye)}else zi(xe,Z,U,K),q.add(xe)}),A=y.pop(),W!==null&&W.renderEnd(),q},this.compileAsync=function(x,U,Z=null){const q=this.compile(x,U,Z);return new Promise(K=>{function xe(){if(q.forEach(function(we){const Re=Y.get(we).currentProgram;(Re===void 0||Re.isReady())&&q.delete(we)}),q.size===0){K(x);return}setTimeout(xe,10)}at.get("KHR_parallel_shader_compile")!==null?xe():setTimeout(xe,10)})};let gn=null;function bs(x){gn&&gn(x)}function Wt(){an.stop()}function Ss(){an.start()}const an=new Lc;an.setAnimationLoop(bs),typeof self<"u"&&an.setContext(self),this.setAnimationLoop=function(x){gn=x,Pe.setAnimationLoop(x),x===null?an.stop():an.start()},Pe.addEventListener("sessionstart",Wt),Pe.addEventListener("sessionend",Ss),this.render=function(x,U){if(U!==void 0&&U.isCamera!==!0){dt("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(N===!0)return;W!==null&&W.renderStart(x,U);const Z=Pe.enabled===!0&&Pe.isPresenting===!0,q=w!==null&&(j===null||Z)&&w.begin(M,j);if(x.matrixWorldAutoUpdate===!0&&x.updateMatrixWorld(),U.parent===null&&U.matrixWorldAutoUpdate===!0&&U.updateMatrixWorld(),Pe.enabled===!0&&Pe.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(Pe.cameraAutoUpdate===!0&&Pe.updateCamera(U),U=Pe.getCamera()),x.isScene===!0&&x.onBeforeRender(M,x,U,j),A=de.get(x,y.length),A.init(U),A.state.textureUnits=ee.getTextureUnits(),y.push(A),Ke.multiplyMatrices(U.projectionMatrix,U.matrixWorldInverse),Ue.setFromProjectionMatrix(Ke,bn,U.reversedDepth),nt=this.localClippingEnabled,Ve=Le.init(this.clippingPlanes,nt),R=ue.get(x,L.length),R.init(),L.push(R),Pe.enabled===!0&&Pe.isPresenting===!0){const we=M.xr.getDepthSensingMesh();we!==null&&Gi(we,U,-1/0,M.sortObjects)}Gi(x,U,0,M.sortObjects),R.finish(),W!==null&&W.updateLights(A.state.lightsArray),M.sortObjects===!0&&R.sort(le,Ee),mt=Pe.enabled===!1||Pe.isPresenting===!1||Pe.hasDepthSensing()===!1,mt&&Be.addToRenderList(R,x),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Ve===!0&&Le.beginShadows();const K=A.state.shadowsArray;if(De.render(K,x,U),Ve===!0&&Le.endShadows(),(q&&w.hasRenderPass())===!1){const we=R.opaque,ye=R.transmissive;if(A.setupLights(),U.isArrayCamera){const Re=U.cameras;if(ye.length>0)for(let Ie=0,Xe=Re.length;Ie<Xe;Ie++){const $e=Re[Ie];ws(we,ye,x,$e)}mt&&Be.render(x);for(let Ie=0,Xe=Re.length;Ie<Xe;Ie++){const $e=Re[Ie];Ms(R,x,$e,$e.viewport)}}else ye.length>0&&ws(we,ye,x,U),mt&&Be.render(x),Ms(R,x,U)}j!==null&&I===0&&(ee.updateMultisampleRenderTarget(j),ee.updateRenderTargetMipmap(j)),q&&w.end(M),x.isScene===!0&&x.onAfterRender(M,x,U),_e.resetDefaultState(),H=-1,X=null,y.pop(),y.length>0?(A=y[y.length-1],ee.setTextureUnits(A.state.textureUnits),Ve===!0&&Le.setGlobalState(M.clippingPlanes,A.state.camera)):A=null,L.pop(),L.length>0?R=L[L.length-1]:R=null,W!==null&&W.renderEnd()};function Gi(x,U,Z,q){if(x.visible===!1)return;if(x.layers.test(U.layers)){if(x.isGroup)Z=x.renderOrder;else if(x.isLOD)x.autoUpdate===!0&&x.update(U);else if(x.isLightProbeGrid)A.pushLightProbeGrid(x);else if(x.isLight)A.pushLight(x),x.castShadow&&A.pushShadow(x);else if(x.isSprite){if(!x.frustumCulled||x.intersectsFrustum(Ue)){q&&bt.setFromMatrixPosition(x.matrixWorld).applyMatrix4(Ke);const we=re.update(x),ye=x.material;ye.visible&&R.push(x,we,ye,Z,bt.z,null,U)}}else if((x.isMesh||x.isLine||x.isPoints)&&(!x.frustumCulled||x.intersectsFrustum(Ue))){const we=re.update(x),ye=x.material;if(q&&(x.boundingSphere!==void 0?(x.boundingSphere===null&&x.computeBoundingSphere(),bt.copy(x.boundingSphere.center)):(we.boundingSphere===null&&we.computeBoundingSphere(),bt.copy(we.boundingSphere.center)),bt.applyMatrix4(x.matrixWorld).applyMatrix4(Ke)),Array.isArray(ye)){const Re=we.groups;for(let Ie=0,Xe=Re.length;Ie<Xe;Ie++){const $e=Re[Ie],Te=ye[$e.materialIndex];Te&&Te.visible&&R.push(x,we,Te,Z,bt.z,$e,U)}}else ye.visible&&R.push(x,we,ye,Z,bt.z,null,U)}}const xe=x.children;for(let we=0,ye=xe.length;we<ye;we++)Gi(xe[we],U,Z,q)}function Ms(x,U,Z,q){const{opaque:K,transmissive:xe,transparent:we}=x;A.setupLightsView(Z),Ve===!0&&Le.setGlobalState(M.clippingPlanes,Z),q&&g.viewport(J.copy(q)),K.length>0&&di(K,U,Z),xe.length>0&&di(xe,U,Z),we.length>0&&di(we,U,Z),g.buffers.depth.setTest(!0),g.buffers.depth.setMask(!0),g.buffers.color.setMask(!0),g.setPolygonOffset(!1)}function ws(x,U,Z,q){if((Z.isScene===!0?Z.overrideMaterial:null)!==null)return;if(A.state.transmissionRenderTarget[q.id]===void 0){const Te=at.has("EXT_color_buffer_half_float")||at.has("EXT_color_buffer_float");A.state.transmissionRenderTarget[q.id]=new rn(1,1,{generateMipmaps:!0,type:Te?wn:en,minFilter:Kn,samples:Math.max(4,E.samples),stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,storeMultisampledDepthBuffer:!1,storeMultisampledStencilBuffer:!1,colorSpace:et.workingColorSpace})}const xe=A.state.transmissionRenderTarget[q.id],we=q.viewport||J;xe.setSize(we.z*M.transmissionResolutionScale,we.w*M.transmissionResolutionScale);const ye=M.getRenderTarget(),Re=M.getActiveCubeFace(),Ie=M.getActiveMipmapLevel();M.setRenderTarget(xe),M.getClearColor(He),Ne=M.getClearAlpha(),Ne<1&&M.setClearColor(16777215,.5),M.clear(),mt&&Be.render(Z);const Xe=M.toneMapping;M.toneMapping=Sn;const $e=q.viewport;if(q.viewport!==void 0&&(q.viewport=void 0),A.setupLightsView(q),Ve===!0&&Le.setGlobalState(M.clippingPlanes,q),di(x,Z,q),ee.updateMultisampleRenderTarget(xe),ee.updateRenderTargetMipmap(xe),at.has("WEBGL_multisampled_render_to_texture")===!1){let Te=!1;for(let ot=0,st=U.length;ot<st;ot++){const gt=U[ot],{object:pt,geometry:v,material:F,group:oe}=gt;if(F.side===jt&&pt.layers.test(q.layers)){const me=F.side;F.side=qt,F.needsUpdate=!0,Ts(pt,Z,q,v,F,oe),F.side=me,F.needsUpdate=!0,Te=!0}}Te===!0&&(ee.updateMultisampleRenderTarget(xe),ee.updateRenderTargetMipmap(xe))}M.setRenderTarget(ye,Re,Ie),M.setClearColor(He,Ne),$e!==void 0&&(q.viewport=$e),M.toneMapping=Xe}function di(x,U,Z){const q=U.isScene===!0?U.overrideMaterial:null;for(let K=0,xe=x.length;K<xe;K++){const we=x[K],{object:ye,geometry:Re,group:Ie}=we;let Xe=we.material;Xe.allowOverride===!0&&q!==null&&(Xe=q),ye.layers.test(Z.layers)&&Ts(ye,U,Z,Re,Xe,Ie)}}function Ts(x,U,Z,q,K,xe){W!==null&&K.isNodeMaterial&&W.setObject(x,K),x.onBeforeRender(M,U,Z,q,K,xe),x.modelViewMatrix.multiplyMatrices(Z.matrixWorldInverse,x.matrixWorld),x.normalMatrix.getNormalMatrix(x.modelViewMatrix),K.onBeforeRender(M,U,Z,q,x,xe),K.transparent===!0&&K.side===jt&&K.forceSinglePass===!1?(K.side=qt,K.needsUpdate=!0,M.renderBufferDirect(Z,U,q,K,x,xe),K.side=Yn,K.needsUpdate=!0,M.renderBufferDirect(Z,U,q,K,x,xe),K.side=jt):M.renderBufferDirect(Z,U,q,K,x,xe),x.onAfterRender(M,U,Z,q,K,xe)}function _n(x,U,Z){U.isScene!==!0&&(U=Dt);const q=Y.get(x),K=A.state.lights,xe=A.state.shadowsArray,we=K.state.version,ye=fe.getParameters(x,K.state,xe,U,Z,A.state.lightProbeGridArray),Re=fe.getProgramCacheKey(ye);let Ie=q.programs;q.environment=x.isMeshStandardMaterial||x.isMeshLambertMaterial||x.isMeshPhongMaterial?U.environment:null,q.fog=U.fog;const Xe=x.isMeshStandardMaterial||x.isMeshLambertMaterial&&!x.envMap||x.isMeshPhongMaterial&&!x.envMap;q.envMap=ae.get(x.envMap||q.environment,Xe),q.envMapRotation=q.environment!==null&&x.envMap===null?U.environmentRotation:x.envMapRotation,Ie===void 0&&(x.addEventListener("dispose",vt),Ie=new Map,q.programs=Ie);let $e=Ie.get(Re);if($e!==void 0){if(q.currentProgram===$e&&q.lightsStateVersion===we)return Vi(x,ye),$e}else ye.uniforms=fe.getUniforms(x),W!==null&&x.isNodeMaterial&&W.build(x,Z,ye),x.onBeforeCompile(ye,M),$e=fe.acquireProgram(ye,Re),Ie.set(Re,$e),q.uniforms=ye.uniforms;const Te=q.uniforms;return(!x.isShaderMaterial&&!x.isRawShaderMaterial||x.clipping===!0)&&(Te.clippingPlanes=Le.uniform),Vi(x,ye),q.needsLights=Rs(x),q.lightsStateVersion=we,q.needsLights&&(Te.ambientLightColor.value=K.state.ambient,Te.lightProbe.value=K.state.probe,Te.sunLights.value=K.state.sun,Te.sunLightShadows.value=K.state.sunShadow,Te.directionalLights.value=K.state.directional,Te.directionalLightShadows.value=K.state.directionalShadow,Te.spotLights.value=K.state.spot,Te.spotLightShadows.value=K.state.spotShadow,Te.rectAreaLights.value=K.state.rectArea,Te.ltc_1.value=K.state.rectAreaLTC1,Te.ltc_2.value=K.state.rectAreaLTC2,Te.pointLights.value=K.state.point,Te.pointLightShadows.value=K.state.pointShadow,Te.hemisphereLights.value=K.state.hemi,Te.sunShadowMatrix.value=K.state.sunShadowMatrix,Te.sunShadowCascade.value=K.state.sunShadowCascade,Te.directionalShadowMatrix.value=K.state.directionalShadowMatrix,Te.spotLightMatrix.value=K.state.spotLightMatrix,Te.spotLightMap.value=K.state.spotLightMap,Te.pointShadowMatrix.value=K.state.pointShadowMatrix),q.lightProbeGrid=A.state.lightProbeGridArray.length>0,q.currentProgram=$e,q.uniformsList=null,$e}function Es(x){if(x.uniformsList===null){const U=x.currentProgram.getUniforms();x.uniformsList=_r.seqWithValue(U.seq,x.uniforms)}return x.uniformsList}function Vi(x,U){const Z=Y.get(x);Z.outputColorSpace=U.outputColorSpace,Z.batching=U.batching,Z.batchingColor=U.batchingColor,Z.instancing=U.instancing,Z.instancingColor=U.instancingColor,Z.instancingMorph=U.instancingMorph,Z.skinning=U.skinning,Z.morphTargets=U.morphTargets,Z.morphNormals=U.morphNormals,Z.morphColors=U.morphColors,Z.morphTargetsCount=U.morphTargetsCount,Z.numClippingPlanes=U.numClippingPlanes,Z.numIntersection=U.numClipIntersection,Z.vertexAlphas=U.vertexAlphas,Z.vertexTangents=U.vertexTangents,Z.toneMapping=U.toneMapping}function kr(x,U){if(x.length===0)return null;if(x.length===1)return x[0].texture!==null?x[0]:null;S.setFromMatrixPosition(U.matrixWorld);for(let Z=0,q=x.length;Z<q;Z++){const K=x[Z];if(K.texture!==null&&K.boundingBox.containsPoint(S))return K}return null}function As(x,U,Z,q,K){U.isScene!==!0&&(U=Dt),ee.resetTextureUnits();const xe=U.fog,we=q.isMeshStandardMaterial||q.isMeshLambertMaterial||q.isMeshPhongMaterial?U.environment:null,ye=j===null?M.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:et.workingColorSpace,Re=q.isMeshStandardMaterial||q.isMeshLambertMaterial&&!q.envMap||q.isMeshPhongMaterial&&!q.envMap,Ie=ae.get(q.envMap||we,Re),Xe=q.vertexColors===!0&&!!Z.attributes.color&&Z.attributes.color.itemSize===4,$e=!!Z.attributes.tangent&&(!!q.normalMap||q.anisotropy>0),Te=!!Z.morphAttributes.position,ot=!!Z.morphAttributes.normal,st=!!Z.morphAttributes.color;let gt=Sn;q.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(gt=M.toneMapping);const pt=Z.morphAttributes.position||Z.morphAttributes.normal||Z.morphAttributes.color,v=pt!==void 0?pt.length:0,F=Y.get(q),oe=A.state.lights;if(Ve===!0&&(nt===!0||x!==X)){const ht=x===X&&q.id===H;Le.setState(q,x,ht)}let me=!1;q.version===F.__version?(F.needsLights&&F.lightsStateVersion!==oe.state.version||F.outputColorSpace!==ye||K.isBatchedMesh&&F.batching===!1||!K.isBatchedMesh&&F.batching===!0||K.isBatchedMesh&&F.batchingColor===!0&&K._colorsTexture===null||K.isBatchedMesh&&F.batchingColor===!1&&K._colorsTexture!==null||K.isInstancedMesh&&F.instancing===!1||!K.isInstancedMesh&&F.instancing===!0||K.isSkinnedMesh&&F.skinning===!1||!K.isSkinnedMesh&&F.skinning===!0||K.isInstancedMesh&&F.instancingColor===!0&&K.instanceColor===null||K.isInstancedMesh&&F.instancingColor===!1&&K.instanceColor!==null||K.isInstancedMesh&&F.instancingMorph===!0&&K.morphTexture===null||K.isInstancedMesh&&F.instancingMorph===!1&&K.morphTexture!==null||F.envMap!==Ie||q.fog===!0&&F.fog!==xe||F.numClippingPlanes!==void 0&&(F.numClippingPlanes!==Le.numPlanes||F.numIntersection!==Le.numIntersection)||F.vertexAlphas!==Xe||F.vertexTangents!==$e||F.morphTargets!==Te||F.morphNormals!==ot||F.morphColors!==st||F.toneMapping!==gt||F.morphTargetsCount!==v||!!F.lightProbeGrid!=A.state.lightProbeGridArray.length>0)&&(me=!0):(me=!0,F.__version=q.version);let Me=F.currentProgram;me===!0&&(Me=_n(q,U,K),W&&q.isNodeMaterial&&W.onUpdateProgram(q,Me,F));let lt=!1,rt=!1,ut=!1;const Ge=Me.getUniforms(),qe=F.uniforms;if(g.useProgram(Me.program)&&(lt=!0,rt=!0,ut=!0),q.id!==H&&(H=q.id,rt=!0),F.needsLights){const ht=kr(A.state.lightProbeGridArray,K);F.lightProbeGrid!==ht&&(F.lightProbeGrid=ht,rt=!0)}if(lt||X!==x){g.buffers.depth.getReversed()&&x.reversedDepth!==!0&&(x._reversedDepth=!0,x.updateProjectionMatrix()),Ge.setValue(k,"projectionMatrix",x.projectionMatrix),Ge.setValue(k,"viewMatrix",x.matrixWorldInverse);const Fn=Ge.map.cameraPosition;Fn!==void 0&&Fn.setValue(k,yt.setFromMatrixPosition(x.matrixWorld)),E.logarithmicDepthBuffer&&Ge.setValue(k,"logDepthBufFC",2/(Math.log(x.far+1)/Math.LN2)),(q.isMeshPhongMaterial||q.isMeshToonMaterial||q.isMeshLambertMaterial||q.isMeshBasicMaterial||q.isMeshStandardMaterial||q.isShaderMaterial)&&Ge.setValue(k,"isOrthographic",x.isOrthographicCamera===!0),X!==x&&(X=x,rt=!0,ut=!0)}if(F.needsLights&&(oe.state.sunShadowMap.length>0&&Ge.setValue(k,"sunShadowMap",oe.state.sunShadowMap,ee),oe.state.directionalShadowMap.length>0&&Ge.setValue(k,"directionalShadowMap",oe.state.directionalShadowMap,ee),oe.state.spotShadowMap.length>0&&Ge.setValue(k,"spotShadowMap",oe.state.spotShadowMap,ee),oe.state.pointShadowMap.length>0&&Ge.setValue(k,"pointShadowMap",oe.state.pointShadowMap,ee)),K.isSkinnedMesh){Ge.setOptional(k,K,"bindMatrix"),Ge.setOptional(k,K,"bindMatrixInverse");const ht=K.skeleton;ht&&(ht.boneTexture===null&&ht.computeBoneTexture(),Ge.setValue(k,"boneTexture",ht.boneTexture,ee))}K.isBatchedMesh&&(Ge.setOptional(k,K,"batchingTexture"),Ge.setValue(k,"batchingTexture",K._matricesTexture,ee),Ge.setOptional(k,K,"batchingIdTexture"),Ge.setValue(k,"batchingIdTexture",K._indirectTexture,ee),Ge.setOptional(k,K,"batchingColorTexture"),K._colorsTexture!==null&&Ge.setValue(k,"batchingColorTexture",K._colorsTexture,ee));const Nt=Z.morphAttributes;if((Nt.position!==void 0||Nt.normal!==void 0||Nt.color!==void 0)&&D.update(K,Z,Me),(rt||F.receiveShadow!==K.receiveShadow)&&(F.receiveShadow=K.receiveShadow,Ge.setValue(k,"receiveShadow",K.receiveShadow)),(q.isMeshStandardMaterial||q.isMeshLambertMaterial||q.isMeshPhongMaterial)&&q.envMap===null&&U.environment!==null&&(qe.envMapIntensity.value=U.environmentIntensity),qe.dfgLUT!==void 0&&(qe.dfgLUT.value=Qg()),rt){if(Ge.setValue(k,"toneMappingExposure",M.toneMappingExposure),F.needsLights&&Nr(qe,ut),xe&&q.fog===!0&&Ae.refreshFogUniforms(qe,xe),Ae.refreshMaterialUniforms(qe,q,ne,$,A.state.transmissionRenderTarget[x.id]),F.needsLights&&F.lightProbeGrid){const ht=F.lightProbeGrid;qe.probesSH.value=ht.texture,qe.probesMin.value.copy(ht.boundingBox.min),qe.probesMax.value.copy(ht.boundingBox.max),qe.probesResolution.value.copy(ht.resolution)}_r.upload(k,Es(F),qe,ee)}if(q.isShaderMaterial&&q.uniformsNeedUpdate===!0&&(_r.upload(k,Es(F),qe,ee),q.uniformsNeedUpdate=!1),q.isSpriteMaterial&&Ge.setValue(k,"center",K.center),Ge.setValue(k,"modelViewMatrix",K.modelViewMatrix),Ge.setValue(k,"normalMatrix",K.normalMatrix),Ge.setValue(k,"modelMatrix",K.matrixWorld),q.uniformsGroups!==void 0){const ht=q.uniformsGroups;for(let Fn=0,hi=ht.length;Fn<hi;Fn++){const Uo=ht[Fn];te.update(Uo,Me),te.bind(Uo,Me)}}return Me}function Nr(x,U){x.ambientLightColor.needsUpdate=U,x.lightProbe.needsUpdate=U,x.sunLights.needsUpdate=U,x.sunLightShadows.needsUpdate=U,x.directionalLights.needsUpdate=U,x.directionalLightShadows.needsUpdate=U,x.pointLights.needsUpdate=U,x.pointLightShadows.needsUpdate=U,x.spotLights.needsUpdate=U,x.spotLightShadows.needsUpdate=U,x.rectAreaLights.needsUpdate=U,x.hemisphereLights.needsUpdate=U}function Rs(x){return x.isMeshLambertMaterial||x.isMeshToonMaterial||x.isMeshPhongMaterial||x.isMeshStandardMaterial||x.isShadowMaterial||x.isShaderMaterial&&x.lights===!0}this.getActiveCubeFace=function(){return O},this.getActiveMipmapLevel=function(){return I},this.getRenderTarget=function(){return j},this.setRenderTargetTextures=function(x,U,Z){const q=Y.get(x);q.__autoAllocateDepthBuffer=x.resolveDepthBuffer===!1,q.__autoAllocateDepthBuffer===!1&&(q.__useRenderToTexture=!1),Y.get(x.texture).__webglTexture=U,Y.get(x.depthTexture).__webglTexture=q.__autoAllocateDepthBuffer?void 0:Z,q.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(x,U){const Z=Y.get(x);Z.__webglFramebuffer=U,Z.__useDefaultFramebuffer=U===void 0},this.setRenderTarget=function(x,U=0,Z=0){j=x,O=U,I=Z;let q=null,K=!1,xe=!1;if(x){const ye=Y.get(x);if(ye.__useDefaultFramebuffer!==void 0){g.bindFramebuffer(k.FRAMEBUFFER,ye.__webglFramebuffer),J.copy(x.viewport),Se.copy(x.scissor),ve=x.scissorTest,g.viewport(J),g.scissor(Se),g.setScissorTest(ve),H=-1;return}else if(ye.__webglFramebuffer===void 0)ee.setupRenderTarget(x);else if(ye.__hasExternalTextures)ee.rebindTextures(x,Y.get(x.texture).__webglTexture,Y.get(x.depthTexture).__webglTexture);else if(x.depthBuffer){const Xe=x.depthTexture;if(ye.__boundDepthTexture!==Xe){if(Xe!==null&&Y.has(Xe)&&(x.width!==Xe.image.width||x.height!==Xe.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");ee.setupDepthRenderbuffer(x)}}const Re=x.texture;(Re.isData3DTexture||Re.isDataArrayTexture||Re.isCompressedArrayTexture)&&(xe=!0);const Ie=Y.get(x).__webglFramebuffer;x.isWebGLCubeRenderTarget?(Array.isArray(Ie[U])?q=Ie[U][Z]:q=Ie[U],K=!0):x.samples>0&&ee.useMultisampledRTT(x)===!1?q=Y.get(x).__webglMultisampledFramebuffer:Array.isArray(Ie)?q=Ie[Z]:q=Ie,J.copy(x.viewport),Se.copy(x.scissor),ve=x.scissorTest}else J.copy(he).multiplyScalar(ne).floor(),Se.copy(Fe).multiplyScalar(ne).floor(),ve=ft;if(Z!==0&&(q=z),g.bindFramebuffer(k.FRAMEBUFFER,q)&&g.drawBuffers(x,q),g.viewport(J),g.scissor(Se),g.setScissorTest(ve),K){const ye=Y.get(x.texture);k.framebufferTexture2D(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_CUBE_MAP_POSITIVE_X+U,ye.__webglTexture,Z)}else if(xe){const ye=U;for(let Re=0;Re<x.textures.length;Re++){const Ie=Y.get(x.textures[Re]);k.framebufferTextureLayer(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0+Re,Ie.__webglTexture,Z,ye)}}else if(x!==null&&Z!==0){const ye=Y.get(x.texture);k.framebufferTexture2D(k.FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,ye.__webglTexture,Z)}H=-1};function Hi(x){const U=Y.get(x);return(U.__readFormat!==x.format||U.__readType!==x.type)&&(U.__readFormat=x.format,U.__readType=x.type,U.__formatReadable=E.textureFormatReadable(x.format),U.__typeReadable=E.textureTypeReadable(x.type)),U}this.readRenderTargetPixels=function(x,U,Z,q,K,xe,we,ye=0){if(!(x&&x.isWebGLRenderTarget)){dt("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Re=Y.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&we!==void 0&&(Re=Re[we]),Re){g.bindFramebuffer(k.FRAMEBUFFER,Re);try{const Ie=x.textures[ye],Xe=Ie.format,$e=Ie.type;x.textures.length>1&&k.readBuffer(k.COLOR_ATTACHMENT0+ye);const Te=Hi(Ie);if(Te.__formatReadable===!1){dt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(Te.__typeReadable===!1){dt("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}U>=0&&U<=x.width-q&&Z>=0&&Z<=x.height-K&&k.readPixels(U,Z,q,K,pe.convert(Xe),pe.convert($e),xe)}finally{const Ie=j!==null?Y.get(j).__webglFramebuffer:null;g.bindFramebuffer(k.FRAMEBUFFER,Ie)}}},this.readRenderTargetPixelsAsync=async function(x,U,Z,q,K,xe,we,ye=0){if(!(x&&x.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Re=Y.get(x).__webglFramebuffer;if(x.isWebGLCubeRenderTarget&&we!==void 0&&(Re=Re[we]),Re)if(U>=0&&U<=x.width-q&&Z>=0&&Z<=x.height-K){g.bindFramebuffer(k.FRAMEBUFFER,Re);const Ie=x.textures[ye],Xe=Ie.format,$e=Ie.type;x.textures.length>1&&k.readBuffer(k.COLOR_ATTACHMENT0+ye);const Te=Hi(Ie);if(Te.__formatReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(Te.__typeReadable===!1)throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const ot=k.createBuffer();k.bindBuffer(k.PIXEL_PACK_BUFFER,ot),k.bufferData(k.PIXEL_PACK_BUFFER,xe.byteLength,k.STREAM_READ),k.readPixels(U,Z,q,K,pe.convert(Xe),pe.convert($e),0),k.bindBuffer(k.PIXEL_PACK_BUFFER,null);const st=j!==null?Y.get(j).__webglFramebuffer:null;g.bindFramebuffer(k.FRAMEBUFFER,st);const gt=k.fenceSync(k.SYNC_GPU_COMMANDS_COMPLETE,0);return k.flush(),await xd(k,gt,4),k.bindBuffer(k.PIXEL_PACK_BUFFER,ot),k.getBufferSubData(k.PIXEL_PACK_BUFFER,0,xe),k.bindBuffer(k.PIXEL_PACK_BUFFER,null),k.deleteBuffer(ot),k.deleteSync(gt),xe}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(x,U=null,Z=0){const q=Math.pow(2,-Z),K=Math.floor(x.image.width*q),xe=Math.floor(x.image.height*q),we=U!==null?U.x:0,ye=U!==null?U.y:0;ee.setTexture2D(x,0),k.copyTexSubImage2D(k.TEXTURE_2D,Z,0,0,we,ye,K,xe),g.unbindTexture()},this.copyTextureToTexture=function(x,U,Z=null,q=null,K=0,xe=0){let we,ye,Re,Ie,Xe,$e,Te,ot,st;const gt=x.isCompressedTexture?x.mipmaps[xe]:x.image;if(Z!==null)we=Z.max.x-Z.min.x,ye=Z.max.y-Z.min.y,Re=Z.isBox3?Z.max.z-Z.min.z:1,Ie=Z.min.x,Xe=Z.min.y,$e=Z.isBox3?Z.min.z:0;else{const qe=Math.pow(2,-K);we=Math.floor(gt.width*qe),ye=Math.floor(gt.height*qe),x.isDataArrayTexture?Re=gt.depth:x.isData3DTexture?Re=Math.floor(gt.depth*qe):Re=1,Ie=0,Xe=0,$e=0}q!==null?(Te=q.x,ot=q.y,st=q.z):(Te=0,ot=0,st=0);const pt=pe.convert(U.format),v=pe.convert(U.type);let F;U.isData3DTexture?(ee.setTexture3D(U,0),F=k.TEXTURE_3D):U.isDataArrayTexture||U.isCompressedArrayTexture?(ee.setTexture2DArray(U,0),F=k.TEXTURE_2D_ARRAY):(ee.setTexture2D(U,0),F=k.TEXTURE_2D),g.activeTexture(k.TEXTURE0),g.pixelStorei(k.UNPACK_FLIP_Y_WEBGL,U.flipY),g.pixelStorei(k.UNPACK_PREMULTIPLY_ALPHA_WEBGL,U.premultiplyAlpha),g.pixelStorei(k.UNPACK_ALIGNMENT,U.unpackAlignment);const oe=g.getParameter(k.UNPACK_ROW_LENGTH),me=g.getParameter(k.UNPACK_IMAGE_HEIGHT),Me=g.getParameter(k.UNPACK_SKIP_PIXELS),lt=g.getParameter(k.UNPACK_SKIP_ROWS),rt=g.getParameter(k.UNPACK_SKIP_IMAGES);g.pixelStorei(k.UNPACK_ROW_LENGTH,gt.width),g.pixelStorei(k.UNPACK_IMAGE_HEIGHT,gt.height),g.pixelStorei(k.UNPACK_SKIP_PIXELS,Ie),g.pixelStorei(k.UNPACK_SKIP_ROWS,Xe),g.pixelStorei(k.UNPACK_SKIP_IMAGES,$e);const ut=x.isDataArrayTexture||x.isData3DTexture,Ge=U.isDataArrayTexture||U.isData3DTexture;if(x.isDepthTexture){const qe=Y.get(x),Nt=Y.get(U),ht=Y.get(qe.__renderTarget),Fn=Y.get(Nt.__renderTarget);g.bindFramebuffer(k.READ_FRAMEBUFFER,ht.__webglFramebuffer),g.bindFramebuffer(k.DRAW_FRAMEBUFFER,Fn.__webglFramebuffer);for(let hi=0;hi<Re;hi++)ut&&(k.framebufferTextureLayer(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,Y.get(x).__webglTexture,K,$e+hi),k.framebufferTextureLayer(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,Y.get(U).__webglTexture,xe,st+hi)),k.blitFramebuffer(Ie,Xe,we,ye,Te,ot,we,ye,k.DEPTH_BUFFER_BIT,k.NEAREST);g.bindFramebuffer(k.READ_FRAMEBUFFER,null),g.bindFramebuffer(k.DRAW_FRAMEBUFFER,null)}else if(K!==0||x.isRenderTargetTexture||Y.has(x)){const qe=Y.get(x),Nt=Y.get(U);g.bindFramebuffer(k.READ_FRAMEBUFFER,C),g.bindFramebuffer(k.DRAW_FRAMEBUFFER,V);for(let ht=0;ht<Re;ht++)ut?k.framebufferTextureLayer(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,qe.__webglTexture,K,$e+ht):k.framebufferTexture2D(k.READ_FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,qe.__webglTexture,K),Ge?k.framebufferTextureLayer(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,Nt.__webglTexture,xe,st+ht):k.framebufferTexture2D(k.DRAW_FRAMEBUFFER,k.COLOR_ATTACHMENT0,k.TEXTURE_2D,Nt.__webglTexture,xe),K!==0?k.blitFramebuffer(Ie,Xe,we,ye,Te,ot,we,ye,k.COLOR_BUFFER_BIT,k.NEAREST):Ge?k.copyTexSubImage3D(F,xe,Te,ot,st+ht,Ie,Xe,we,ye):k.copyTexSubImage2D(F,xe,Te,ot,Ie,Xe,we,ye);g.bindFramebuffer(k.READ_FRAMEBUFFER,null),g.bindFramebuffer(k.DRAW_FRAMEBUFFER,null)}else Ge?x.isDataTexture||x.isData3DTexture?k.texSubImage3D(F,xe,Te,ot,st,we,ye,Re,pt,v,gt.data):U.isCompressedArrayTexture?k.compressedTexSubImage3D(F,xe,Te,ot,st,we,ye,Re,pt,gt.data):k.texSubImage3D(F,xe,Te,ot,st,we,ye,Re,pt,v,gt):x.isDataTexture?k.texSubImage2D(k.TEXTURE_2D,xe,Te,ot,we,ye,pt,v,gt.data):x.isCompressedTexture?k.compressedTexSubImage2D(k.TEXTURE_2D,xe,Te,ot,gt.width,gt.height,pt,gt.data):k.texSubImage2D(k.TEXTURE_2D,xe,Te,ot,we,ye,pt,v,gt);g.pixelStorei(k.UNPACK_ROW_LENGTH,oe),g.pixelStorei(k.UNPACK_IMAGE_HEIGHT,me),g.pixelStorei(k.UNPACK_SKIP_PIXELS,Me),g.pixelStorei(k.UNPACK_SKIP_ROWS,lt),g.pixelStorei(k.UNPACK_SKIP_IMAGES,rt),xe===0&&U.generateMipmaps&&k.generateMipmap(F),g.unbindTexture()},this.initRenderTarget=function(x){Y.get(x).__webglFramebuffer===void 0&&ee.setupRenderTarget(x)},this.initTexture=function(x){x.isCubeTexture?ee.setTextureCube(x,0):x.isData3DTexture?ee.setTexture3D(x,0):x.isDataArrayTexture||x.isCompressedArrayTexture?ee.setTexture2DArray(x,0):ee.setTexture2D(x,0),g.unbindTexture()},this.resetState=function(){O=0,I=0,j=null,g.reset(),_e.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return bn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=et._getDrawingBufferColorSpace(e),t.unpackColorSpace=et._getUnpackColorSpace()}}const e_=`// ---------------------------------------------------------------------------------------------
// Shared helpers (prepended to most shaders).
// ---------------------------------------------------------------------------------------------
#define PI 3.14159265359
#define TAU 6.28318530718

float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec3 saturate(vec3 x) { return clamp(x, 0.0, 1.0); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// Interleaved gradient noise (Jimenez), stable per pixel.
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Equirectangular sky LUT parameterisation with extra resolution near the horizon.
vec2 skyLutUV(vec3 d) {
  float az = atan(d.z, d.x);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float v = 0.5 + 0.5 * sign(el) * sqrt(abs(el) / (0.5 * PI));
  return vec2(az / TAU + 0.5, v);
}

vec3 skyLutDir(vec2 uv) {
  float az = (uv.x - 0.5) * TAU;
  float t = uv.y * 2.0 - 1.0;
  float el = sign(t) * t * t * 0.5 * PI;
  float c = cos(el);
  return vec3(cos(az) * c, sin(el), sin(az) * c);
}
`,t_=`// ---------------------------------------------------------------------------------------------
// Packed chunk vertex decoding + vertex animation (shared by terrain, water and shadow passes).
//   w0: x(5) | z(5)<<5 | y(9)<<10 | normal(3)<<19 | ao(2)<<22 | anim(2)<<24 | tint<<26
//       | xmax<<27 | zmax<<28 | cutout<<29 | fine<<30 | uvt.0<<31
//   w1: layer(10) | uvt.1-2<<10 | sky*4(6)<<12 | block*4(6)<<18 | fx(4)<<24 | fz(4)<<28
// A fine vertex (block models: torches, slabs, stairs, beds) is its block's cell (x 4 bits, z 4, y 8)
// and an offset into it in sixteenths, 0..16 (see \`mesher.rs\`), so its texture maps exactly within
// the block's own tile. uvt turns the texture: 1 swaps u and v, 2 negates u, 4 negates v.
// ---------------------------------------------------------------------------------------------
in uvec2 aData;

uniform float uTime;
uniform vec4 uWind; // xy: direction, z: strength, w: gust phase
// A texel per texture layer: the layer drawn in its place, red + green * 256 (a game's blocks'
// other looks, \`Renderer.setLooks\`; each its own otherwise).
uniform sampler2D uLooks;

struct Vtx {
  vec3 pos;      // chunk-local (animated)
  vec3 normal;   // world-space geometric normal
  vec3 tangent;  // world-space +u
  vec3 bitangent;// world-space +v (texture up)
  vec2 uv;       // unwrapped texture coordinates in block units
  uint layer;
  uint normalIdx;
  float ao;
  float sky;
  float blk;
  float tint;
  float cutout;
  float plantV;  // 0 for cross-plane plants, -1 for cube faces
  bool fine;     // a block model's face (torch, slab, bed): part of one texture tile
};

vec3 windOffset(vec3 w, float amount) {
  float t = uTime;
  float gust = 0.65 + 0.35 * sin(t * 0.35 + w.x * 0.013 + w.z * 0.017 + uWind.w);
  vec3 o;
  o.x = sin(t * 1.9 + w.x * 0.61 + w.y * 0.37) + 0.5 * sin(t * 3.7 + w.z * 1.13);
  o.y = 0.35 * sin(t * 2.3 + w.x * 0.43 + w.z * 0.51);
  o.z = cos(t * 1.7 + w.z * 0.57 + w.y * 0.23) + 0.5 * cos(t * 3.3 + w.x * 0.97);
  o.xz += uWind.xy * 0.8;
  return o * amount * gust * uWind.z;
}

Vtx unpackVertex(vec3 chunkOrigin) {
  Vtx v;
  uint w0 = aData.x;
  uint w1 = aData.y;
  vec3 p = vec3(float(w0 & 31u), float((w0 >> 10u) & 511u), float((w0 >> 5u) & 31u));
  uint n = (w0 >> 19u) & 7u;
  bool fine = ((w0 >> 30u) & 1u) == 1u;
  v.fine = fine;
  uint anim = fine ? 0u : (w0 >> 24u) & 3u;
  uint uvt = ((w0 >> 31u) & 1u) | (((w1 >> 10u) & 3u) << 1u);
  // Where in its block's cell a fine vertex is, 0..1.
  vec3 inCell = vec3(0.0);
  if (fine) {
    p = vec3(float(w0 & 15u), float((w0 >> 10u) & 255u), float((w0 >> 5u) & 15u));
    uint ox = ((w1 >> 24u) & 15u) | (((w0 >> 4u) & 1u) << 4u);
    uint oy = ((w0 >> 24u) & 3u) | (((w0 >> 27u) & 3u) << 2u) | (((w0 >> 18u) & 1u) << 4u);
    uint oz = ((w1 >> 28u) & 15u) | (((w0 >> 9u) & 1u) << 4u);
    inCell = vec3(float(ox), float(oy), float(oz)) / 16.0;
    p += inCell;
  }
  v.normalIdx = n;
  v.ao = float((w0 >> 22u) & 3u) / 3.0;
  v.tint = float((w0 >> 26u) & 1u);
  v.cutout = float((w0 >> 29u) & 1u);
  vec2 look = texelFetch(uLooks, ivec2(int(w1 & 1023u), 0), 0).rg * 255.0 + 0.5;
  v.layer = uint(look.x) + (uint(look.y) << 8u);
  v.sky = float((w1 >> 12u) & 63u) / 60.0;
  v.blk = float((w1 >> 18u) & 63u) / 60.0;
  v.plantV = -1.0;
  vec3 animRef = p;

  if (n == 0u) { v.normal = vec3(1, 0, 0); v.tangent = vec3(0, 0, -1); v.bitangent = vec3(0, 1, 0); v.uv = vec2(-p.z, p.y); }
  else if (n == 1u) { v.normal = vec3(-1, 0, 0); v.tangent = vec3(0, 0, 1); v.bitangent = vec3(0, 1, 0); v.uv = vec2(p.z, p.y); }
  else if (n == 2u) { v.normal = vec3(0, 1, 0); v.tangent = vec3(1, 0, 0); v.bitangent = vec3(0, 0, 1); v.uv = vec2(p.x, p.z); }
  else if (n == 3u) { v.normal = vec3(0, -1, 0); v.tangent = vec3(1, 0, 0); v.bitangent = vec3(0, 0, -1); v.uv = vec2(p.x, -p.z); }
  else if (n == 4u) { v.normal = vec3(0, 0, 1); v.tangent = vec3(1, 0, 0); v.bitangent = vec3(0, 1, 0); v.uv = vec2(p.x, p.y); }
  else if (n == 5u) { v.normal = vec3(0, 0, -1); v.tangent = vec3(-1, 0, 0); v.bitangent = vec3(0, 1, 0); v.uv = vec2(-p.x, p.y); }
  else {
    // Cross-plane plant: shrink toward the cell centre and jitter per cell.
    float xmax = float((w0 >> 27u) & 1u);
    float zmax = float((w0 >> 28u) & 1u);
    vec2 cell = p.xz - vec2(xmax, zmax);
    v.uv = vec2(n == 6u ? xmax : zmax, p.y);
    float inset = 0.14;
    p.x += xmax > 0.5 ? -inset : inset;
    p.z += zmax > 0.5 ? -inset : inset;
#ifdef TORCH_LAYER
    if (v.layer != uint(TORCH_LAYER)) {
#else
    {
#endif
      vec2 j = hash22(chunkOrigin.xz + cell + 0.37) - 0.5;
      p.xz += j * 0.36;
    }
    // Animate both top corners of a plant together.
    animRef = vec3(cell.x + 0.5, p.y, cell.y + 0.5);
    v.normal = vec3(0, 1, 0);
    v.tangent = n == 6u ? normalize(vec3(1, 0, 1)) : normalize(vec3(-1, 0, 1));
    v.bitangent = vec3(0, 1, 0);
    // The fragment shader derives the height along the plant from fract(uv.y).
    v.plantV = 0.0;
  }

  if (uvt != 0u) {
    if ((uvt & 1u) != 0u) {
      v.uv = v.uv.yx;
      vec3 t = v.tangent;
      v.tangent = v.bitangent;
      v.bitangent = t;
    }
    if ((uvt & 2u) != 0u) {
      v.uv.x = -v.uv.x;
      v.tangent = -v.tangent;
    }
    if ((uvt & 4u) != 0u) {
      v.uv.y = -v.uv.y;
      v.bitangent = -v.bitangent;
    }
  }

  if (fine) {
    // Its block's own tile, from the cell (0..1 along each axis, turned as the texture is),
    // kept a hair inside it so it never wraps round to the tile's far edge.
    v.uv = vec2(dot(inCell, v.tangent), dot(inCell, v.bitangent));
    v.uv += vec2(v.tangent.x + v.tangent.y + v.tangent.z < 0.0 ? 1.0 : 0.0, v.bitangent.x + v.bitangent.y + v.bitangent.z < 0.0 ? 1.0 : 0.0);
    v.uv = clamp(v.uv, 1.0 / 1024.0, 1.0 - 1.0 / 1024.0);
    // Widen a hair along the face at the block's edges, like cube faces, so there are no cracks
    // between it and the next block's faces.
    vec3 edge = step(0.999, inCell) - step(inCell, vec3(0.001));
    p += edge * (vec3(1.0) - abs(v.normal)) * 0.0022;
  }

  if (n < 6u && !fine) {
    // Expand cube faces by a hair along their plane to close T-junction cracks.
    const float EPS = 0.0022;
    float us = ((w0 >> 27u) & 1u) == 1u ? EPS : -EPS;
    float vs = ((w0 >> 28u) & 1u) == 1u ? EPS : -EPS;
    if (n < 2u) p += vec3(0.0, vs, us);
    else if (n < 4u) p += vec3(us, 0.0, vs);
    else p += vec3(us, vs, 0.0);
  }

  vec3 world = chunkOrigin + animRef;
  if (anim == 1u) {
    p += windOffset(world, 0.045) * smoothstep(0.3, 0.9, v.sky);
  } else if (anim == 2u) {
    p.xz += windOffset(world, 0.11).xz * smoothstep(0.3, 0.9, v.sky);
  } else if (anim == 3u) {
    p.y -= 0.125;
    p.y += (sin(world.x * 0.8 + uTime * 1.6) + sin(world.z * 0.7 + uTime * 1.3 + world.x * 0.2)) * 0.018;
  }
  v.pos = p;
  return v;
}
`,n_=60,vs=30,i_=1/n_;function s_(i){const e=Math.max(1,Math.hypot(i.x,i.z)),t=i.x/e,n=i.z/e,s=Math.cos(i.yaw),r=Math.sin(i.yaw);return[t*s-n*r,t*r+n*s]}const Bc=1,r_=vs*20*60,Bl=vs*3*60,a_=vs*15,ya=(i,e,t)=>{const n=Math.max(0,Math.min(1,(t-i)/(e-i)));return n*n*(3-2*n)};function zc(i,e){let t=(i^Math.imul(e,2654435761))>>>0;return t=Math.imul(t^t>>>16,2246822507),t=Math.imul(t^t>>>13,3266489909),((t^t>>>16)>>>0)/4294967296}const zl=(i,e)=>e<=0?0:zc(i,e)<.28?1:0;function xa(i,e){if(!Number.isFinite(i)||i<0||i>Number.MAX_SAFE_INTEGER||!Number.isInteger(e)||e<0||e>4294967295)throw new Error("invalid environment clock/seed");const t=(i/r_+.22)%1,n=t*Math.PI*2,s=Math.hypot(1,.3),r=[Math.cos(n)/s,Math.sin(n)/s,.3/s],a=.06+.94*ya(-.12,.22,r[1]),o=Math.floor(i/Bl),l=ya(0,a_,i%Bl),c=zl(e,o-1)*(1-l)+zl(e,o)*l,u=(1-ya(.02,.3,Math.abs(r[1])))*a,h=[.025+a*.565+u*.13,.04+a*.72-u*.08,.09+a*.79-u*.18].map((_,b)=>_*(1-c*.55)+[.26,.3,.36][b]*a*c*.55),d=zc(e,0)*Math.PI*2,f=.3+c*.8;return{tick:i,seconds:i/vs,dayFraction:t,daylight:a,sun:r,sky:h,rain:c,wind:[Math.cos(d)*f,Math.sin(d)*f]}}function o_(i,e,t){return i===null||e===null?i===e:i.startsWith("#")?t?.get(e)?.tags?.includes(i.slice(1))??!1:i===e}const l_=2,c_=36,u_=27,li=["head","body","legs","feet","offhand"];function Ar(i,e){if(!i||typeof i!="object"||Array.isArray(i))return!1;const t=i;if(!Object.hasOwn(t,"itemType")||!Object.hasOwn(t,"count")||t.instance!==void 0&&!Object.hasOwn(t,"instance")||!Object.keys(t).every(s=>["itemType","count","instance"].includes(s))||typeof t.itemType!="string"||!/^[a-z][a-z0-9_]{0,63}$/.test(t.itemType)||!Number.isSafeInteger(t.count)||t.count<1||t.count>999)return!1;const n=e?.get(t.itemType);if(e&&(!n||t.count>n.maxStack))return!1;if(t.instance!==void 0){const s=t.instance;if(!s||typeof s!="object"||Array.isArray(s)||Object.keys(s).length!==1||!Object.hasOwn(s,"durability")||!Number.isSafeInteger(s.durability)||s.durability<1||t.count!==1||n&&(!n.durability||s.durability>n.durability))return!1}else if(n?.durability!==void 0)return!1;return!0}const Gl=i=>!!i&&typeof i=="object"&&!Array.isArray(i),Vl=(i,e)=>Object.keys(i).length===e.length&&e.every(t=>Object.hasOwn(i,t)),va=(i,e,t=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(i)&&i>=e&&i<=t;li.length;function d_(i,e){if(!Gl(i)||!Vl(i,["version","catalog","revision","selected","bag","craft2","craft3","equipment","station","container"])||i.version!==l_||typeof i.catalog!="boolean"||!va(i.revision,0)||!va(i.selected,0,8)||!["personal","workbench","container"].includes(i.station))return!1;const t=(s,r)=>Array.isArray(s)&&s.length===r&&s.every(a=>a===null||Ar(a));if(!t(i.bag,c_)||!t(i.craft2,4)||!t(i.craft3,9)||!t(i.equipment,li.length))return!1;if(i.station!=="container")return i.container===null;const n=i.container;return Gl(n)&&Vl(n,["id","cell","revision","slots"])&&typeof n.id=="string"&&/^chest-[1-9][0-9]{0,15}$/.test(n.id)&&e(n.cell)&&va(n.revision,0)&&t(n.slots,u_)}function h_(i,e,t,n){if(i.length!==e*e||!i.some(Boolean))return null;function s(o,l){let c=l,u=l,h=-1,d=-1;return o.forEach((f,_)=>{f&&(c=Math.min(c,_%l),h=Math.max(h,_%l),u=Math.min(u,Math.floor(_/l)),d=Math.max(d,Math.floor(_/l)))}),{minX:c,minY:u,width:h-c+1,height:d-u+1}}const r=i.map(o=>o?.itemType??null),a=s(r,e);for(const o of t){if(o.size>e)continue;const l=s(o.ingredients,o.size);if(!(a.width!==l.width||a.height!==l.height))for(const c of[!1,!0]){let u=!0;for(let h=0;h<a.height;h++)for(let d=0;d<a.width;d++){const f=o.ingredients[(l.minY+h)*o.size+l.minX+(c?l.width-1-d:d)],_=i[(a.minY+h)*e+a.minX+d];(!o_(f,_?.itemType??null,n)||_?.instance)&&(u=!1)}if(u)return o}}return null}const _s=Object.freeze({speed:1,gravity:1,control:1,jump:1,sprint:!0});function f_(i,e,t,n=_s){const[s,r]=s_(t);return i.player_step(e,s,r,t.jump,t.sneak,t.sprint&&n.sprint,!1,n.speed,n.gravity,n.control,n.jump,i_)}function Hl(i,e,t,n=_s){const s=f_(i,e,t,n),r=i.player_state(e);let a=!1;const o=[[-255.7,255.7],[0,254],[-255.7,255.7]];for(let l=0;l<3;l++){const c=Math.max(o[l][0],Math.min(o[l][1],r[l]));c!==r[l]&&(r[l]=c,r[l+3]=0,a=!0)}return a&&i.player_restore(e,r),s}const p_=2,m_=20,g_=20,__=300,y_=60;function x_(i){let e=1,t=1,n=1,s=0,r=0,a=1,o=!1,l=!1,c=!1;for(const h of i)e*=h.modifiers?.speed??1,t*=h.modifiers?.gravity??1,n*=h.modifiers?.control??1,a*=h.modifiers?.jump??1,s+=h.modifiers?.fall??0,r+=h.modifiers?.armor??0,o||=h.perks?.fallImmune===!0,l||=h.perks?.sunRegen===!0,c||=h.perks?.vision===!0;const u=(h,d,f)=>Math.max(d,Math.min(f,h));return{movement:{..._s,speed:u(e,.25,2),gravity:u(t,.25,2),control:u(n,.25,2),jump:u(a,.25,2)},fall:u(s,0,.9),armor:u(r,0,.8),fallImmune:o,sunRegen:l,vision:c}}function v_(i){if(!i||typeof i!="object"||Array.isArray(i))return!1;const e=i;return Object.keys(e).length===5&&typeof e.sprint=="boolean"&&["speed","gravity","control","jump"].every(t=>typeof e[t]=="number"&&Number.isFinite(e[t])&&e[t]>=.25&&e[t]<=2)}function b_(i){if(!i||typeof i!="object"||Array.isArray(i))return!1;const e=i,t=(n,s)=>Number.isSafeInteger(n)&&n>=0&&n<=s;return Object.keys(e).length===8&&e.version===p_&&t(e.health,m_)&&t(e.food,g_)&&t(e.air,__)&&t(e.attackCooldown,60)&&t(e.protection,60)&&typeof e.dead=="boolean"&&e.dead===(e.health===0)&&t(e.respawnIn,y_)&&(e.dead||e.respawnIn===0)}const Wl=i=>!!i&&typeof i=="object"&&!Array.isArray(i),Xl=i=>i===null||typeof i=="string"&&/^[a-z][a-z0-9_]{0,63}$/.test(i);function ql(i){return Wl(i)&&Object.keys(i).length===2&&Object.hasOwn(i,"held")&&Xl(i.held)&&Wl(i.equipment)&&Object.keys(i.equipment).length===li.length&&li.every(e=>Object.hasOwn(i.equipment,e)&&Xl(i.equipment[e]))}function Kl(i,e){return(i.held===null||e.has(i.held))&&li.every(t=>{const n=i.equipment[t];return n===null||e.get(n)?.equipment===t})}function S_(i){if(!i||typeof i!="object"||Array.isArray(i))return!1;const e=i;return Object.keys(e).length!==4||e.type!=="lifecycle"||!Number.isSafeInteger(e.tick)||e.tick<0?!1:e.state==="playing"?e.reason==="allowed":e.state==="ended"?e.reason==="ended":e.state==="paused"&&["manual","session","no_participants","policy_unavailable"].includes(e.reason)}const go=2,Yl=2,sn=Object.freeze({minX:-256,minZ:-256,maxX:256,maxZ:256,height:256}),je=(i,e=0,t=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(i)&&i>=e&&i<=t,un=i=>typeof i=="number"&&Number.isFinite(i),Xn=i=>!!i&&typeof i=="object"&&!Array.isArray(i),dn=(i,e)=>Object.keys(i).length===e.length&&e.every(t=>Object.hasOwn(i,t)),Ni=i=>je(i,-16,15),M_=i=>Xn(i)&&dn(i,["x","z","revision"])&&Ni(i.x)&&Ni(i.z)&&je(i.revision),ba=i=>Array.isArray(i)&&i.length===3&&je(i[0],sn.minX,sn.maxX-1)&&je(i[1],0,255)&&je(i[2],sn.minZ,sn.maxZ-1),ar=i=>Array.isArray(i)&&i.length===17&&i.every(un);function w_(i){if(i.length>65536)return null;let e;try{e=JSON.parse(i)}catch{return null}if(!Xn(e))return null;const t=n=>typeof n=="string"&&n.length>0&&n.length<=128;switch(e.type){case"lifecycle":return S_(e)?e:null;case"rules":return Object.keys(e).length===5&&je(e.epoch,1)&&["creative","survival"].includes(e.mode)&&typeof e.combat=="boolean"&&typeof e.explosives=="boolean"?e:null;case"welcome":return t(e.actorId)&&je(e.epoch,1)&&t(e.worldId)&&je(e.seed,0,4294967295)&&je(e.tick)&&e.environmentVersion===Bc&&Array.isArray(e.spawn)&&e.spawn.length===3&&e.spawn.every(un)&&t(e.buildId)&&t(e.contentHash)&&je(e.generatorVersion)&&["participant","observer"].includes(e.role)&&["creative","survival"].includes(e.mode)&&typeof e.combat=="boolean"&&typeof e.explosives=="boolean"?e:null;case"baseline":return je(e.epoch,1)&&je(e.ack)&&ar(e.state)&&["preparing","playing","paused","dead"].includes(e.phase)&&["join","ready","resync","focus","flight","pause","movement","death","respawn","damage","mode","teleport"].includes(e.reason)&&v_(e.movement)?e:null;case"snapshot":return un(e.time)&&je(e.tick)&&(!e.self||Xn(e.self)&&je(e.self.epoch,1)&&je(e.self.ack)&&ar(e.self.state))&&Array.isArray(e.actors)&&e.actors.length<=64&&e.actors.every(n=>Xn(n)&&Object.keys(n).every(s=>["id","state","yaw","pitch","appearance"].includes(s))&&t(n.id)&&(n.state===void 0||ar(n.state))&&(n.yaw===void 0||un(n.yaw))&&(n.pitch===void 0||un(n.pitch))&&(n.appearance===void 0||ql(n.appearance)))?e:null;case"actor_joined":return Xn(e.actor)&&dn(e.actor,["id","state","yaw","pitch","appearance"])&&t(e.actor.id)&&ar(e.actor.state)&&un(e.actor.yaw)&&un(e.actor.pitch)&&ql(e.actor.appearance)?e:null;case"actor_removed":return t(e.id)?e:null;case"explosives":{const n=r=>typeof r=="string"&&/^tnt-[1-9][0-9]{0,15}$/.test(r),s=r=>Array.isArray(r)&&r.length===3&&r.every(un)&&Sa(r[0],r[1],r[2]);return dn(e,["type","reset","upsert","removed"])&&typeof e.reset=="boolean"&&Array.isArray(e.upsert)&&e.upsert.length<=64&&e.upsert.every(r=>Xn(r)&&dn(r,["id","revision","state","position","remaining","total"])&&n(r.id)&&je(r.revision)&&je(r.state,1,65534)&&s(r.position)&&je(r.total,30,900)&&je(r.remaining,0,r.total))&&Array.isArray(e.removed)&&e.removed.length<=64&&e.removed.every(n)?e:null}case"explosion":return dn(e,["type","sequence","id","position","radius","removed","cancelled","columns"])&&je(e.sequence,1)&&typeof e.id=="string"&&/^tnt-[1-9][0-9]{0,15}$/.test(e.id)&&Array.isArray(e.position)&&e.position.length===3&&e.position.every(un)&&Sa(e.position[0],e.position[1],e.position[2])&&je(e.radius,1,4)&&je(e.removed,0,729)&&typeof e.cancelled=="boolean"&&Array.isArray(e.columns)&&e.columns.length<=9&&e.columns.every(M_)&&(!e.cancelled||e.removed===0&&e.columns.length===0)?e:null;case"hit":return dn(e,["type","sequence","attacker","target","position","damage","dead"])&&je(e.sequence,1)&&t(e.attacker)&&t(e.target)&&Array.isArray(e.position)&&e.position.length===3&&e.position.every(un)&&Sa(e.position[0],e.position[1],e.position[2])&&je(e.damage,1,20)&&typeof e.dead=="boolean"?e:null;case"vitals":return dn(e,["type","epoch","view"])&&je(e.epoch,1)&&b_(e.view)?e:null;case"inventory":return dn(e,["type","epoch","view"])&&je(e.epoch,1)&&d_(e.view,ba)?e:null;case"mining":return dn(e,["type","epoch","target","elapsed","total"])&&je(e.epoch,1)&&(e.target===null?e.elapsed===0&&e.total===0:ba(e.target)&&je(e.total,1,30*3600)&&je(e.elapsed,0,e.total))?e:null;case"drops":{const n=s=>typeof s=="string"&&/^drop-[1-9][0-9]{0,15}$/.test(s);return dn(e,["type","reset","upsert","removed"])&&typeof e.reset=="boolean"&&Array.isArray(e.upsert)&&e.upsert.length<=64&&e.upsert.every(s=>Xn(s)&&dn(s,["id","revision","stack","position"])&&n(s.id)&&je(s.revision)&&Ar(s.stack)&&Array.isArray(s.position)&&s.position.length===3&&s.position.every(un)&&s.position[0]>=sn.minX&&s.position[0]<sn.maxX&&s.position[1]>=0&&s.position[1]<256&&s.position[2]>=sn.minZ&&s.position[2]<sn.maxZ)&&Array.isArray(e.removed)&&e.removed.length<=64&&e.removed.every(n)?e:null}case"unload":return Ni(e.x)&&Ni(e.z)&&je(e.subscription,1)?e:null;case"result":return je(e.epoch,1)&&je(e.sequence,1)&&["applied","cached","retired","stale_epoch","invalid"].includes(e.status)&&(e.outcome===void 0||Xn(e.outcome)&&typeof e.outcome.ok=="boolean"&&typeof e.outcome.reason=="string"&&e.outcome.reason.length<64&&(e.outcome.cell===void 0||ba(e.outcome.cell))&&(e.outcome.state===void 0||je(e.outcome.state,0,65534))&&(e.outcome.revision===void 0||je(e.outcome.revision)))?e:null;case"error":return["INVALID","INCOMPATIBLE","UNAUTHORIZED","RECOVERING","REPLACED","INTERNAL","SESSION_ENDED"].includes(e.code)&&typeof e.retryable=="boolean"&&(e.code!=="SESSION_ENDED"||e.retryable===!1)?e:null;default:return null}}function Zt(i,e){return`${i},${e}`}function Sa(i,e,t){return i>=sn.minX&&i<sn.maxX&&t>=sn.minZ&&t<sn.maxZ&&e>=0&&e<256}function Ma(i,e,t){const n=[];for(let s=-t;s<=t;s++)for(let r=-t;r<=t;r++)Ni(i+r)&&Ni(e+s)&&n.push({x:i+r,z:e+s});return n}class T_{group=new si;sun=new kt(new Er(2.4,16),new kn({color:16768914,depthWrite:!1}));moon=new kt(new Er(1.6,16),new kn({color:14411770,depthWrite:!1}));stars;rain;rainPositions=new Float32Array(576);clouds=new xs(new pn(18,1.5,12),new kn({color:16777215,transparent:!0,opacity:.3,depthWrite:!1}),16);matrix=new Je;direction=new G;disposed=!1;stats={rainLines:0,stars:!1,clouds:16,sun:!1,moon:!1};constructor(e){const t=new Tt,n=new Float32Array(192);for(let r=0;r<64;r++){const a=r*2.399963229728653,o=(r+.5)/64,l=Math.sqrt(1-o*o);n.set([Math.cos(a)*l*100,o*100,Math.sin(a)*l*100],r*3)}t.setAttribute("position",new Rt(n,3)),this.stars=new wc(t,new Io({color:14478079,size:.3,transparent:!0,opacity:0,depthWrite:!1,sizeAttenuation:!0}));const s=new Tt;s.setAttribute("position",new Rt(this.rainPositions,3).setUsage(oi)),this.rain=new Mc(s,new Lo({color:10468052,transparent:!0,opacity:0,depthWrite:!1})),this.rain.frustumCulled=this.clouds.frustumCulled=this.stars.frustumCulled=!1,this.group.add(this.sun,this.moon,this.stars,this.rain,this.clouds),e.add(this.group)}update(e,t,n,s){if(this.disposed)return;const r=e,a=t.position;this.direction.set(...r.sun),this.sun.position.copy(a).addScaledVector(this.direction,80),this.moon.position.copy(a).addScaledVector(this.direction,-80),this.sun.quaternion.copy(t.quaternion),this.moon.quaternion.copy(t.quaternion),this.sun.visible=r.sun[1]>-.05,this.moon.visible=r.sun[1]<.05,this.stars.position.copy(a),this.stars.material.opacity=Math.max(0,(.3-r.daylight)*3)*(1-r.rain),this.stars.visible=this.stars.material.opacity>.01;for(let l=0;l<16;l++){const c=((l*59+r.seconds*r.wind[0]-n[0])%224+224)%224-112,u=((l*83+r.seconds*r.wind[1]-n[2])%224+224)%224-112;this.matrix.makeScale(1+l%3*.4,1,1+l%2*.5).setPosition(a.x+c,118+l%3,a.z+u),this.clouds.setMatrixAt(l,this.matrix)}this.clouds.instanceMatrix.needsUpdate=!0;const o=this.clouds.material;if(o.opacity=.18+r.rain*.38,o.color.setRGB(r.daylight*(.85-r.rain*.35),r.daylight*(.9-r.rain*.35),r.daylight*(.98-r.rain*.3)),this.rain.visible=r.rain>.01&&s,Object.assign(this.stats,{rainLines:this.rain.visible?96:0,stars:this.stars.visible,sun:this.sun.visible,moon:this.moon.visible}),this.rain.visible){for(let l=0;l<96;l++){const c=l*37%97/97*20-10,u=l*53%101/101*20-10,h=12-(r.seconds*12+l*.733)%16;this.rainPositions.set([c,h,u,c-r.wind[0]*.15,h+.65,u-r.wind[1]*.15],l*6)}this.rain.position.copy(a),this.rain.geometry.getAttribute("position").needsUpdate=!0,this.rain.material.opacity=r.rain*(.2+r.daylight*.35)}}dispose(){if(!this.disposed){this.disposed=!0,Object.assign(this.stats,{rainLines:0,stars:!1,clouds:0,sun:!1,moon:!1}),this.group.removeFromParent();for(const e of[this.sun,this.moon,this.stars,this.rain,this.clouds]){e.geometry.dispose();for(const t of Object.keys(e.geometry.attributes))e.geometry.deleteAttribute(t);e.geometry.setIndex(null),e.material.dispose()}this.clouds.dispose(),this.clouds.instanceMatrix=new ho(new Float32Array(0),16),this.rainPositions=new Float32Array(0),this.rain.geometry.setAttribute("position",new Rt(this.rainPositions,3)),this.group.clear()}}}function Gc(i){let e=2166136261;for(let t=0;t<i.length;t++)e=Math.imul(e^i.charCodeAt(t),16777619);return e>>>0}function Vc(i,e,t=Gc(i.id)){return i.flying?0:Math.sin(e*10+t%16)*Math.min(.7,i.speed*.13)}function _o(i,e=!1){const t=i[0].index!==null,n=new Set(Object.keys(i[0].attributes)),s=new Set(Object.keys(i[0].morphAttributes)),r={},a={},o=i[0].morphTargetsRelative,l=new Tt;let c=0;for(let u=0;u<i.length;++u){const h=i[u];let d=0;if(t!==(h.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const f in h.attributes){if(!n.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+'. All geometries must have compatible attributes; make sure "'+f+'" attribute exists among all geometries, or in none of them.'),null;r[f]===void 0&&(r[f]=[]),r[f].push(h.attributes[f]),d++}if(d!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". Make sure all geometries have the same number of attributes."),null;if(o!==h.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const f in h.morphAttributes){if(!s.has(f))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+".  .morphAttributes must be consistent throughout all geometries."),null;a[f]===void 0&&(a[f]=[]),a[f].push(h.morphAttributes[f])}if(e){let f;if(t)f=h.index.count;else if(h.attributes.position!==void 0)f=h.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+u+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,f,u),c+=f}}if(t){let u=0;const h=[];for(let d=0;d<i.length;++d){const f=i[d].index;for(let _=0;_<f.count;++_)h.push(f.getX(_)+u);u+=i[d].attributes.position.count}l.setIndex(h)}for(const u in r){const h=$l(r[u]);if(!h)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+u+" attribute."),null;l.setAttribute(u,h)}for(const u in a){const h=a[u][0].length;if(h!==0){l.morphAttributes=l.morphAttributes||{},l.morphAttributes[u]=[];for(let d=0;d<h;++d){const f=[];for(let b=0;b<a[u].length;++b)f.push(a[u][b][d]);const _=$l(f);if(!_)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+u+" morphAttribute."),null;l.morphAttributes[u].push(_)}}}return l}function $l(i){let e,t,n,s=-1,r=0;for(let c=0;c<i.length;++c){const u=i[c];if(e===void 0&&(e=u.array.constructor),e!==u.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(t===void 0&&(t=u.itemSize),t!==u.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=u.normalized),n!==u.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(s===-1&&(s=u.gpuType),s!==u.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;r+=u.count*t}const a=new e(r),o=new Rt(a,t,n);let l=0;for(let c=0;c<i.length;++c){const u=i[c];if(u.isInterleavedBufferAttribute){const h=l/t;for(let d=0,f=u.count;d<f;d++)for(let _=0;_<t;_++){const b=u.getComponent(d,_);o.setComponent(d+h,_,b)}}else a.set(u.array,l);l+=u.count*t}return s!==void 0&&(o.gpuType=s),o}function Rr(i){let e=[[0,0,0,16,16,16]];if(i.shape==="air")return new Tt;i.shape==="slab"&&(e=[[0,i.top?8:0,0,16,i.top?16:8,16]]),i.shape==="stairs"&&(e=[[0,i.top?8:0,0,16,i.top?16:8,16],[0,i.top?0:8,0,16,i.top?8:16,8]]),i.shape==="torch"&&(e=[[7,0,7,9,10,9]]),i.shape==="wall_torch"&&(e=[[7,3,14,9,13,16]]),i.shape==="boxes"&&(e=i.boxes??[]),i.shape==="fence"&&(e=[[6,0,6,10,16,10]]),i.shape==="pane"&&(e=[[7,0,7,9,16,9]]),i.shape==="post"&&(e=[[6,0,6,10,16,10]]);const t=[];if(i.shape==="cross")for(const s of[-Math.PI/4,Math.PI/4]){const r=new Oi(1,1);r.setAttribute("layer",new Bt(Array(4).fill(i.tex[0]),1)),r.rotateY(s),t.push(r)}else for(const s of e){const r=new pn((s[3]-s[0])/16,(s[4]-s[1])/16,(s[5]-s[2])/16);r.translate((s[0]+s[3])/32-.5,(s[1]+s[4])/32-.5,(s[2]+s[5])/32-.5);const a=r.getAttribute("position"),o=r.getAttribute("normal"),l=r.getAttribute("uv"),c=new Float32Array(a.count);for(let u=0;u<a.count;u++){const h=a.getX(u)+.5,d=a.getY(u)+.5,f=a.getZ(u)+.5,_=o.getX(u),b=o.getY(u),m=o.getZ(u),p=_>0?0:_<0?1:b>0?2:b<0?3:m>0?4:5;l.setXY(u,_?_>0?1-f:f:m?m>0?h:1-h:h,b?b>0?1-f:f:d),c[u]=i.tex[p]}r.setAttribute("layer",new Rt(c,1)),t.push(r)}if(!t.length)return new Tt;const n=_o(t,!1);for(const s of t)s.dispose();if(!n)throw new Error("invalid held block geometry");return n.rotateY(-(i.turn??i.facing??0)*Math.PI/2),n}const Hc=`precision highp float; in vec3 position,normal;in vec2 uv;in float layer;
#ifdef INSTANCED_ITEMS
in mat4 instanceMatrix;
#endif
uniform mat4 modelViewMatrix,projectionMatrix;uniform mat3 normalMatrix;out vec2 vUV;out float vLayer,vShade;
void main(){vec4 p=vec4(position,1.);vec3 n=normal;
#ifdef INSTANCED_ITEMS
p=instanceMatrix*p;n=mat3(instanceMatrix)*n;
#endif
vUV=uv;vLayer=layer;vShade=.45+.55*max(dot(normalize(normalMatrix*n),normalize(vec3(.4,.8,1.))),0.);gl_Position=projectionMatrix*modelViewMatrix*p;}`,Wc=`precision highp float;precision highp sampler2DArray;in vec2 vUV;in float vLayer,vShade;
uniform sampler2DArray uAlbedo,uMaterial;uniform float uLight,uCutout,uTint,uAlpha;uniform vec3 uColor;out vec4 fragColor;
void main(){vec2 uv=clamp(vec2(vUV.x,1.-vUV.y),vec2(.001),vec2(.999));vec4 a=texture(uAlbedo,vec3(uv,vLayer));
if(uCutout>.5&&a.a<.4)discard;vec3 color=a.rgb;if(uTint>1.5)color*=vec3(.46,.7,.3);else if(uTint>.5)color=mix(color,color*vec3(.46,.7,.3),1.-a.a);
color*=uLight*vShade*uColor;color+=a.rgb*texture(uMaterial,vec3(uv,vLayer)).a*2.;color=pow(color/(color+vec3(1.)),vec3(1./2.2));fragColor=vec4(color,uAlpha);}`;function Do(i,e,t){const n=i.places&&e.find(f=>f.name===i.places&&f.placeable!==!1);if(n&&i.model!=="bucket")return Rr(n);const s=e.find(f=>f.name==="oak_planks")??e[1],r=e.find(f=>f.name==="stone")??s,a=i.material?e.find(f=>f.name===i.material):void 0,o=(f,_)=>Rr({..._,shape:"boxes",boxes:f,turn:0,facing:0}),l={bucket:[[3,2,3,13,4,13],[2,4,2,4,12,14],[12,4,2,14,12,14],[4,4,2,12,12,4],[4,4,12,12,12,14],[2,12,7,4,16,9],[12,12,7,14,16,9],[4,14,7,12,16,9]],ingot:[[3,5,5,13,10,11]],gem:[[5,3,5,11,13,11],[3,5,6,13,11,10],[6,5,3,10,11,13]],fiber:[[3,2,6,13,4,8],[4,6,7,12,8,9],[3,10,6,13,12,8]],grain:[[3,1,6,5,14,8],[7,0,7,9,15,9],[11,2,6,13,14,8],[2,11,5,6,15,9],[6,12,6,10,16,10],[10,10,5,14,14,9]],loaf:[[2,3,4,14,9,12],[4,9,5,12,12,11]],cookie:[[3,4,3,13,7,13],[5,4,2,11,7,14]],melon:[[2,3,6,14,7,10],[4,7,6,12,10,10],[6,10,6,10,12,10]],carrot:[[6,1,6,10,6,10],[5,6,5,11,11,11],[4,11,4,12,14,12],[7,14,7,9,16,9]],potato:[[3,4,4,13,11,12],[5,3,5,11,12,11]],cake:[[2,2,2,14,9,14],[1,9,1,15,11,15],[5,11,5,7,13,7],[10,11,9,12,13,11]],sheet:[[2,7,2,14,8,14]],armor:[[1,3,6,15,14,9],[1,12,6,4,16,12],[12,12,6,15,16,12]]};if(i.model==="bucket"&&i.remainder&&n){const f=o(l.bucket,a??r),_=o([[4,4,4,12,10,12]],n),b=_o([f,_],!1);return f.dispose(),_.dispose(),b}if(i.model&&l[i.model])return o(l[i.model],a??s);if(i.model==="talisman"||i.model==="medallion")return o(i.model==="medallion"?[[5,5,6,11,11,9],[7,11,7,9,15,8]]:[[7,2,6,9,12,9],[4,4,6,7,10,9],[9,6,6,12,12,9]],i.perks?.vision?e.find(f=>f.name==="glowstone")??r:i.perks?.sunRegen?e.find(f=>f.name==="sand")??r:e.find(f=>f.name==="oak_leaves")??s);if(i.model==="powder")return o([[3,0,3,13,4,13],[5,4,5,11,7,11]],a??{...r,tex:Array(6).fill(e.find(f=>f.name==="bedrock")?.tex[0]??r.tex[0])});if(i.model==="igniter")return o([[3,3,6,7,12,10],[9,2,6,13,9,10]],r);if(i.model==="shield")return o([[2,1,6,14,16,9],[4,0,6,12,3,9],[6,5,9,10,12,12]],s);if(i.model==="apple")return o([[4,3,4,12,11,12],[7,11,7,9,14,9]],e.find(f=>f.name==="oak_log")??s);if(i.model==="boots")return o(t==="feet"?[[5,0,2,11,5,13],[5,5,6,11,10,13]]:[[2,0,2,6,5,13],[10,0,2,14,5,13],[2,5,6,6,10,13],[10,5,6,14,10,13]],i.modifiers?.jump?e.find(f=>f.name==="glass")??r:s);const c=o([[7,0,7,9,13,9]],s);if(i.model==="stick")return c;const u=i.model==="pickaxe"?[[2,12,7,14,14,9],[1,10,7,3,13,9],[13,10,7,15,13,9]]:i.model==="axe"?[[5,10,6,12,15,10]]:[[5,11,6,11,16,10]],h=o(u,a??(i.activation==="held"?e.find(f=>f.name==="sand")??r:(i.tool?.tier??1)>=2?r:s)),d=_o([c,h],!1);if(c.dispose(),h.dispose(),!d)throw new Error("invalid item model");return d}function Xc(i,e,t=!1){return new Ir({vertexShader:Hc,fragmentShader:Wc,glslVersion:ms,defines:t?{INSTANCED_ITEMS:1}:{},side:jt,uniforms:{uAlbedo:{value:i},uMaterial:{value:e},uLight:{value:1},uCutout:{value:0},uTint:{value:0},uAlpha:{value:1},uColor:{value:new G(1,1,1)}}})}function qc(i,e,t,n){const s=Xc(t,n,!0),r=e.find(a=>i.model==="bucket"?a.name===i.material:a.name===i.places&&a.placeable!==!1);return s.uniforms.uCutout.value=r?.layer===1?1:0,s.uniforms.uTint.value=r?.tint?r.layer===1?2:1:0,s.transparent=r?.layer===2,s.depthWrite=r?.layer!==2,s.uniforms.uAlpha.value=r?.layer===2?.65:1,s.uniforms.uColor.value.set(...i.color??(i.model==="apple"?[1.5,.15,.1]:[1,1,1])),s}class E_{scene=new xc;camera=new Jt(55,1,.01,4);grip=new si;hand=new kt(new pn(.16,.45,.16),new kn({color:new Qe().setRGB(.76,.54,.35)}));sleeve=new kt(new pn(.17,.22,.17),new kn({color:new Qe().setRGB(.15,.33,.4)}));block;state=-1;itemType=null;swingAt=-1/0;disposed=!1;stats={state:-1,itemType:null,visible:!1,swings:0};blocks;items;constructor(e,t,n,s){this.blocks=e,this.items=t,this.block=new kt(new Tt,new Ir({vertexShader:Hc,fragmentShader:Wc,glslVersion:ms,side:jt,uniforms:{uAlbedo:{value:n},uMaterial:{value:s},uLight:{value:1},uCutout:{value:0},uTint:{value:0},uAlpha:{value:1},uColor:{value:new G(1,1,1)}}})),this.hand.position.set(0,-.22,.08),this.sleeve.position.set(0,-.38,.09),this.block.scale.setScalar(.28),this.block.position.set(0,.04,-.06),this.grip.add(this.hand,this.sleeve,this.block),this.scene.add(this.grip)}swing(e){this.swingAt=e,this.stats.swings++}clear(){this.swingAt=-1/0,this.stats.visible=!1}draw(e,t,n,s,r,a,o,l){if(this.disposed||(this.stats.visible=o,!o))return!1;const c=this.items.find(b=>b.itemType===l),u=c?.model==="bucket"&&this.blocks.find(b=>b.name===c.material)||c?.places&&this.blocks.find(b=>b.name===c.places&&b.placeable!==!1)||this.blocks[n];u&&(n!==this.state||l!==this.itemType)&&(this.block.geometry.dispose(),this.block.geometry=c?Do(c,this.blocks):Rr(u),this.state=this.stats.state=n,this.itemType=this.stats.itemType=l,this.block.material.uniforms.uColor.value.set(...c?.color??(c?.model==="apple"?[1.5,.15,.1]:[1,1,1])),this.block.material.uniforms.uCutout.value=u.layer===1?1:0,this.block.material.uniforms.uTint.value=u.tint?u.layer===1?2:1:0,this.block.material.uniforms.uAlpha.value=u.layer===2?.65:1,this.block.material.transparent=u.layer===2,this.block.material.needsUpdate=!0),this.block.visible=!!c||!!u&&u.shape!=="air",this.block.material.uniforms.uLight.value=.2+a*.8;const h=Math.max(0,(r-this.swingAt)/260),d=h<1?Math.sin(h*Math.PI):0,f=Math.min(1,s/4)*Math.sin(r/95);this.grip.position.set(.34-d*.1,-.29+f*.012-d*.07,-.7+d*.18),this.grip.rotation.set(-.15+d*.8,.35-d*.2,-.1),this.hand.material.color.setRGB(.76,.54,.35).multiplyScalar(.2+a*.8),this.sleeve.material.color.setRGB(.15,.33,.4).multiplyScalar(.2+a*.8),this.camera.aspect!==t&&(this.camera.aspect=t,this.camera.updateProjectionMatrix());const _=e.autoClear;return e.autoClear=!1,e.clearDepth(),e.render(this.scene,this.camera),e.autoClear=_,!0}dispose(){if(!this.disposed){this.disposed=!0;for(const e of[this.hand,this.sleeve,this.block]){e.geometry.dispose();for(const t of Object.keys(e.geometry.attributes))e.geometry.deleteAttribute(t);e.geometry.setIndex(null),e.material.dispose()}this.grip.clear(),this.scene.clear(),this.stats.visible=!1,this.stats.state=-1}}}class A_{scene;blocks;items;albedo;surface;batches=new Map;root=new Je;local=new Je;scratch=new Je;matrix=new Je;sampleRefs=[];disposed=!1;stats={visible:0,held:0,worn:0,kinds:0,capacity:0};constructor(e,t,n,s,r){this.scene=e,this.blocks=t,this.items=new Map(n.map(a=>[a.itemType,a])),this.albedo=s,this.surface=r}get samples(){return this.sampleRefs.map(({id:e,itemType:t,slot:n,side:s,batch:r,index:a})=>(r.mesh.getMatrixAt(a,this.matrix),{id:e,itemType:t,slot:n,side:s,position:this.matrix.elements.slice(12,15),vertices:r.mesh.geometry.getAttribute("position").count}))}update(e,t,n,s){if(this.disposed)return;const r=new Map,a=(u,h,d,f=0)=>{if(!h)return;const _=this.items.get(h);if(!_||d!=="held"&&_.equipment!==d)throw new Error("invalid avatar equipment");const b=`${h}:${d==="feet"?"foot":"item"}`,m=r.get(b)??[];m.push({actor:u,item:_,slot:d,side:f}),r.set(b,m)};for(const u of e){a(u,u.appearance.held,"held");for(const h of li)if(h==="feet")for(const d of[-1,1])a(u,u.appearance.equipment[h],h,d);else a(u,u.appearance.equipment[h],h)}this.sampleRefs=[];for(const[u,h]of this.batches)r.has(u)||(this.release(h),this.batches.delete(u));let o=0,l=0,c=0;for(const[u,h]of r){let d=this.batches.get(u),f=8;for(;f<h.length;)f*=2;if(!d||f>d.capacity||f*4<d.capacity){d&&this.release(d);const _=h[0],b=new xs(Do(_.item,this.blocks,_.slot==="feet"?"feet":void 0),qc(_.item,this.blocks,this.albedo,this.surface),f);b.frustumCulled=!1,b.instanceMatrix.setUsage(oi),this.scene.add(b),d={mesh:b,capacity:f},this.batches.set(u,d)}d.mesh.count=h.length,d.mesh.material.uniforms.uLight.value=.2+s*.8;for(const[_,b]of h.entries())this.pose(b,t,n),d.mesh.setMatrixAt(_,this.matrix),this.sampleRefs.length<24&&this.sampleRefs.push({id:b.actor.id,itemType:b.item.itemType,slot:b.slot,side:b.side,batch:d,index:_}),b.slot==="held"&&l++;d.mesh.instanceMatrix.needsUpdate=!0,o+=h.length,c+=d.capacity}Object.assign(this.stats,{visible:o,held:l,worn:o-l,kinds:r.size,capacity:c})}pose(e,t,n){const{actor:s,slot:r,side:a,item:o}=e,l=Vc(s,n);this.root.makeRotationY(-s.yaw).setPosition(s.position[0]-t.x,s.position[1],s.position[2]-t.z);let c=.5;if(r==="held"||r==="offhand"){const u=r==="held"?1:-1;this.local.makeTranslation(u*.36,1.32,0).multiply(this.scratch.makeRotationX(l*u)).multiply(this.scratch.makeTranslation(0,-.48,-.12)),r==="held"&&this.local.multiply(this.scratch.makeRotationZ(-.2)),c=r==="offhand"?.8:o.places?.34:.65}else r==="feet"?(this.local.makeTranslation(a*.14,.8,0).multiply(this.scratch.makeRotationX(-l*a)).multiply(this.scratch.makeTranslation(0,-.5,-.035)),c=.62):r==="head"?(this.local.makeTranslation(0,1.58,0).multiply(this.scratch.makeRotationX(s.pitch)).multiply(this.scratch.makeTranslation(0,.12,-.25)),c=.45):r==="body"?(this.local.makeTranslation(0,1.05,-.19),c=.65):this.local.makeTranslation(.25,.85,-.19);this.local.multiply(this.scratch.makeScale(c,c,c)),this.matrix.multiplyMatrices(this.root,this.local)}release(e){e.mesh.removeFromParent(),e.mesh.geometry.dispose(),e.mesh.material.dispose(),e.mesh.dispose()}clear(){for(const e of this.batches.values())this.release(e);this.batches.clear(),this.sampleRefs=[],Object.assign(this.stats,{visible:0,held:0,worn:0,kinds:0,capacity:0})}dispose(){this.disposed||(this.disposed=!0,this.clear())}}const Zl=[5088934,8361941,13012581,8628328,12026282].map(i=>new Qe(i)),R_=new Qe().setRGB(.76,.54,.35),C_=new Qe().setRGB(.12,.19,.27);class P_{geometry=new pn(1,1,1);material=new kn({color:16777215});faceGeometry=new Oi(1,1);faceTexture;faceMaterial;parts=[];capacity=8;base=new Je;local=new Je;transform=new Je;rotation=new Je;color=new Qe;disposed=!1;equipment;scene;get gear(){return{...this.equipment.stats,samples:this.equipment.samples}}sampleActors=[];sampleMatrix=new Je;stats={visible:0,capacity:8};get samples(){return this.sampleActors.map(({id:e,index:t})=>{this.parts[0].getMatrixAt(t,this.sampleMatrix);const n=[this.sampleMatrix.elements[12],this.sampleMatrix.elements[13],this.sampleMatrix.elements[14]];return this.parts[1].getMatrixAt(t,this.sampleMatrix),{id:e,head:n,yaw:Math.atan2(this.sampleMatrix.elements[2],this.sampleMatrix.elements[0])}})}constructor(e,t,n,s,r){this.scene=e,this.equipment=new A_(e,t,n,s,r);const a=new Uint8Array(256),o=(l,c,u,h,d)=>a.set([u,h,d,255],(c*8+l)*4);for(const l of[2,5])o(l,4,245,245,235),o(l,3,25,35,45);for(const l of[3,4])o(l,1,70,42,33);this.faceTexture=new Di(a,8,8),this.faceTexture.magFilter=this.faceTexture.minFilter=At,this.faceTexture.needsUpdate=!0,this.faceMaterial=new kn({map:this.faceTexture,transparent:!0,alphaTest:.5}),this.allocate()}allocate(){for(const e of this.parts)e.removeFromParent(),e.dispose();this.parts=Array.from({length:7},(e,t)=>{const n=new xs(t===6?this.faceGeometry:this.geometry,t===6?this.faceMaterial:this.material,this.capacity);return n.count=0,n.frustumCulled=!1,n.instanceMatrix.setUsage(oi),this.scene.add(n),n}),this.stats.capacity=this.capacity}update(e,t,n,s,r){if(this.disposed)return;const a=e.filter(c=>Math.hypot(c.position[0]-n[0],c.position[2]-n[2])>.65||Math.abs(c.position[1]-n[1])>1.8);let o=8;for(;o<a.length;)o*=2;(o>this.capacity||o*4<this.capacity)&&(this.capacity=o,this.allocate());for(const c of this.parts)c.count=a.length;const l=.2+r*.8;for(let c=0;c<a.length;c++){const u=a[c],h=Gc(u.id),d=Vc(u,s,h);this.base.makeRotationY(-u.yaw).setPosition(u.position[0]-t.x,u.position[1],u.position[2]-t.z);for(let f=0;f<7;f++){if(f===0||f===6)this.local.makeTranslation(0,1.58,0).multiply(this.rotation.makeRotationX(u.pitch)),f===6&&this.local.multiply(this.transform.makeTranslation(0,0,-.223)).multiply(this.rotation.makeRotationY(Math.PI)),this.local.multiply(this.transform.makeScale(.44,.44,f===6?1:.44));else if(f===1)this.local.makeScale(.52,.56,.28).setPosition(0,1.08,0);else{const _=f<4,b=f%2===0,m=b?1:-1;this.local.makeTranslation(m*(_?.36:.14),_?1.32:.8,0).multiply(this.rotation.makeRotationX(d*m*(_?1:-1))).multiply(this.transform.makeTranslation(0,_?-.275:-.4,0)).multiply(this.rotation.makeScale(_?.18:.23,_?.55:.8,_?.2:.28))}this.transform.multiplyMatrices(this.base,this.local),this.parts[f].setMatrixAt(c,this.transform),f!==6&&(this.color.copy(f===0||f===2||f===3?R_:f===1?Zl[h%Zl.length]:C_).multiplyScalar(l),this.parts[f].setColorAt(c,this.color))}}this.faceMaterial.color.setRGB(l,l,l);for(const c of this.parts)c.instanceMatrix.needsUpdate=!0,c.instanceColor&&(c.instanceColor.needsUpdate=!0);this.stats.visible=a.length,this.sampleActors=a.slice(0,8).map((c,u)=>({id:c.id,index:u})),this.equipment.update(a,t,s,r)}clear(){for(const e of this.parts)e.count=0;this.sampleActors=[],this.stats.visible=0,this.equipment.clear()}dispose(){if(!this.disposed){this.disposed=!0,this.equipment.dispose();for(const e of this.parts)e.removeFromParent(),e.dispose();this.parts=[],this.sampleActors=[];for(const e of[this.geometry,this.faceGeometry]){e.dispose();for(const t of Object.keys(e.attributes))e.deleteAttribute(t);e.setIndex(null)}this.material.dispose(),this.faceMaterial.dispose(),this.faceTexture.dispose(),this.faceTexture.image.data=new Uint8Array(0),this.stats.visible=this.stats.capacity=0}}}class L_{constructor(e,t,n,s,r){this.scene=e,this.blocks=t,this.items=n,this.albedo=s,this.surface=r}batches=new Map;matrix=new Je;rotation=new ui;position=new G;scale=new G(.25,.25,.25);euler=new $n;disposed=!1;stats={visible:0,kinds:0};update(e,t,n,s){if(this.disposed)return;const r=new Map;for(const a of e){const o=r.get(a.stack.itemType)??[];o.push(a),r.set(a.stack.itemType,o)}for(const[a,o]of this.batches)r.has(a)||(this.release(o),this.batches.delete(a));for(const[a,o]of r){const l=this.items.find(h=>h.itemType===a);if(!l)continue;let c=this.batches.get(a),u=8;for(;u<o.length;)u*=2;if(!c||u>c.capacity||u*4<c.capacity){c&&this.release(c);const h=qc(l,this.blocks,this.albedo,this.surface),d=new xs(Do(l,this.blocks),h,u);d.frustumCulled=!1,d.instanceMatrix.setUsage(oi),this.scene.add(d),c={mesh:d,capacity:u},this.batches.set(a,c)}c.mesh.visible=!0,c.mesh.count=o.length,c.mesh.material.uniforms.uLight.value=.2+s*.8,o.forEach((h,d)=>{const f=Number(h.id.slice(5))%17;this.position.set(h.position[0]-t.x,h.position[1]+.16+Math.sin(n*2+f)*.035,h.position[2]-t.z),this.rotation.setFromEuler(this.euler.set(0,n*.7+f,0)),c.mesh.setMatrixAt(d,this.matrix.compose(this.position,this.rotation,this.scale))}),c.mesh.instanceMatrix.needsUpdate=!0}this.stats.visible=e.length,this.stats.kinds=r.size}clear(){for(const e of this.batches.values())this.release(e);this.batches.clear(),this.stats.visible=this.stats.kinds=0}release(e){e.mesh.removeFromParent(),e.mesh.geometry.dispose(),e.mesh.material.dispose(),e.mesh.dispose()}dispose(){this.disposed||(this.disposed=!0,this.clear())}}class I_{constructor(e,t,n,s){this.scene=e,this.blocks=t,this.albedo=n,this.material=s}meshes=[];geometry=null;capacity=0;state=-1;matrix=new Je;stats={visible:0,capacity:0,flashing:0};update(e,t,n){if(!e.length){this.clear();return}let s=8;for(;s<e.length;)s*=2;(this.capacity<s||this.capacity>s*4||this.state!==e[0].state)&&(this.clear(),this.capacity=s,this.state=e[0].state,this.geometry=Rr(this.blocks[this.state]),this.meshes=[!1,!0].map(a=>{const o=Xc(this.albedo,this.material,!0);o.uniforms.uColor.value.setScalar(a?3:1);const l=new xs(this.geometry,o,s);return l.frustumCulled=!1,l.instanceMatrix.setUsage(oi),this.scene.add(l),l}));const r=[0,0];for(const a of e){const o=a.remaining%12<6?1:0;this.matrix.makeScale(.9,.9,.9),this.matrix.setPosition(a.position[0]-t.x,a.position[1]+.45,a.position[2]-t.z),this.meshes[o].setMatrixAt(r[o]++,this.matrix)}this.meshes.forEach((a,o)=>{a.count=r[o],a.visible=r[o]>0,a.instanceMatrix.needsUpdate=!0,a.material.uniforms.uLight.value=.25+n*.75}),this.stats.visible=e.length,this.stats.capacity=this.capacity,this.stats.flashing=r[1]}clear(){for(const e of this.meshes)e.removeFromParent(),e.material.dispose(),e.dispose();this.geometry?.dispose(),this.geometry=null,this.meshes=[],this.capacity=0,this.state=-1,this.stats.visible=this.stats.capacity=this.stats.flashing=0}dispose(){this.clear()}}class D_{fence=null;disposed=!1;stats={submitted:0,skipped:0,pending:0,failures:0};gl;constructor(e){this.gl=e}begin(){if(this.disposed)return!1;if(this.gl.isContextLost())return this.reset(),this.stats.skipped++,!1;if(!this.fence)return!0;const e=this.gl.clientWaitSync(this.fence,0,0);if(e===this.gl.TIMEOUT_EXPIRED)return this.stats.skipped++,!1;if(this.reset(),e!==this.gl.ALREADY_SIGNALED&&e!==this.gl.CONDITION_SATISFIED)throw this.stats.failures++,new Error("GPU completion poll failed");return!0}finish(){if(this.disposed||this.gl.isContextLost()){this.reset();return}if(this.fence)throw new Error("GPU frame is already pending");const e=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!e)throw this.stats.failures++,new Error("GPU completion fence unavailable");this.fence=e,this.stats.pending=1,this.stats.submitted++,this.gl.flush()}reset(){this.fence&&this.gl.deleteSync(this.fence),this.fence=null,this.stats.pending=0}dispose(){this.disposed||(this.disposed=!0,this.reset())}}class U_{constructor(e,t,n,s){this.blocks=s,this.palette=Array.from({length:n},(a,o)=>{const l=[0,0,0];for(let c=0;c<256;c+=8)for(let u=0;u<3;u++)l[u]+=t[(o*256+c)*4+u]/8160;return l});const r=new Tt;r.setAttribute("position",new Rt(this.positions,3).setUsage(oi)),r.setAttribute("color",new Rt(this.colors,3).setUsage(oi)),this.points=new wc(r,new Io({vertexColors:!0,size:.055,sizeAttenuation:!0})),this.points.frustumCulled=!1,this.points.visible=!1,e.add(this.points)}particles=[];positions=new Float32Array(384);colors=new Float32Array(384);points;palette;disposed=!1;stats={live:0,bursts:0,hits:0,explosions:0};burst(e,t,n,s){if(this.disposed)return;const r=this.palette[this.blocks[t]?.tex[2]??0]??[.6,.6,.6],a=s?12:6;for(let o=0;o<a;o++){this.particles.length>=128&&this.particles.shift();const l=o*2.399963+this.stats.bursts,c=s?.25:.6;this.particles.push({x:e[0]+.5+Math.cos(l)*c,y:e[1]+.55,z:e[2]+.5+Math.sin(l)*c,vx:Math.cos(l)*1.6,vy:1+o%4*.4,vz:Math.sin(l)*1.6,started:n,color:r})}this.stats.bursts++}hit(e,t){if(!this.disposed){for(let n=0;n<8;n++){this.particles.length>=128&&this.particles.shift();const s=n*2.399963+this.stats.hits;this.particles.push({x:e[0],y:e[1],z:e[2],vx:Math.cos(s)*1.2,vy:.5+n*.12,vz:Math.sin(s)*1.2,started:t,color:[1,.72,.25]})}this.stats.bursts++,this.stats.hits++}}explosion(e,t,n){if(!this.disposed){for(let s=0;s<40;s++){this.particles.length>=128&&this.particles.shift();const r=s*2.399963+this.stats.explosions;this.particles.push({x:e[0],y:e[1],z:e[2],vx:Math.cos(r)*t*(.5+s%4*.25),vy:1+s%6*.5,vz:Math.sin(r)*t*(.5+s%4*.25),started:n,color:s%3===0?[1,.6,.15]:[.6,.58,.54]})}this.stats.bursts++,this.stats.explosions++}}clear(){this.particles=[],this.points.visible=!1,this.stats.live=0}frame(e,t,n){if(!this.disposed){this.particles=this.particles.filter(s=>e-s.started<650);for(let s=0;s<this.particles.length;s++){const r=this.particles[s],a=Math.max(0,(e-r.started)/1e3);this.positions.set([r.x+r.vx*a-t.x,r.y+r.vy*a-6*a*a,r.z+r.vz*a-t.z],s*3),this.colors.set(r.color.map(o=>o*(.2+n*.8)),s*3)}this.points.visible=this.particles.length>0,this.points.geometry.setDrawRange(0,this.particles.length),this.points.geometry.getAttribute("position").needsUpdate=!0,this.points.geometry.getAttribute("color").needsUpdate=!0,this.stats.live=this.particles.length}}dispose(){this.disposed||(this.disposed=!0,this.points.removeFromParent(),this.points.geometry.dispose(),this.points.material.dispose(),this.points.geometry.deleteAttribute("position"),this.points.geometry.deleteAttribute("color"),this.positions=this.colors=new Float32Array(0),this.particles=[],this.palette=[],this.stats.live=0)}}const Kc=`precision highp float; precision highp int; precision highp sampler2D; precision highp sampler2DArray;
`,k_=Kc+e_+t_+`
uniform mat4 modelMatrix,modelViewMatrix,projectionMatrix; uniform vec3 uWorldOrigin;
out vec2 vUV; out vec3 vNormal; out vec3 vWorld; out vec4 vLight; flat out uint vLayer; flat out uint vFlags;
void main(){vec3 origin=modelMatrix[3].xyz+uWorldOrigin; Vtx v=unpackVertex(origin);vec4 view=modelViewMatrix*vec4(v.pos,1.0);gl_Position=projectionMatrix*view;vUV=v.uv;vNormal=v.normal;vWorld=origin+v.pos;vLight=vec4(v.sky,v.blk,v.ao,v.tint);vLayer=v.layer;vFlags=(v.normalIdx>=6u?1u:0u)|(v.fine?4u:0u);}`,N_=Kc+`
uniform sampler2DArray uAlbedo,uMaterial;uniform sampler2D uBiome;uniform vec3 uCamera,uSky,uSun;uniform float uFogEnd,uDaylight,uVision;
in vec2 vUV;in vec3 vNormal;in vec3 vWorld;in vec4 vLight;flat in uint vLayer;flat in uint vFlags;out vec4 fragColor;
void main(){vec2 dx=dFdx(vUV),dy=dFdy(vUV);vec2 uv=vec2(fract(vUV.x),1.0-fract(vUV.y));
if((vFlags&4u)!=0u){vec2 c=clamp(vUV,vec2(.001),vec2(.999));uv=vec2(c.x,1.-c.y);}
vec4 albedo=textureGrad(uAlbedo,vec3(uv,float(vLayer)),dx,dy);vec4 material=textureGrad(uMaterial,vec3(uv,float(vLayer)),dx,dy);
#ifdef CUTOUT
if(albedo.a<.45)discard;
#endif
vec3 base=albedo.rgb;if(vLight.w>.5){vec3 tint=texture(uBiome,vWorld.xz/1024.).rgb;
#ifdef CUTOUT
base*=tint;
#else
base=mix(base,base*tint,1.-albedo.a);
#endif
}
float ao=.38+.62*vLight.z*vLight.z;float sun=max(dot(normalize(vNormal),uSun),0.);
vec3 light=(vec3(.3,.4,.58)*vLight.x*vLight.x+vec3(.8,.72,.55)*sun*vLight.x)*uDaylight+vec3(1.,.62,.28)*pow(max(vLight.y,0.),2.2)*1.8+vec3(.028);
light=mix(light,max(light,vec3(.85)),uVision);
vec3 color=base*light*ao+base*material.a*2.;color=color/(color+vec3(1.));color=pow(color,vec3(1./2.2));
float fog=smoothstep(uFogEnd*.55,uFogEnd,length(vWorld.xz-uCamera.xz));color=mix(color,uSky,fog);
#ifdef TRANSLUCENT
fragColor=vec4(color,.65);
#else
fragColor=vec4(color,1.);
#endif
}`;class F_{gl;camera=new Jt(75,1,.05,1600);scene=new xc;columns=new Map;origin=new G;materials;textures=[];biome;tile;tileData=new Uint8Array(1024);culler;memory;uniforms;highlight=new si;avatars;environment;sky=new Qe;held;effects;drops;explosives;disposed=!1;scale;gpu;stats={uploadedBytes:0,columns:0,drawCalls:0,triangles:0,uploadMs:0,prepareMs:0};async prepare(e,t){const n=performance.now(),s=new rn(2,2);s.texture.colorSpace=this.gl.outputColorSpace;const r=this.gl.getRenderTarget();try{if(t?.aborted)throw new DOMException("Renderer preparation cancelled","AbortError");if(this.disposed||!this.gpu.begin())throw new Error("renderer is unavailable for startup");for(this.gl.setRenderTarget(s),this.held.draw(this.gl,1,e,0,0,1,!0,null),this.gl.setRenderTarget(r),this.gpu.finish();!this.gpu.begin();){if(t?.aborted)throw new DOMException("Renderer preparation cancelled","AbortError");if(this.disposed||this.gl.getContext().isContextLost())throw new Error("graphics context lost during startup");if(performance.now()-n>3e4)throw new Error("graphics startup did not complete");await new Promise(a=>setTimeout(a,10))}this.stats.prepareMs=performance.now()-n}finally{this.gpu.reset(),this.gl.setRenderTarget(r),this.held.clear(),s.dispose()}}get gpuStats(){return{...this.gpu.stats}}contextLost(){this.gpu.reset()}get atmosphere(){return{...this.environment.stats}}get actors(){return{...this.avatars.stats,samples:this.avatars.samples,equipment:this.avatars.gear}}get feedback(){return{held:{...this.held.stats},effects:{...this.effects.stats},drops:{...this.drops.stats},explosives:{...this.explosives.stats},vision:this.uniforms.uVision?.value===1}}swing(e){this.held.swing(e)}resetPresentation(){this.avatars.clear(),this.held.clear(),this.effects.clear(),this.drops.clear(),this.explosives.clear()}editEffect(e,t,n,s){this.effects.burst(e,t,n,s)}hitEffect(e,t){this.effects.hit(e,t)}explosionEffect(e,t,n){this.effects.explosion(e,t,n)}constructor(e,t,n,s,r,a,o,l=1){this.scale=Math.max(.5,Math.min(1.5,l)),this.culler=s,this.memory=r,this.gl=new jg({canvas:e,antialias:!1,alpha:!1,powerPreference:"high-performance"});const c=this.gl.getContext();if(!("fenceSync"in c))throw new Error("WebGL2 GPU synchronization is required");this.gpu=new D_(c),this.gl.setPixelRatio(Math.min(devicePixelRatio,1.5)),this.gl.setClearColor(9945824),this.gl.outputColorSpace=ps;const u=n*16*16*4,h=(p,T)=>{const P=new Co(p,16,16,n);return P.format=nn,P.magFilter=At,P.minFilter=Kn,P.generateMipmaps=!0,P.wrapS=P.wrapT=ds,P.colorSpace=T?Gt:Ln,P.needsUpdate=!0,this.textures.push(P),P},d=h(t.slice(0,u),!0),f=h(t.slice(u,u*2),!1),_=new Uint8Array(1024*4);for(let p=0;p<1024;p++)_[p*4]=p&255,_[p*4+1]=p>>8;const b=new Di(_,1024,1);b.magFilter=b.minFilter=At,b.needsUpdate=!0,this.textures.push(b);const m=new Uint8Array(1024*1024*4);for(let p=0;p<m.length;p+=4)m[p]=120,m[p+1]=185,m[p+2]=80,m[p+3]=255;this.biome=new Di(m,1024,1024),this.biome.colorSpace=Gt,this.biome.wrapS=this.biome.wrapT=ds,this.biome.magFilter=this.biome.minFilter=Ut,this.biome.needsUpdate=!0,this.tile=new Di(this.tileData,16,16),this.tile.colorSpace=Gt,this.textures.push(this.biome,this.tile),this.uniforms={uTime:{value:0},uWind:{value:new Mt(.4,.3,.5,0)},uLooks:{value:b},uAlbedo:{value:d},uMaterial:{value:f},uBiome:{value:this.biome},uWorldOrigin:{value:this.origin},uCamera:{value:new G},uFogEnd:{value:43},uSky:{value:new G(.59,.76,.88)},uSun:{value:new G(.45,.85,.3).normalize()},uDaylight:{value:1},uVision:{value:0}},this.materials=[0,1,2].map(p=>new Ir({vertexShader:k_,fragmentShader:N_,uniforms:this.uniforms,glslVersion:ms,defines:p===1?{CUTOUT:1}:p===2?{TRANSLUCENT:1}:{},side:p===0?Yn:jt,transparent:p===2,depthWrite:p!==2})),this.avatars=new P_(this.scene,a,o,d,f),this.scene.add(this.highlight),this.environment=new T_(this.scene),this.held=new E_(a,o,d,f),this.drops=new L_(this.scene,a,o,d,f),this.explosives=new I_(this.scene,a,d,f),this.effects=new U_(this.scene,t,n,a)}resize(e,t){this.gl.setSize(Math.round(e*this.scale),Math.round(t*this.scale),!1),this.camera.aspect=e/t,this.camera.updateProjectionMatrix()}tint(e,t,n){const s=n.subarray(8,776);for(let r=0;r<256;r++)this.tileData[r*4]=s[r*3],this.tileData[r*4+1]=s[r*3+1],this.tileData[r*4+2]=s[r*3+2],this.tileData[r*4+3]=255;this.gl.copyTextureToTexture(this.tile,this.biome,null,new ct((e*16%1024+1024)%1024,(t*16%1024+1024)%1024))}install(e,t,n){const s=performance.now();if(n[79]!==2||n[0]!==80||n.length!==80+(n[1]+n[2]+n[3])*8)throw new Error("mesh format mismatch");this.remove(e,t);let r=n[0];const a=[];for(let o=0;o<3;o++){const l=n[1+o];if(!l){a.push(null);continue}const c=n.subarray(r,r+l*8);r+=l*8;const u=new Tt,h=new Rt(c,2);h.gpuType=Lr,u.setAttribute("aData",h);const d=new Uint32Array(l*6);for(let _=0;_<l;_++){const b=_*4,m=_*6;d.set([b,b+1,b+2,b,b+2,b+3],m)}u.setIndex(new Rt(d,1)),u.boundingBox=new Zn(new G(0,0,0),new G(16,256,16)),u.boundingSphere=new Jn(new G(8,128,8),130);const f=new kt(u,this.materials[o]);f.frustumCulled=!1,f.position.set(e*16-this.origin.x,0,t*16-this.origin.z),this.scene.add(f),a.push(f),this.stats.uploadedBytes+=c.byteLength+d.byteLength}this.columns.set(Zt(e,t),{x:e,z:t,meshes:a,slot:this.culler.set_column(e,t,n.subarray(0,80))}),this.stats.columns=this.columns.size,this.stats.uploadMs=performance.now()-s}remove(e,t){const n=Zt(e,t),s=this.columns.get(n);if(s){for(const r of s.meshes)r&&(this.scene.remove(r),r.geometry.dispose());this.columns.delete(n),this.culler.remove_column(e,t),this.stats.columns=this.columns.size}}target(e,t){for(const n of[...this.highlight.children]){this.highlight.remove(n);const s=n;s.geometry.dispose(),s.material.dispose()}if(t)for(const n of e){const s=new qd(new pn((n[3]-n[0])/16+.004,(n[4]-n[1])/16+.004,(n[5]-n[2])/16+.004)),r=new Mc(s,new Lo({color:16777215,transparent:!0,opacity:.8}));r.position.set(t[0]+(n[0]+n[3])/32-this.origin.x,t[1]+(n[1]+n[4])/32,t[2]+(n[2]+n[5])/32-this.origin.z),this.highlight.add(r)}}frame(e,t,n,s,r,a,o,l){if(!this.disposed&&this.gpu.begin())try{const c=Math.floor(e[0]/16)*16,u=Math.floor(e[2]/16)*16;if(c!==this.origin.x||u!==this.origin.z){for(const p of this.highlight.children)p.position.x+=this.origin.x-c,p.position.z+=this.origin.z-u;this.origin.set(c,0,u);for(const p of this.columns.values())for(const T of p.meshes)T&&T.position.set(p.x*16-c,0,p.z*16-u)}this.camera.position.set(e[0]-c,e[1]+1.62,e[2]-u),this.camera.rotation.order="YXZ",this.camera.rotation.set(n,-t,0,"YXZ"),this.camera.updateMatrixWorld(),this.uniforms.uCamera.value.set(e[0],e[1]+1.62,e[2]),this.uniforms.uTime.value=a.seconds,this.uniforms.uDaylight.value=a.daylight*(1-a.rain*.35),this.uniforms.uVision.value=Number(l.vision),this.uniforms.uFogEnd.value=43*(1-a.rain*.2),this.uniforms.uSky.value.set(...a.sky),this.uniforms.uSun.value.set(...a.sun),this.uniforms.uWind.value.set(a.wind[0],a.wind[1],.5+a.rain*.7,0),this.sky.setRGB(...a.sky),this.gl.setClearColor(this.sky),this.environment.update(a,this.camera,e,o);const h=new Je().multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).multiply(new Je().makeTranslation(-c,0,-u));this.culler.cull(new Float64Array(h.elements),e[0],e[1]+1.62,e[2],4,!0);const d=new Uint32Array(this.memory.buffer,this.culler.out_ptr(),this.culler.capacity()*6);for(const p of this.columns.values())for(let T=0;T<3;T++){const P=p.meshes[T];if(!P)continue;const S=p.slot*6+T*2;P.visible=d[S+1]>0,P.geometry.setDrawRange(d[S],d[S+1])}const f=l.vision?1:a.daylight;this.avatars.update(s,this.origin,e,a.seconds,f),this.effects.frame(r,this.origin,f),this.drops.update(l.drops,this.origin,a.seconds,f),this.explosives.update(l.explosives,this.origin,f),this.gl.render(this.scene,this.camera);const _=this.gl.info.render.calls,b=this.gl.info.render.triangles,m=this.held.draw(this.gl,this.camera.aspect,l.state,l.speed,r,f,l.active,l.itemType);this.stats.drawCalls=_+(m?this.gl.info.render.calls:0),this.stats.triangles=b+(m?this.gl.info.render.triangles:0)}finally{this.gpu.finish()}}dispose(){if(!this.disposed){this.disposed=!0;for(const e of[...this.columns.values()])this.remove(e.x,e.z);this.target([],null),this.environment.dispose(),this.held.dispose(),this.drops.dispose(),this.explosives.dispose(),this.effects.dispose(),this.avatars.dispose();for(const e of this.materials)e.dispose();for(const e of this.textures)e.dispose(),e.image&&typeof e.image=="object"&&"data"in e.image&&(e.image.data=new Uint8Array(0));this.textures=[],this.materials=[],this.uniforms={},this.scene.clear(),this.culler.free(),this.gpu.dispose(),this.gl.dispose(),this.gl.forceContextLoss()}}}function yo(i,e){return i.worldId===e.worldId&&i.contentHash===e.contentHash&&i.generatorVersion===e.generatorVersion&&i.x===e.x&&i.z===e.z&&i.incarnation===e.incarnation&&i.subscription===e.subscription&&i.revision===e.revision&&i.version===e.version}class O_{slots=[];config;nextId=0;disposed=!1;count;constructor(e,t,n){this.config=e,this.count=Math.max(1,Math.min(4,Math.floor(t/2)||1));try{for(let s=0;s<this.count;s++)this.slots.push(this.create(0,n))}catch(s){throw this.dispose(),s}}create(e,t){const n=new Worker(new URL("/assets/engine-worker-CQrkI0k9.js",import.meta.url),{type:"module"}),s={worker:n,ready:!1,live:!0,pending:null,restarts:e,timer:null,fail:()=>{}},r=a=>{if(this.disposed||!s.live)return;s.timer&&clearTimeout(s.timer),s.timer=null,s.pending?.reject(new Error(a)),s.pending=null,s.ready=!1,s.live=!1,n.terminate();const o=this.slots.indexOf(s);if(!(o<0))if(e<2)try{this.slots[o]=this.create(e+1,t)}catch{t("generation worker could not restart")}else t("generation worker could not recover")};s.fail=r,s.timer=setTimeout(()=>r("engine worker startup timed out"),1e4),n.onerror=a=>{a.preventDefault(),r(a.message||"engine worker crashed")},n.onmessage=({data:a})=>{if(this.disposed||!s.live)return;if(!a||typeof a!="object"){r("malformed worker response");return}if(a.type==="ready"){if(s.ready||s.pending){r("duplicate worker readiness");return}s.timer&&clearTimeout(s.timer),s.timer=null,s.ready=!0;return}if(a.type==="failed"){r(a.reason||"engine job failed");return}const o=s.pending;if(a.type!=="result"||!o||!a.result||!a.result.tag||a.result.id!==o.job.id||a.result.kind!==o.job.kind||!yo(a.result.tag,o.job.tag)||!(o.job.kind==="generate"?a.result.data instanceof Uint8Array:a.result.data instanceof Uint32Array)){r("stale or malformed worker response");return}s.timer&&clearTimeout(s.timer),s.timer=null,s.pending=null,o.resolve(a.result)};try{n.postMessage({type:"init",config:this.config})}catch(a){throw s.timer&&clearTimeout(s.timer),s.live=!1,n.terminate(),a}return s}get liveCount(){return this.slots.filter(e=>e.live).length}get available(){return this.slots.filter(e=>e.ready&&!e.pending).length}get active(){return this.slots.filter(e=>e.pending).length}submit(e,t,n){const s=this.slots.find(a=>a.ready&&!a.pending);if(!s||this.disposed)return Promise.reject(new Error("worker pool busy"));const r=e==="generate"?{kind:e,id:++this.nextId,tag:t}:{kind:e,id:++this.nextId,tag:t,region:n};return new Promise((a,o)=>{s.pending={job:r,resolve:a,reject:o},s.timer=setTimeout(()=>s.fail("engine job timed out"),1e4);try{s.worker.postMessage({type:"job",job:r},e==="mesh"?[n.buffer]:[])}catch(l){s.fail(l instanceof Error?l.message:"worker transfer failed")}})}dispose(){this.disposed=!0;for(const e of this.slots)e.timer&&clearTimeout(e.timer),e.pending?.reject(new Error("runtime disposed")),e.worker.terminate(),e.live=!1;this.slots=[]}}const or=24;function B_(i,e){if(i.byteLength<or)return null;const t=new TextDecoder().decode(i.subarray(0,4));if(t!=="VXB2"&&t!=="VXP2")return null;const n=new DataView(i.buffer,i.byteOffset,i.byteLength),s=n.getInt32(4,!0),r=n.getInt32(8,!0),a=n.getUint32(12,!0),o=n.getUint32(16,!0),l=n.getUint32(20,!0);if(s<-16||s>15||r<-16||r>15||!a||l>65536||i.byteLength!==or+l*6)return null;const c=[],u=new Set;for(let h=0;h<l;h++){const d=n.getUint32(or+h*6,!0),f=n.getUint16(or+h*6+4,!0);if(d>=65536||f>=e||f===65535||u.has(d))return null;u.add(d),c.push([d,f])}return{kind:t==="VXB2"?"baseline":"patch",x:s,z:r,subscription:a,revision:o,edits:c}}function Cr(i,e,t){return[i*16+(t&15),t>>>8,e*16+(t>>>4&15)]}class z_{columns=new Map;world;pool;renderer;worldId;contentHash;serial=0;completed=[];center={x:0,z:0,yaw:0};disposed=!1;resync;failure;stats={discardedJobs:0,installed:0,meshJobs:0,generationJobs:0,mainWorkMs:0};constructor(e,t,n,s,r,a,o){this.world=e,this.pool=t,this.renderer=n,this.worldId=s,this.contentHash=r,this.resync=a,this.failure=o}receive(e){if(this.disposed)return;const t=Zt(e.x,e.z),n=this.columns.get(t);if(e.kind==="baseline"){if(n&&(e.subscription<n.subscription||e.subscription===n.subscription&&e.revision<n.revision))return;n&&this.drop(n);const s={x:e.x,z:e.z,subscription:e.subscription,incarnation:++this.serial,revision:e.revision,edits:new Map(e.edits),ready:!1,recovering:!1,generating:!1,meshing:!1,generation:null,mesh:null,version:1,shown:0,failures:0};this.columns.set(t,s);return}if(!(!n||n.subscription!==e.subscription||e.revision<=n.revision)&&!n.recovering){if(e.revision!==n.revision+1){n.recovering=!0,this.resync(n.x,n.z,n.subscription);return}n.revision=e.revision;for(const[s,r]of e.edits)n.edits.set(s,r),n.ready&&this.world.mirror_block(...Cr(n.x,n.z,s),r);this.dirty(n.x,n.z)}}unload(e,t,n){const s=this.columns.get(Zt(e,t));s?.subscription===n&&this.drop(s)}drop(e){this.columns.delete(Zt(e.x,e.z)),this.world.forget_column(e.x,e.z),this.renderer.remove(e.x,e.z),this.dirty(e.x,e.z)}dirty(e,t){for(const n of Ma(e,t,1)){const s=this.columns.get(Zt(n.x,n.z));s&&s.version++}}setCenter(e,t,n){this.center={x:e,z:t,yaw:n}}priority(e){const t=e.x*16+8-this.center.x,n=e.z*16+8-this.center.z;return t*t+n*n-(t*Math.sin(this.center.yaw)-n*Math.cos(this.center.yaw))*4}tag(e,t){return{worldId:this.worldId,contentHash:this.contentHash,generatorVersion:go,x:e.x,z:e.z,incarnation:e.incarnation,subscription:e.subscription,revision:e.revision,version:t}}current(e){const t=this.columns.get(Zt(e.tag.x,e.tag.z));if(!(!t||t.incarnation!==e.tag.incarnation||t.subscription!==e.tag.subscription||e.tag.worldId!==this.worldId||e.tag.contentHash!==this.contentHash||e.tag.generatorVersion!==go))return t}pump(e=2){if(this.disposed)return;const t=performance.now(),n=t+e;for(;this.completed.length&&performance.now()<n;){const s=this.completed.shift(),r=this.current(s);if(!r){this.stats.discardedJobs++;continue}try{if(s.kind==="generate"){if(!r.generation||!yo(r.generation,s.tag)||r.ready){this.stats.discardedJobs++;continue}r.generating=!1,this.world.insert_column(r.x,r.z,s.data);for(const[a,o]of r.edits)this.world.mirror_block(...Cr(r.x,r.z,a),o);r.ready=!0,r.failures=0,this.renderer.tint(r.x,r.z,s.data),this.dirty(r.x,r.z),this.stats.installed++}else{if(!r.mesh||!yo(r.mesh,s.tag)){this.stats.discardedJobs++;continue}if(r.meshing=!1,s.tag.version!==r.version||s.tag.revision!==r.revision){this.stats.discardedJobs++;continue}this.renderer.install(r.x,r.z,s.data),r.shown=r.version,r.failures=0}}catch(a){this.retry(r,a)}}for(;this.pool.available>0&&this.completed.length+this.pool.active<this.pool.count*2&&performance.now()<n;){const s=[...this.columns.values()].filter(h=>!h.recovering&&h.failures<3).sort((h,d)=>this.priority(h)-this.priority(d)),r=s.find(h=>!h.ready&&!h.generating),a=Math.floor(this.center.x/16),o=Math.floor(this.center.z/16),l=s.find(h=>h.ready&&!h.meshing&&h.shown<h.version&&Math.abs(h.x-a)<=Yl&&Math.abs(h.z-o)<=Yl&&Ma(h.x,h.z,1).every(d=>this.columns.get(Zt(d.x,d.z))?.ready)),c=r&&Math.abs(r.x-a)<=1&&Math.abs(r.z-o)<=1;if(r&&(!l||c||this.priority(r)<=this.priority(l)+100)){r.generating=!0;const h=this.tag(r,0);r.generation=h,this.stats.generationJobs++,this.submit(r,"generate",h);continue}if(!l)break;l.meshing=!0;const u=this.tag(l,l.version);l.mesh=u,this.stats.meshJobs++,this.submit(l,"mesh",u,this.world.extract_region(l.x,l.z))}this.stats.mainWorkMs=performance.now()-t}submit(e,t,n,s){this.pool.submit(t,n,s).then(r=>{this.disposed||this.completed.push(r)},r=>{if(this.disposed)return;this.columns.get(Zt(e.x,e.z))===e&&this.retry(e,r)})}retry(e,t){e.generating=!1,e.meshing=!1,e.failures++,e.failures>=3&&(e.recovering=!0,this.failure(t instanceof Error?t.message:"world job failed"))}readyAround(e){const t=Ma(Math.floor(e[0]/16),Math.floor(e[2]/16),1).map(n=>this.columns.get(Zt(n.x,n.z)));return t.every(n=>n?.ready&&!n.recovering)?t.map(n=>({x:n.x,z:n.z,revision:n.revision})):null}revision(e,t){return this.columns.get(Zt(e,t))?.revision??-1}get collisionCount(){return[...this.columns.values()].filter(e=>e.ready).length}get meshCount(){return[...this.columns.values()].filter(e=>e.shown>0).length}dispose(){if(!this.disposed){this.disposed=!0;for(const e of[...this.columns.values()])this.drop(e);this.completed=[]}}}class G_{world;slot;epoch=0;sequence=0;pending=[];lastAck=0;modifiers=_s;correction=0;constructor(e,t){this.world=e,this.slot=t}baseline(e,t,n,s=_s){this.modifiers=s,this.epoch=e,this.sequence=t,this.lastAck=t,this.pending=[],this.world.player_restore(this.slot,new Float64Array(n))}sample(e){if(this.pending.length>=120)return null;const t={...e,epoch:this.epoch,sequence:++this.sequence};return this.pending.push(t),Hl(this.world,this.slot,t,this.modifiers),t}reconcile(e,t,n){if(e!==this.epoch)return e>this.epoch&&this.baseline(e,t,n,this.modifiers),!1;if(t<this.lastAck)return!1;this.lastAck=t,this.sequence=Math.max(this.sequence,t);const s=this.world.player_state(this.slot);this.pending=this.pending.filter(a=>a.sequence>t),this.world.player_restore(this.slot,new Float64Array(n));for(const a of this.pending)Hl(this.world,this.slot,a,this.modifiers);const r=this.world.player_state(this.slot);return this.correction=Math.hypot(r[0]-s[0],r[1]-s[1],r[2]-s[2]),!0}get inputLag(){return this.pending.length}get currentSequence(){return this.sequence}get currentEpoch(){return this.epoch}}function V_(i){const e=new Map;for(const t of i.items){if(!t.places)continue;const n=i.blocks.findIndex(s=>s.name===t.places&&s.placeable!==!1);n<0||e.has(n)||e.set(n,{key:n,state:n,family:t.places,labelKey:t.labelKey,slot:null,count:null})}return[...e.values()]}class H_{actors=new Map;offset=null;join(e,t){this.actors.set(e.id,{latest:e,samples:[{time:t+(this.offset??0),state:e.state,yaw:e.yaw,pitch:e.pitch}]})}remove(e){this.actors.delete(e)}snapshot(e,t,n){if(this.offset===null)for(const r of this.actors.values())for(const a of r.samples)a.time=t;const s=t-n;this.offset=this.offset===null?s:Math.max(s,this.offset-.25);for(const r of e){const a=this.actors.get(r.id);if(a)for(a.latest={...a.latest,...r},a.samples.push({time:t,state:a.latest.state,yaw:a.latest.yaw,pitch:a.latest.pitch});a.samples.length>32;)a.samples.shift()}}frame(e){const t=e+(this.offset??0)-125,n=[];for(const[s,r]of this.actors){const a=r.samples;for(;a.length>2&&a[1].time<t;)a.shift();const o=a[0],l=a[1]??o,c=l.time-o.time,u=c>0?Math.max(0,Math.min(1,(t-o.time)/c)):0,h=o.state.slice(0,3).map((f,_)=>f+(l.state[_]-f)*u);if(t>l.time&&l.state[12]!==1){const f=Math.min(.1,Math.max(0,(t-l.time)/1e3));for(let _=0;_<3;_++)h[_]=l.state[_]+l.state[_+3]*f}const d=Math.atan2(Math.sin(l.yaw-o.yaw),Math.cos(l.yaw-o.yaw));n.push({id:s,position:h,yaw:o.yaw+d*u,pitch:o.pitch+(l.pitch-o.pitch)*u,speed:l.state[12]===1?0:Math.hypot(l.state[3],l.state[5]),flying:l.state[10]===1,appearance:r.latest.appearance})}return n}clear(){this.actors.clear(),this.offset=null}get size(){return this.actors.size}}class W_{tick=0;received=0;shown=0;running=!0;reset(e,t,n=!0){this.tick=this.shown=e,this.received=t,this.running=n}observe(e,t){return e<=this.tick?!1:(this.tick=e,this.received=t,!0)}read(e){if(!this.running)return this.tick;const t=Math.min(250,Math.max(0,e-this.received));return this.shown=Math.max(this.shown,this.tick+t*vs/1e3),this.shown}}class X_{supported=typeof AudioContext=="function";context=null;output=null;ambientGain=null;ambientNodes=[];ambient=null;noise=null;voices=new Set;disposed=!1;active=!1;muted=!1;nextChirp=0;nextAmbient=0;effects=0;dropped=0;listenerPosition=[0,0,0];lastSource=null;closing=null;get stats(){return{supported:this.supported,contexts:this.context?1:0,state:this.context?.state??(this.disposed?"closed":this.supported?"locked":"unsupported"),active:this.active,muted:this.muted,voices:this.voices.size,effects:this.effects,gain:this.output?.gain.value??0,dropped:this.dropped,listener:this.context?.listener.positionX?[this.context.listener.positionX.value,this.context.listener.positionY.value,this.context.listener.positionZ.value]:[...this.listenerPosition],lastSource:this.lastSource?[...this.lastSource]:null}}unlock(){if(!(this.disposed||!this.supported||this.muted))try{if(!this.context){const e=this.context=new AudioContext,t=this.output=e.createGain();t.gain.value=0,t.connect(e.destination);const n=this.noise=e.createBuffer(1,e.sampleRate*2,e.sampleRate),s=n.getChannelData(0);let r=27;for(let c=0;c<s.length;c++)r=Math.imul(r,1664525)+1013904223,s[c]=(r>>>0)/4294967296*2-1;const a=this.ambient=e.createBufferSource(),o=e.createBiquadFilter();a.buffer=n,a.loop=!0,o.type="lowpass",o.frequency.value=450;const l=this.ambientGain=e.createGain();l.gain.value=0,a.connect(o).connect(l).connect(t),a.start(),this.ambientNodes=[o,l]}this.context.resume().catch(()=>{}),this.gain()}catch{this.dispose()}}setMuted(e){e!==this.muted&&(this.muted=e,this.gain())}setActive(e){const t=e&&!this.disposed;t!==this.active&&(this.active=t,this.gain())}gain(){!this.context||!this.output||this.disposed||this.output.gain.setTargetAtTime(this.active&&!this.muted?.22:0,this.context.currentTime,.025)}frame(e,t,n,s,r,a){this.setActive(a),this.listenerPosition=[e[0],e[1]+1.62,e[2]];const o=this.context;if(!o||this.disposed)return;const l=o.listener,c=Math.cos(n),u=[Math.sin(t)*c,Math.sin(n),-Math.cos(t)*c],h=[-Math.sin(t)*Math.sin(n),c,Math.cos(t)*Math.sin(n)];if(typeof l.positionX=="object")for(const[d,f]of["X","Y","Z"].entries())l[`position${f}`].value=this.listenerPosition[d],l[`forward${f}`].value=u[d],l[`up${f}`].value=h[d];else l.setPosition(...this.listenerPosition),l.setOrientation(...u,...h);this.ambientGain&&o.currentTime>=this.nextAmbient&&(this.nextAmbient=o.currentTime+.25,this.ambientGain.gain.setTargetAtTime((r?1:.12)*(.006+s.rain*.045),o.currentTime,.5)),this.active&&!this.muted&&o.state==="running"&&o.currentTime>this.nextChirp&&s.rain<.2&&(this.nextChirp=o.currentTime+6+Math.sin(s.seconds)**2*4,this.chirp(s.daylight>.5))}track(e,t){const n={source:e,nodes:t};this.voices.add(n),e.onended=()=>{for(const s of t)s.disconnect();e.disconnect(),this.voices.delete(n)}}chirp(e){const t=this.context;if(!t||!this.output||this.voices.size>=16)return;const n=t.createOscillator(),s=t.createGain(),r=t.currentTime;n.type="sine",n.frequency.setValueAtTime(e?1700:3800,r),n.frequency.exponentialRampToValueAtTime(e?2500:4100,r+.08),s.gain.setValueAtTime(1e-4,r),s.gain.exponentialRampToValueAtTime(.008,r+.02),s.gain.exponentialRampToValueAtTime(1e-4,r+.12),n.connect(s).connect(this.output),this.track(n,[s]),n.start(r),n.stop(r+.13)}effect(e,t,n){const s=this.context;if(!s||!this.noise||!this.output||this.disposed||!this.active||this.muted||s.state!=="running")return;if(this.voices.size>=16||Math.hypot(...e.map((h,d)=>h-this.listenerPosition[d]))>32){this.dropped++;return}const r=s.createBufferSource(),a=s.createBiquadFilter(),o=s.createGain(),l=s.createPanner(),c=s.currentTime;r.buffer=this.noise,r.playbackRate.value=t==="glass"?2:t==="wood"?.9:1.2,a.type=t==="water"||t==="explosion"?"lowpass":"bandpass",a.frequency.value=t==="explosion"?240:t==="wood"?420:t==="glass"?2100:t==="grass"?1300:t==="water"?500:780,a.Q.value=.6;const u=t==="explosion"?.4:.13;o.gain.setValueAtTime(t==="explosion"?.45:n?.22:.12,c),o.gain.exponentialRampToValueAtTime(.001,c+u),l.panningModel="equalpower",l.distanceModel="inverse",l.refDistance=1,l.maxDistance=32,l.rolloffFactor=1.2,l.positionX.value=e[0],l.positionY.value=e[1],l.positionZ.value=e[2],r.connect(a).connect(o).connect(l).connect(this.output),this.track(r,[a,o,l]),r.start(c,this.effects*.173%1.7,u+.01),this.effects++,this.lastSource=[l.positionX.value,l.positionY.value,l.positionZ.value]}dispose(){if(this.disposed)return this.closing??Promise.resolve();this.disposed=!0,this.active=!1;for(const t of this.voices){t.source.onended=null;try{t.source.stop()}catch{}t.source.disconnect();for(const n of t.nodes)n.disconnect()}if(this.voices.clear(),this.ambient){try{this.ambient.stop()}catch{}this.ambient.disconnect()}for(const t of this.ambientNodes)t.disconnect();this.output?.disconnect(),this.output=this.ambientGain=null,this.ambient=null,this.noise=null,this.ambientNodes=[];const e=this.context;return this.closing=e&&e.state!=="closed"?e.close().catch(()=>{}).then(()=>{this.context=null}):Promise.resolve().then(()=>{this.context=null}),this.closing}}const q_=Object.freeze({damage:2,cooldown:15,reach:3});function K_(i){return i?.combat??q_}function Y_(i,e,t,n){let s=0,r=n;for(let a=0;a<3;a++){const o=t[a]-(a===1?0:.3),l=t[a]+(a===1?1.8:.3);if(Math.abs(e[a])<1e-12){if(i[a]<o||i[a]>l)return null}else{const c=(o-i[a])/e[a],u=(l-i[a])/e[a];if(s=Math.max(s,Math.min(c,u)),r=Math.min(r,Math.max(c,u)),s>r)return null}}return s}async function Z_(i,e){const t=()=>{if(e.signal?.aborted)throw new DOMException("Voxel mount cancelled","AbortError")};t();const n=Nu();if(n)throw new Error(n);const s=await ku();t();const r=new Map(xt.items.map(v=>[v.itemType,v])),a=e.inputMode??(navigator.maxTouchPoints>0&&matchMedia("(pointer: coarse)").matches?"touch":"desktop"),o=e.renderHz===30?30:60,l=()=>({x:0,z:0,jump:!1,sneak:!1,sprint:!1});let c=l();const u=document.createElement("canvas");u.tabIndex=0,u.setAttribute("aria-label","עולם המשחק");const h=()=>Object.is(document.pointerLockElement,u);i.append(u);const d=new Ta,f=new F_(u,Yc(),Zc(),new wa,s.memory,xt.blocks,xt.items,e.renderScale);try{const v=xt.blocks.findIndex(F=>F.name===xt.items.find(oe=>oe.places)?.places&&F.placeable!==!1);if(v<0)throw new Error("missing placeable startup model");await f.prepare(v,e.signal),t()}catch(v){throw f.dispose(),d.free(),u.remove(),v}const _=new H_,b=new Set,m=new Set,p=new W_,T=new X_,P=new Map(xt.behavior.map(v=>[v.family,v.soundGroup]));let S=0,R=xa(0,0),A=!1,L=-1/0;const y=()=>({hour:Math.floor((R.dayFraction*24+6)%24),daytime:R.sun[1]>=0,rain:R.rain>.2}),w=V_(xt);let M={mode:"creative",role:"participant",lifecycle:"preparing",worldPauseReason:null,combat:!1,canIgnite:!1,hit:null,selectedSlot:0,mining:{target:null,elapsed:0,total:0},vitals:null,inventory:null,inventoryOpen:!1,inventoryPending:!1,inputMode:a,environment:y(),effectsMuted:!1,effectsAvailable:T.supported,status:"connecting",message:"מתחברים לעולם…",selected:w.find(v=>v.family==="stone")?.state??w[0].state,players:1,flying:!1,pointerLocked:!1,hotbar:w},N=null,W=null,z=null,C=null,V=null,O=!0,I=!1,j=!1,H=0,X="preparing",J=!1,Se=!1,ve="",He="",Ne=0,Oe=0,$=!1,ne=0,le=null,Ee=0,he=null,Fe=0,ft=null;const Ue=new Map,Ve=new Set;let nt=[],Ke=performance.now(),yt=Ke,bt=0,Dt=0,mt=0,St=0,k=0,wt=0,at=0,E=null,g=0,B=null,Y=null,ee=0,ae=!1,ce=!1,Q="",re=0,fe=0;const Ae=new Map,ue=new Set;let de=0,Le=0,De=null,Be=!1,D=0,ge=0,se=null,pe=null,_e=[],te=null,Ce=null,Pe="",it=[0,0,0],Ye=[0,80,0];const ke=v=>{M={...M,...v};for(const F of b)F(M)},vt=v=>{N?.readyState===WebSocket.OPEN&&N.send(JSON.stringify(v))},mn=(v,F)=>e.onDiagnostic?.(v,F instanceof Error?F.message:String(F)),Kt=(v,F)=>{I=!0,mn(v,F),m.clear(),c=l(),p.reset(p.read(performance.now()),performance.now(),!1),ke({lifecycle:"recovering",status:"recovering",message:"העולם מתאושש. אפשר להתחבר מחדש."}),C&&vt({type:"focus",epoch:C.currentEpoch,active:!1}),J=!1,T.setActive(!1)},zi=()=>{T.setActive(!1),D=0,se=null,p.reset(0,performance.now()),S=0,R=xa(0,0),A=!1,L=-1/0,m.clear(),c=l(),$=!1,z?.dispose(),W?.dispose(),z=null,W=null,_.clear(),V!==null&&d.player_remove(V),V=null,C=null,X="preparing",Se=!1,nt=[],le=null,ne=0,Y=null,g=0,ue.clear(),Ae.clear(),ae=ce=!1,Q="",re=0,fe=0,pe=null,Ee=0,he=null,Fe=0,ft=null,Ue.clear(),Ve.clear(),de=0,Le=0,De=null,Be=!1,ke({inventory:null,inventoryOpen:!1,inventoryPending:!1,mining:{target:null,elapsed:0,total:0},vitals:null,combat:!1,canIgnite:!1,hit:null}),_e=[],wt=0,te=null,Ce=null,Pe="",f.target([],null),f.resetPresentation()},gn=()=>{if(nt.length){for(;nt.length;){const v=nt.splice(0,4);vt({type:"input",frames:v})}Dt=performance.now()}},bs=()=>{if(M.mode!=="creative"||X!=="playing"||!C||N?.readyState!==WebSocket.OPEN)return;const v=C.currentEpoch;if(Y?.epoch===v&&Y.state===M.selected)return;const F=Y?.epoch===v?Y.sequence+1:1;vt({type:"palette",epoch:v,sequence:F,state:M.selected}),Y={epoch:v,sequence:F,state:M.selected}},Wt=v=>{v&&(M.lifecycle==="ended"||M.role==="participant"&&["paused","recovering"].includes(M.lifecycle))||v&&(I||M.inventoryOpen||X==="dead")||J!==v&&(J=v,v||(ae=ce=!1,Q=""),T.setActive(v&&X==="playing"),D=0,se=null,wt=0,m.clear(),c=l(),$=!1,le=null,ae=ce=!1,Q="",nt=[],bt=0,C&&X==="playing"&&(Be=!0,vt({type:"focus",epoch:C.currentEpoch,active:v})))},Ss=v=>{if(v.type==="lifecycle"){const F=performance.now();p.reset(v.tick,F,v.state==="playing"),ke({lifecycle:v.reason==="policy_unavailable"?"recovering":v.state,worldPauseReason:v.reason}),v.state==="ended"?(O=!1,Wt(!1),X="paused",h()&&document.exitPointerLock(),ke({status:"error",message:"המפגש הסתיים. אפשר לחזור לרשימת המשחקים."})):v.state==="paused"&&M.role==="participant"&&(Wt(!1),h()&&document.exitPointerLock(),ke({message:v.reason==="policy_unavailable"?"ממתינים לאישור מצב העולם…":"העולם מושהה."}));return}if(!(M.lifecycle==="ended"&&v.type!=="error")){if(v.type==="explosives"){if(!v.upsert.every(F=>xt.behavior.find(oe=>oe.family===xt.blocks[F.state]?.name)?.explosive)){Kt("explosives","unknown explosive state");return}v.reset&&Ue.clear();for(const F of v.removed)Ue.delete(F);for(const F of v.upsert)(!Ue.has(F.id)||Ue.get(F.id).revision<=F.revision)&&Ue.set(F.id,F);return}if(v.type==="explosion"){if(v.sequence<=Fe)return;Fe=v.sequence,ft=v,Ue.delete(v.id);for(const F of v.columns)Ve.add(`${F.x},${F.z}:${F.revision}`);for(;Ve.size>128;)Ve.delete(Ve.values().next().value);v.cancelled||(f.explosionEffect(v.position,v.radius,performance.now()),T.effect(v.position,"explosion",!0));return}if(v.type==="hit"){if(!C||v.sequence<=Ee)return;Ee=v.sequence,he=v;const F=performance.now();f.hitEffect(v.position,F),T.effect(v.position,"impact",!1),(v.target===ve||v.attacker===ve)&&ke({hit:{received:v.target===ve,damage:v.damage,at:F}});return}if(v.type==="vitals"){C&&v.epoch===C.currentEpoch&&ke({vitals:v.view});return}if(v.type==="drops"){const F=new Map(xt.items.map(oe=>[oe.itemType,oe]));if(!v.upsert.every(oe=>Ar(oe.stack,F))){Kt("drops","invalid drop stack");return}v.reset&&Ae.clear();for(const oe of v.removed)Ae.delete(oe);for(const oe of v.upsert)(!Ae.has(oe.id)||Ae.get(oe.id).revision<=oe.revision)&&Ae.set(oe.id,oe);return}if(v.type==="mining"){if(v.epoch!==C?.currentEpoch)return;!v.target&&M.mining.target&&(Q="",ce&&(ae=!1)),ke({mining:{target:v.target,elapsed:v.elapsed,total:v.total}});return}if(v.type==="rules"){if(!C||v.epoch<=C.currentEpoch)return;ke({mode:v.mode,combat:v.combat,canIgnite:v.explosives,...v.mode==="survival"?{hotbar:[],selected:0}:{hotbar:w,selected:w.find(F=>F.family==="stone")?.state??w[0].state}});return}if(v.type==="inventory"){if(!C||v.epoch!==C.currentEpoch)return;const F=new Map(xt.items.map(me=>[me.itemType,me]));if(![...v.view.bag,...v.view.craft2,...v.view.craft3,...v.view.equipment,...v.view.container?.slots??[]].every(me=>me===null||Ar(me,F))){Kt("inventory","invalid owned stack");return}if(de=v.epoch,M.mode==="survival"){const me=v.view.bag.slice(0,9).map((Me,lt)=>{const rt=xt.items.find(Ge=>Ge.itemType===Me?.itemType),ut=rt?.places?xt.blocks.findIndex(Ge=>Ge.name===rt.places&&Ge.placeable!==!1):0;return{key:lt,slot:lt,state:Math.max(0,ut),family:Me?.itemType??"",labelKey:rt?.labelKey??"item.empty",count:Me?.count??0}});ke({inventory:v.view,hotbar:me,selectedSlot:v.view.selected,selected:me[v.view.selected].state})}else ke({inventory:v.view});return}if(v.type==="welcome"){if(v.buildId!==Ri.buildId||v.contentHash!==xt.hash||v.environmentVersion!==Bc||v.environmentVersion!==Ri.environmentVersion||v.generatorVersion!==go){N?.close(),ke({status:"error",message:"המשחק עודכן. יש לרענן את העמוד."});return}ve=v.actorId,ke({mode:v.mode,role:v.role,combat:v.combat,canIgnite:v.explosives,...v.mode==="survival"?{hotbar:[],selected:0}:{hotbar:w}}),He=v.worldId,S=v.seed,p.reset(v.tick,performance.now()),V=d.player_add(...v.spawn),d.set_ghost(V,v.role==="observer"),C=new G_(d,V),C.baseline(v.epoch,0,Array.from(d.player_state(V))),Ye=[...v.spawn],W=new O_({module:s.module,content:xt,seed:v.seed},navigator.hardwareConcurrency||2,F=>Kt("worker",F)),z=new z_(d,W,f,He,xt.hash,(F,oe,me)=>vt({type:"resync",x:F,z:oe,subscription:me}),F=>Kt("stream",F)),ke({status:"loading",message:"מכינים את העולם…"});return}if(v.type==="baseline"&&C){(v.reason==="mode"||v.reason==="teleport")&&(Wt(!1),h()&&document.exitPointerLock(),De=null,ke({inventoryOpen:!1}),se=null,D=0,Ye=v.state.slice(0,3),k=-1/0);const F=C.currentEpoch;if(C.baseline(v.epoch,v.ack,v.state,v.movement),X=v.phase,(v.phase==="paused"||v.phase==="dead")&&(Be=!1,J=!1,m.clear(),c=l(),ae=!1,Q="",T.setActive(!1),h()&&document.exitPointerLock(),v.phase==="dead"&&(De=null,ke({inventoryOpen:!1}))),Se=!0,nt=[],it=[0,0,0],v.epoch!==F&&(le=null,ne=0,g=0,ue.clear(),(v.reason!=="focus"||!J)&&(ae=ce=!1),Q="",re=0,fe=0,pe=null,Le=0,ke({inventoryPending:!1})),v.phase==="playing"&&(Be=v.state[12]!==+!J,Be&&vt({type:"focus",epoch:v.epoch,active:J})),ke({status:I?"recovering":v.phase==="dead"?"dead":v.phase==="preparing"?"loading":J&&v.state[12]===0?"playing":"paused",message:I?"העולם מתאושש. אפשר להתחבר מחדש.":v.phase==="dead"?"נפלתם. הפריטים נשארו בעולם. אפשר לחזור לנקודת ההתחלה.":v.phase==="preparing"?"מכינים את העולם…":J?"":"לחצו על העולם כדי להמשיך",flying:v.state[10]===1}),De)if(v.phase==="playing"&&!Be){const oe=De;De=null,ke({inventoryPending:!1}),Te(oe)}else ke({inventoryPending:!0});bs();return}if(v.type==="snapshot"){if(!v.actors.every(F=>!F.appearance||Kl(F.appearance,r))){Kt("actors","invalid public appearance");return}if(p.observe(v.tick,performance.now()),v.self&&C){const F=d.player_state(C.slot);if(C.reconcile(v.self.epoch,v.self.ack,v.self.state)){const me=d.player_state(C.slot);it=Math.hypot(me[0]-F[0],me[1]-F[1],me[2]-F[2])<1?[it[0]+F[0]-me[0],it[1]+F[1]-me[1],it[2]+F[2]-me[2]]:[0,0,0]}}_.snapshot(v.actors,v.time,performance.now());return}if(v.type==="actor_joined"){if(!Kl(v.actor.appearance,r)){Kt("actors","invalid public appearance");return}_.join(v.actor,performance.now());return}if(v.type==="actor_removed"){_.remove(v.id);return}if(v.type==="unload"){z?.unload(v.x,v.z,v.subscription);return}if(v.type==="result"){if(C&&v.epoch===C.currentEpoch&&(v.sequence===re&&v.outcome?.ok===!1&&["input_stale","input_dependency","input_timeout","out_of_reach","conflict"].includes(v.outcome.reason)&&ae&&(Q="",fe=performance.now()+150),v.sequence===Le&&ke({inventoryPending:!1}),pe=v,ue.delete(v.sequence)&&(g=ue.size),v.outcome&&!v.outcome.ok)){const F={collision:"אין מספיק מקום לבלוק",out_of_reach:"המטרה רחוקה או מוסתרת",conflict:"העולם השתנה. נסו שוב.",support:"הבלוק צריך משטח מתאים",forbidden:"אין הרשאה לפעולה הזאת",full:"אין מקום בתיק או במשבצת היעד",no_recipe:"הסידור אינו מתאים למתכון",insufficient:"אין מספיק פריטים לפעולה",wrong_equipment:"הפריט אינו מתאים למשבצת הציוד",occupied:"יש להחליף ערימה שלמה או לבחור משבצת פנויה",station_required:"צריך שולחן יצירה נגיש ליצירה בגודל 3×3",container_not_empty:"צריך לרוקן את התיבה לפני הסרתה",not_owned:"צריך לבחור במשבצת שמכילה את הבלוק הזה",tool_required:"צריך כלי מתאים כדי לכרות את הבלוק הזה",mine_required:"יש להחזיק את פעולת הכרייה",not_food:"הפריט שנבחר אינו מזון",cooldown:"המתינו מעט לפני אכילה נוספת"};ee=performance.now()+1800,ke({message:F[v.outcome.reason]??"לא ניתן לבצע את הפעולה כאן"})}return}if(v.type==="error"){if(v.code==="INVALID")return;if(O=v.code==="SESSION_ENDED"?!1:v.retryable,v.code==="SESSION_ENDED"||v.code==="RECOVERING"){const F=performance.now();p.reset(p.read(F),F,!1),Wt(!1),v.code==="SESSION_ENDED"&&(X="paused"),h()&&document.exitPointerLock()}ke({...v.code==="SESSION_ENDED"?{lifecycle:"ended"}:{},...v.code==="RECOVERING"?{lifecycle:"recovering"}:{},status:"error",message:v.code==="SESSION_ENDED"?"המפגש הסתיים. אפשר לחזור לרשימת המשחקים.":v.code==="INCOMPATIBLE"?"המשחק עודכן. יש לרענן את העמוד.":v.code==="REPLACED"?"המשחק פתוח בחלון אחר.":"החיבור לעולם הופסק. אפשר להתחבר מחדש."})}}};async function an(){O=!0,I=!1;const v=++H;E&&(clearTimeout(E),E=null),N?.close(),zi(),ke({lifecycle:"preparing",worldPauseReason:null,status:"connecting",message:"מתחברים לעולם…"});try{const F=await e.admit();if(j||v!==H)return;if(F.buildId!==Ri.buildId)throw new Error("incompatible client build");const oe=new WebSocket(e.socketUrl);N=oe,oe.binaryType="arraybuffer",oe.onopen=()=>{if(j||v!==H){oe.close();return}mt=performance.now(),oe.send(JSON.stringify({type:"hello",ticket:F.ticket,buildId:Ri.buildId}))},oe.onmessage=({data:me})=>{if(!(j||v!==H)){mt=performance.now();try{if(typeof me=="string"){const Me=w_(me);if(!Me)throw new Error("invalid server control message");Ss(Me)}else{const Me=B_(new Uint8Array(me),xt.blocks.length);if(!Me)throw new Error("invalid world frame");const lt=z?.columns.get(Zt(Me.x,Me.z)),rt=Me.kind==="patch"&&lt&&!lt.recovering&&Me.subscription===lt.subscription&&Me.revision===lt.revision+1,ut=Ve.delete(`${Me.x},${Me.z}:${Me.revision}`),Ge=rt&&lt.ready&&!ut?Me.edits.slice(0,8).map(([qe,Nt])=>{const ht=Cr(Me.x,Me.z,qe);return{cell:ht,state:Nt,before:d.get_block(...ht)}}):[];if(z?.receive(Me),rt&&z?.revision(Me.x,Me.z)===Me.revision&&!lt?.recovering){for(const qe of Ge)if(qe.before!==qe.state&&qe.before!==65535){f.editEffect(qe.cell,qe.state===0?qe.before:qe.state,performance.now(),qe.state===0);const Nt=qe.state===0?qe.before:qe.state;T.effect(qe.cell.map(ht=>ht+.5),P.get(xt.blocks[Nt]?.name)??"stone",qe.state===0)}for(const[qe,Nt]of Me.edits)_e.push({cell:Cr(Me.x,Me.z,qe),state:Nt,revision:Me.revision});_e=_e.slice(-32)}}}catch(Me){Kt("replication",Me)}}},oe.onerror=()=>mn("socket","connection failed"),oe.onclose=()=>{j||v!==H||(J=!1,T.setActive(!1),m.clear(),c=l(),O&&(ke({status:"recovering",message:"החיבור הופסק. מתחברים מחדש…"}),E=setTimeout(()=>{an()},1500)))}}catch(F){!j&&v===H&&(mn("admission",F),ke({status:"error",message:"לא ניתן להתחבר לעולם. נסו שוב."}))}}function Gi(){const v=V===null?null:d.player_state(V),F=!!v&&(v[10]===1||v[7]===1||v[9]===1),oe={x:Math.max(-1,Math.min(1,c.x+Number(m.has("KeyD"))-Number(m.has("KeyA")))),z:Math.max(-1,Math.min(1,c.z+Number(m.has("KeyS"))-Number(m.has("KeyW")))),yaw:Ne,pitch:Oe,jump:F?m.has("Space")||c.jump:$,sneak:m.has("ShiftLeft")||m.has("ShiftRight")||c.sneak,sprint:m.has("ControlLeft")||m.has("ControlRight")||c.sprint};return $=!1,oe}function Ms(v){if(!C)return!1;const F=d.player_state(C.slot),oe=Math.cos(Oe),me=[F[0],F[1]+1.62,F[2]],Me=[Math.sin(Ne)*oe,Math.sin(Oe),-Math.cos(Ne)*oe],lt=xt.items.find(rt=>rt.itemType===M.inventory?.bag[M.selectedSlot]?.itemType);return _.frame(v).some(rt=>{const ut=Y_(me,Me,rt.position,K_(lt).reach);if(ut===null)return!1;const Ge=me.map((qe,Nt)=>qe+Me[Nt]*(ut+1e-4));return d.line_clear(me[0],me[1],me[2],Ge[0],Ge[1],Ge[2])})}function ws(){if(!te)return!0;if(!C||!z||!M.inventory||de!==C.currentEpoch||g>=16)return!1;const v=z.revision(te[0]>>4,te[2]>>4);if(v<0)return!1;gn(),f.swing(performance.now());const F=++ne;return vt({type:"ignite",epoch:C.currentEpoch,sequence:F,inputSequence:C.currentSequence,target:[...te],revision:v,inventoryRevision:M.inventory.revision}),ue.add(F),g=ue.size,!0}function di(){if(!C||!M.inventory||de!==C.currentEpoch||g>=16)return!1;gn(),f.swing(performance.now());const v=++ne;return vt({type:"attack",epoch:C.currentEpoch,sequence:v,inputSequence:C.currentSequence,inventoryRevision:M.inventory.revision}),ue.add(v),g=ue.size,!0}function Ts(v){if(M.mode==="survival"&&v==="remove"){ae=ce=!0;return}if(!C||!z||!te||!Ce||g>=16)return;const F=xt.blocks[d.get_block(...te)];let oe=te;v==="place"&&!F?.replaceable&&(oe=[te[0]+Ce[0],te[1]+Ce[1],te[2]+Ce[2]]);const me=new Map;for(const lt of[te,oe]){const rt=lt[0]>>4,ut=lt[2]>>4,Ge=z.revision(rt,ut);if(Ge<0)return;me.set(Zt(rt,ut),{x:rt,z:ut,revision:Ge})}gn(),f.swing(performance.now());const Me=++ne;vt({type:"action",epoch:C.currentEpoch,sequence:Me,inputSequence:C.currentSequence,kind:v,target:te,state:v==="collect"?0:M.selected,inventoryRevision:M.inventory?.revision??0,revisions:[...me.values()]}),ue.add(Me),g=ue.size}function _n(v){!C||!z||N?.readyState!==WebSocket.OPEN||(gn(),re=++ne,vt({type:"mining",epoch:C.currentEpoch,sequence:re,inputSequence:v?C.currentSequence:0,target:v,revision:v?Math.max(0,z.revision(v[0]>>4,v[2]>>4)):0,inventoryRevision:M.inventory?.revision??0}))}function Es(v,F){if(M.mode!=="survival")return;if(!ae||!J||!v||I||X!=="playing"){Q&&_n(null),Q="";return}if(!F||performance.now()<fe||!te||!M.inventory||M.inventoryPending||de!==C?.currentEpoch)return;const oe=M.inventory.bag[M.inventory.selected],me=`${te.join(",")}:${d.get_block(...te)}:${M.inventory.selected}:${oe?.itemType??""}:${oe?.instance?.durability??0}`;me!==Q&&(Q=me,_n([...te]),f.swing(performance.now()))}function Vi(v){const F=M.inventory?.bag[M.selectedSlot],oe=M.mode==="survival"&&xt.items.some(rt=>rt.itemType===F?.itemType&&rt.collects),me=Math.cos(Oe),Me=(oe?d.raycast_liquids.bind(d):d.raycast.bind(d))(v[0],v[1]+1.62,v[2],Math.sin(Ne)*me,Math.sin(Oe),-Math.cos(Ne)*me,6);te=Me[0]?[Me[1],Me[2],Me[3]]:null,Ce=Me[0]?[Me[4],Me[5],Me[6]]:null;const lt=te?`${te.join(",")}:${d.get_block(...te)}:${f.origin.x}:${f.origin.z}`:"";if(lt!==Pe){Pe=lt;const rt=[];if(te){const ut=d.target_boxes(...te);for(let Ge=0;Ge<ut.length;Ge+=6)rt.push(Array.from(ut.subarray(Ge,Ge+6)))}f.target(rt,te)}}function kr(v){if(j)return;const F=Math.min(.1,Math.max(0,(v-yt)/1e3));if(yt=v,R=xa(p.read(v),S),bt+=F,C&&z){let oe=d.player_state(C.slot);if(z.setCenter(oe[0],oe[2],Ne),z.pump(2),X==="preparing"&&Se&&v-k>300){const ut=z.readyAround(oe);ut&&z.meshCount>0&&(vt({type:"ready",epoch:C.currentEpoch,columns:ut}),k=v)}const me=z.readyAround(oe)!==null,Me=v-mt>1500;me&&v-L>250&&(L=v,A=d.raycast(oe[0],oe[1]+1.9,oe[2],0,1,0,256)[0]===0),X==="playing"&&!me&&!Me&&M.status!=="loading"&&!["error","recovering"].includes(M.status)?ke({status:"loading",message:"ממתינים לטעינת השטח…"}):X==="playing"&&me&&M.status==="loading"&&ke({status:J?"playing":"paused",message:J?"":"לחצו על העולם כדי להמשיך"}),Me&&M.status!=="recovering"&&M.status!=="error"&&ke({status:"stalled",message:"ממתינים לחיבור…"});let lt=0,rt=!1;for(;bt>=1/60&&lt++<6;)if(bt-=1/60,X==="playing"&&J&&me&&!Me&&oe[12]===0){const ut=C.sample(Gi());ut?(rt=!0,nt.push(ut),Vi(d.player_state(C.slot)),le&&(le==="attack"?di()&&(le=null):le==="ignite"?ws()&&(le=null):(Ts(le),le=null))):Kt("prediction","input acknowledgement stalled")}if(v-Dt>=1e3/30&&gn(),Es(me&&!Me,rt),oe=d.player_state(C.slot),Ye=Array.from(oe.subarray(0,3)),J&&X==="playing"&&me&&!Me&&!I&&oe[6]===1&&oe[10]===0){if(se&&(D+=Math.min(.5,Math.hypot(Ye[0]-se[0],Ye[2]-se[2]))),D>=1.4&&v-ge>=180){const ut=d.get_block(Math.floor(oe[0]),Math.floor(oe[1]-.05),Math.floor(oe[2]));T.effect([oe[0],oe[1]+.02,oe[2]],P.get(xt.blocks[ut]?.name??"")??"stone",!1),D%=1.4,ge=v}}else D=0;se=Ye,T.frame(Ye,Ne,Oe,R,A,J&&X==="playing"&&!I);for(let ut=0;ut<3;ut++)it[ut]*=Math.exp(-F*12);Vi(oe),v-St>100&&(St=v,ee&&v>ee&&(ee=0,ke({message:J?"":"לחצו על העולם כדי להמשיך"})),ke({players:_.size+1,environment:y(),flying:oe[10]===1,pointerLocked:h(),...X==="playing"&&!Me&&M.status==="stalled"?{status:J?"playing":"paused",message:""}:{}}))}else bt=0}function As(v){j||(Ke=v,Nr(Ye.map((F,oe)=>F+it[oe]),v),at=requestAnimationFrame(As))}function Nr(v,F){const oe=1e3/(J&&X==="playing"?o:10);if(F<wt)return;wt=F+oe-(F-wt)%oe;const me=V===null?null:d.player_state(V);try{f.frame(v,Ne,Oe,_.frame(F),F,R,A,{state:M.selected,speed:me?Math.hypot(me[3],me[5]):0,active:J&&X==="playing"&&!I,itemType:M.mode==="survival"?M.inventory?.bag[M.selectedSlot]?.itemType??null:null,drops:[...Ae.values()],explosives:[...Ue.values()],vision:M.mode==="survival"&&x_((M.inventory?.equipment??[]).flatMap(Me=>{const lt=Me&&xt.items.find(rt=>rt.itemType===Me.itemType);return lt?[lt]:[]})).vision})}catch(Me){Kt("webgl",Me)}}const Rs=()=>f.resize(Math.max(1,i.clientWidth),Math.max(1,i.clientHeight)),Hi=new ResizeObserver(Rs);Hi.observe(i),Rs();const x=v=>{if(!(!J||a==="desktop"&&!h())&&(["Space","KeyW","KeyA","KeyS","KeyD","ShiftLeft","ShiftRight","ControlLeft","ControlRight"].includes(v.code)&&(v.preventDefault(),v.code==="Space"&&!m.has("Space")&&($=!0),m.add(v.code)),v.code==="KeyF"&&!v.repeat&&st({type:"flight"}),v.code==="KeyR"&&!v.repeat&&st({type:"eat"}),v.code==="KeyQ"&&!v.repeat&&st({type:"attack"}),v.code==="KeyG"&&!v.repeat&&st({type:"ignite"}),/^Digit[1-9]$/.test(v.code))){const F=Number(v.code.slice(-1))-1;if(M.mode==="survival")st({type:"select-slot",slot:F});else{const oe=w[F];oe&&st({type:"select",state:oe.state})}}},U=v=>m.delete(v.code),Z=v=>{h()&&q(v.movementX,v.movementY)};function q(v,F){!J||!Number.isFinite(v)||!Number.isFinite(F)||(Ne=Math.atan2(Math.sin(Ne+v*.002),Math.cos(Ne+v*.002)),Oe=Math.max(-1.55,Math.min(1.55,Oe-F*.002)))}const K=()=>{if(a==="touch")return;if(M.lifecycle==="ended"){ke({pointerLocked:!1});return}if(X==="dead"){ke({pointerLocked:!1});return}const v=h();Wt(v&&document.visibilityState==="visible"),ke({pointerLocked:v,status:I?"recovering":X==="playing"?v?"playing":"paused":M.status,message:M.role==="participant"&&M.lifecycle==="paused"?"העולם מושהה.":v?"":"לחצו על העולם כדי להמשיך"})},xe=v=>{if(a!=="touch"){if(!h()){st({type:"resume"});return}v.button===0&&(M.mode==="survival"?st({type:"mine",active:!0}):le="remove"),v.button===2&&st({type:"interact",kind:"place"})}},we=v=>{v.button===0&&st({type:"mine",active:!1})},ye=()=>Wt(!1),Re=()=>{document.visibilityState!=="visible"&&Wt(!1)},Ie=v=>v.preventDefault(),Xe=v=>{v.preventDefault(),f.contextLost(),Wt(!1),Kt("webgl","context lost")},$e=()=>{ke({status:"error",message:"התצוגה הופעלה מחדש. יש לרענן את העמוד."})};function Te(v){N?.readyState!==WebSocket.OPEN||performance.now()-mt>1500||!C||X!=="playing"||I||M.inventoryPending&&v.kind!=="close"||v.kind!=="open"&&de!==C.currentEpoch||(Le=++ne,ke({inventoryPending:!0}),vt({type:"inventory",epoch:C.currentEpoch,sequence:Le,operation:v}))}function ot(v){!C||X!=="playing"||I||(ke({inventoryOpen:!0}),De=v,J&&(Wt(!1),h()&&document.exitPointerLock()),Be?ke({inventoryPending:!0}):(De=null,Te(v)))}function st(v){if(!j){if(v.type==="ignite"){M.canIgnite&&J&&X==="playing"&&(ae=ce=!1,Q&&_n(null),Q="",le="ignite");return}if(v.type==="attack"){M.combat&&J&&X==="playing"&&(ae=ce=!1,Q&&_n(null),Q="",le="attack");return}if(v.type==="eat"){M.mode==="survival"&&M.inventory&&M.vitals&&M.vitals.food<20&&Te({kind:"consume",slot:M.selectedSlot,revision:M.inventory.revision});return}if(v.type==="respawn"){C&&X==="dead"&&M.vitals?.respawnIn===0&&vt({type:"respawn",epoch:C.currentEpoch,sequence:++ne});return}if(v.type==="mine"){if(v.active&&M.combat&&Ms(performance.now())){st({type:"attack"});return}ce=!1,M.mode==="creative"?(v.active&&!ae&&(le="remove"),ae=v.active):(ae=v.active,v.active||(Q&&_n(null),Q=""));return}if(v.type==="select-slot"){M.mode==="survival"&&M.inventory&&Number.isInteger(v.slot)&&v.slot>=0&&v.slot<9&&Te({kind:"select",slot:v.slot,revision:M.inventory.revision});return}if(v.type==="inventory-target"){te&&ot({kind:"open",target:[...te]});return}if(v.type==="inventory"){v.operation.kind==="open"?ot(v.operation):(v.operation.kind==="close"&&(De=null,ke({inventoryOpen:!1})),Te(v.operation));return}if(v.type==="select"&&M.mode==="creative"&&w.some(F=>F.state===v.state))ke({selected:v.state}),bs();else if(v.type==="interact"){const F=xt.items.find(oe=>oe.itemType===M.inventory?.bag[M.selectedSlot]?.itemType);v.kind==="place"&&M.mode==="survival"&&F?.igniter?st({type:"ignite"}):v.kind==="place"&&M.mode==="survival"&&F?.collects?le="collect":le=v.kind}else if(v.type==="resume"){if(M.lifecycle==="ended"||M.role==="participant"&&M.lifecycle!=="playing"||M.inventoryOpen||X==="dead")return;if(T.unlock(),a==="touch")Wt(document.visibilityState==="visible"&&document.hasFocus()),J&&ke({status:X==="playing"?"playing":M.status,message:""});else if(typeof u.requestPointerLock=="function")try{Promise.resolve(u.requestPointerLock()).catch(F=>mn("pointer_lock",F))}catch(F){mn("pointer_lock",F)}else ke({status:"unsupported",message:"הדפדפן אינו תומך בלכידת העכבר. אפשר להשתמש במכשיר מגע."})}else if(v.type==="pause"){if(X==="dead")return;Wt(!1),h()&&document.exitPointerLock(),ke({status:"paused",message:"לחצו על העולם כדי להמשיך"})}else if(v.type==="mute-effects")T.setMuted(v.muted),ke({effectsMuted:v.muted}),v.muted||T.unlock();else if(v.type==="look"&&a==="touch")q(v.dx,v.dy);else if(v.type==="touch"&&a==="touch"&&J){if(!Number.isFinite(v.x)||!Number.isFinite(v.z))return;v.jump&&!c.jump&&($=!0),c={x:Math.max(-1,Math.min(1,v.x)),z:Math.max(-1,Math.min(1,v.z)),jump:v.jump,sneak:v.sneak,sprint:v.sprint}}else v.type==="fullscreen"?(e.fullscreenElement??i).requestFullscreen?.().catch(F=>mn("fullscreen",F)):v.type==="reconnect"&&M.lifecycle!=="ended"?an():v.type==="flight"&&C&&X==="playing"&&(M.mode==="creative"||M.role==="observer")&&(gn(),vt({type:"flight",epoch:C.currentEpoch,sequence:++ne,on:!M.flying}))}}window.addEventListener("keydown",x),window.addEventListener("keyup",U),window.addEventListener("mouseup",we),window.addEventListener("mousemove",Z),window.addEventListener("blur",ye),document.addEventListener("visibilitychange",Re),document.addEventListener("pointerlockchange",K),u.addEventListener("mousedown",xe),u.addEventListener("contextmenu",Ie),u.addEventListener("webglcontextlost",Xe),u.addEventListener("webglcontextrestored",$e),B=setInterval(()=>kr(performance.now()),1e3/60),at=requestAnimationFrame(As);const gt={command:st,subscribe(v){return b.add(v),v(M),()=>b.delete(v)},debug(){return{disposed:j,inputMode:a,mode:M.mode,lifecycle:M.lifecycle,worldPauseReason:M.worldPauseReason,worldTick:p.read(performance.now()),mining:M.mining,vitals:M.vitals,combat:M.combat,hit:M.hit,lastHitEvent:he,lastExplosionEvent:ft,explosives:[...Ue.values()],canIgnite:M.canIgnite,miningHeld:ae,drops:[...Ae.values()],selectedSlot:M.selectedSlot,environment:{...R,openSky:A},atmosphere:f.atmosphere,avatars:f.actors,renderOrigin:{x:f.origin.x,z:f.origin.z},feedback:f.feedback,audio:T.stats,renderLimitHz:j?0:J&&X==="playing"?o:10,touch:{...c},focused:J,visible:document.visibilityState,hasFocus:document.hasFocus(),lastFrame:Ke,lastUpdate:yt,resources:{geometries:f.gl.info.memory.geometries,textures:f.gl.info.memory.textures,workers:W?.liveCount??0},actorId:ve,worldId:He,body:V===null?null:{position:Array.from(d.player_state(V).subarray(0,3)),onGround:d.player_state(V)[6],inWater:d.player_state(V)[7],eyesInWater:d.player_state(V)[8],frozen:d.player_state(V)[12],flying:d.player_state(V)[10],velocity:Array.from(d.player_state(V).subarray(3,6))},view:{yaw:Ne,pitch:Oe},lastResult:pe,inventory:M.inventory,inventoryOpen:M.inventoryOpen,inventoryPending:M.inventoryPending,recentEdits:_e,status:M.status,epoch:C?.currentEpoch,phase:X,position:Ye,selected:M.selected,players:_.size+1,inputLag:C?.inputLag,correction:C?.correction,columns:z?.columns.size,collisionColumns:z?.collisionCount,meshed:z?.meshCount,workers:W?.count,activeJobs:W?.active,stream:z?.stats,render:{...f.stats,gpu:f.gpuStats},target:te,targetState:!j&&te?d.get_block(...te):null,targetNormal:Ce,actionPending:g,queuedAction:le,actionSequence:ne,lastReceivedAgoMs:performance.now()-mt}},dispose(){if(!j){if(j=!0,e.signal?.removeEventListener("abort",pt),H++,cancelAnimationFrame(at),B!==null&&(clearInterval(B),B=null),E&&clearTimeout(E),N?.close(),h()&&document.exitPointerLock(),Object.is(document.fullscreenElement,e.fullscreenElement??i))try{Promise.resolve(document.exitFullscreen()).catch(v=>mn("fullscreen",v))}catch(v){mn("fullscreen",v)}Hi.disconnect(),window.removeEventListener("keydown",x),window.removeEventListener("keyup",U),window.removeEventListener("mouseup",we),window.removeEventListener("mousemove",Z),window.removeEventListener("blur",ye),document.removeEventListener("visibilitychange",Re),document.removeEventListener("pointerlockchange",K),u.removeEventListener("mousedown",xe),u.removeEventListener("contextmenu",Ie),u.removeEventListener("webglcontextlost",Xe),u.removeEventListener("webglcontextrestored",$e),zi(),f.dispose(),T.dispose(),d.free(),b.clear(),u.remove()}}},pt=()=>gt.dispose();return e.signal?.addEventListener("abort",pt,{once:!0}),e.signal?.aborted?gt.dispose():an(),gt}function J_(i,e){const t=document.createElement("div");t.className="voxel-touch",t.setAttribute("aria-label","בקרי מגע");const n=document.createElement("div");n.className="voxel-touch-aim",n.setAttribute("aria-label","גרירה לשינוי כיוון המבט");const s=document.createElement("div");s.className="voxel-touch-stick",s.setAttribute("role","group"),s.setAttribute("aria-label","ג׳ויסטיק תנועה");const r=document.createElement("span");r.className="voxel-touch-knob",r.setAttribute("aria-hidden","true"),s.append(r);const a=document.createElement("div");a.className="voxel-touch-actions",t.append(n,s,a),i.append(t);const o=new AbortController,l=o.signal,c=new Map;let u=null,h=null,d=0,f=0,_=0,b=0,m=0,p=0,T=1,P=!1;const S=()=>{const O=[...c.values()];e.command({type:"mine",active:O.includes("mine")}),e.command({type:"touch",x:d,z:f,jump:O.includes("jump"),sneak:O.includes("sneak"),sprint:O.includes("sprint")})},R=(O,I)=>{I.preventDefault(),O.setPointerCapture(I.pointerId),e.command({type:"resume"})},A=()=>{c.clear(),u=h=null,d=f=0,r.style.transform="translate(0px, 0px)",a.querySelectorAll("button").forEach(O=>O.classList.remove("held")),S()},L=O=>{if(O.pointerId!==u)return;const I=(O.clientX-m)/T,j=(O.clientY-p)/T,H=Math.hypot(I,j),X=Math.max(1,H);d=H<.12?0:I/X,f=H<.12?0:j/X,r.style.transform=`translate(${d*T}px, ${f*T}px)`,S()};s.addEventListener("pointerdown",O=>{if(u!==null)return;R(s,O);const I=s.getBoundingClientRect();m=I.x+I.width/2,p=I.y+I.height/2,T=I.width*.34,u=O.pointerId,L(O)},{signal:l}),s.addEventListener("pointermove",L,{signal:l});const y=O=>{O.pointerId===u&&(u=null,d=f=0,r.style.transform="translate(0px, 0px)",S())};for(const O of["pointerup","pointercancel","lostpointercapture"])s.addEventListener(O,y,{signal:l});n.addEventListener("pointerdown",O=>{h===null&&(R(n,O),h=O.pointerId,_=O.clientX,b=O.clientY)},{signal:l}),n.addEventListener("pointermove",O=>{O.pointerId===h&&(e.command({type:"look",dx:(O.clientX-_)*2.5,dy:(O.clientY-b)*2.5}),_=O.clientX,b=O.clientY)},{signal:l});for(const O of["pointerup","pointercancel","lostpointercapture"])n.addEventListener(O,I=>{I.pointerId===h&&(h=null)},{signal:l});const w=(O,I,j)=>{const H=document.createElement("button");H.type="button",H.textContent=O,j&&(H.dataset.control=j),a.append(H),H.addEventListener("pointerdown",X=>{R(H,X),j?(c.set(X.pointerId,j),H.classList.add("held"),S()):I()},{signal:l});for(const X of["pointerup","pointercancel","lostpointercapture"])H.addEventListener(X,J=>{c.delete(J.pointerId),j&&![...c.values()].includes(j)&&H.classList.remove("held"),S()},{signal:l});return H.addEventListener("click",X=>{X.detail===0&&(e.command({type:"resume"}),I())},{signal:l}),H};w("קפיצה / מעלה",()=>{e.command({type:"touch",x:d,z:f,jump:!0,sneak:!1,sprint:!1}),S()},"jump"),w("מטה / התכופפות",()=>{},"sneak"),w("ריצה",()=>{},"sprint");const M=w("תעופה",()=>e.command({type:"flight"})),N=w("תקיפה (Q)",()=>e.command({type:"attack"})),W=w("הצתה (G)",()=>e.command({type:"ignite"}));w("בנייה",()=>e.command({type:"interact",kind:"place"})),w("כרייה / הסרה",()=>{},"mine");const z=w("השהיה",()=>{e.command({type:"pause"}),A()}),C=O=>{t.hidden=O.inputMode!=="touch",M.hidden=O.mode==="survival"&&O.role!=="observer",N.hidden=!O.combat,W.hidden=!O.canIgnite,W.disabled=O.status!=="playing",N.disabled=O.status!=="playing"||(O.vitals?.attackCooldown??0)>0,M.setAttribute("aria-pressed",String(O.flying)),O.status!=="playing"&&A(),z.disabled=O.status!=="playing"},V=e.subscribe(C);return window.addEventListener("blur",A,{signal:l}),document.addEventListener("visibilitychange",A,{signal:l}),{dispose(){P||(P=!0,A(),V(),o.abort(),t.remove())}}}function lr(i){const e=[];return i.collects&&e.push("לחיצה על בנייה מול מים ממלאת את הדלי"),i.remainder&&e.push("הנחת מים מחזירה דלי ריק"),i.food&&e.push(`מזון: עד ${i.food} נקודות`),i.tool&&e.push(`${{pickaxe:"מכוש",axe:"גרזן",shovel:"את"}[i.tool.kind]} · דרגה ${i.tool.tier} · מהירות כרייה ×${i.tool.speed}`),i.activation==="held"?e.push("ההשפעה פעילה כשהפריט נבחר בסרגל"):i.equipment&&e.push(`מקום ציוד: ${{head:"ראש",body:"גוף",legs:"רגליים",feet:"כפות רגליים",offhand:"יד שנייה"}[i.equipment]}`),i.modifiers?.speed&&e.push(`מהירות תנועה ×${i.modifiers.speed}`),i.modifiers?.jump&&e.push(`עוצמת קפיצה ×${i.modifiers.jump}`),i.perks?.fallImmune?e.push("חסינות לנזק נפילה"):i.modifiers?.fall&&e.push(`הפחתת נזק נפילה ${Math.round(i.modifiers.fall*100)}%`),i.modifiers?.armor&&e.push(`הגנה מתקיפות ומפיצוצים ${Math.round(i.modifiers.armor*100)}%`),i.perks?.sunRegen&&e.push("ריפוי באור שמש ישיר"),i.perks?.vision&&e.push("ראייה משופרת בחושך"),e.join(" · ")}function Q_(i,e,t,n,s=i.ownerDocument.body){const r=new Map(t.items.map(I=>[I.itemType,I])),a=(I,j)=>{const H=document.createElement("button");return H.type="button",H.textContent=I,H.addEventListener("click",j),H},o=a("תיק ויצירה (E)",()=>e.command({type:"inventory",operation:{kind:"open",target:null}}));o.id="inventory-open";const l=a("פתיחת שולחן / תיבה",()=>e.command({type:"inventory-target"}));l.id="inventory-use",i.prepend(o);const c=document.createElement("dialog");c.className="voxel-inventory",c.dir="rtl",c.setAttribute("aria-labelledby","inventory-title");const u=document.createElement("h2");u.id="inventory-title",u.textContent="תיק ויצירה";const h=a("סגירה",()=>e.command({type:"inventory",operation:{kind:"close"}}));h.id="inventory-close";const d=document.createElement("header");d.append(u,l,h);const f=document.createElement("p");f.setAttribute("role","status");const _=document.createElement("p");_.className="inventory-hint",_.textContent="בחרו ערימה ואז משבצת יעד. לחיצה ימנית או Shift מעבירים פריט אחד. פתיחת התיק משאירה את שאר העולם פעיל.";const b=document.createElement("p");b.id="inventory-item-details",b.setAttribute("aria-live","polite"),b.hidden=!0;const m=a("השלכת פריט מהערימה שנבחרה",()=>{S?.area==="bag"&&P.inventory&&!P.inventoryPending&&e.command({type:"inventory",operation:{kind:"drop",slot:S.slot,count:1,revision:P.inventory.revision}})});m.id="inventory-drop";const p=a("אכילת פריט מהערימה שנבחרה",()=>{S?.area==="bag"&&P.inventory&&!y()&&e.command({type:"inventory",operation:{kind:"consume",slot:S.slot,revision:P.inventory.revision}})});p.id="inventory-eat";const T=document.createElement("div");T.className="inventory-body",c.append(d,f,_,b,m,p,T),s.append(c);let P,S=null,R=null,A=!1,L=t.items[0]?.itemType??"";const y=()=>P.inventoryPending||P.lifecycle!=="playing"||!["playing","paused"].includes(P.status),w=I=>n[I]??t.items.find(j=>j.itemType===I)?.labelKey??I,M=I=>I.area==="container"?P.inventory?.container?.slots[I.slot]??null:P.inventory?.[I.area][I.slot]??null,N=(I,j)=>{const H=P.inventory;if(!H||P.inventoryPending)return;if(!S){M(I)&&(S=I),z();return}if(S.area===I.area&&S.slot===I.slot){S=null,z();return}const X=M(S);X&&e.command({type:"inventory",operation:{kind:"move",from:S,to:I,count:j?1:X.count,revision:H.revision,containerId:H.container?.id??null,containerRevision:H.container?.revision??null}}),S=null};function W(I,j,H,X){const J=document.createElement("section"),Se=document.createElement("h3");Se.textContent=I;const ve=document.createElement("div");return ve.className="inventory-grid",ve.style.setProperty("--columns",String(X)),H.forEach((He,Ne)=>{const Oe={area:j,slot:Ne},$=a("",()=>{});$.dataset.area=j,$.dataset.slot=String(Ne);const ne=j==="equipment"?["ראש","גוף","רגליים","כפות רגליים","יד שנייה"][Ne]:String(Ne+1),le=He&&t.items.find(he=>he.itemType===He.itemType),Ee=He?`${w(He.itemType)} ×${He.count}${He.instance?.durability?` · עמידות ${He.instance.durability}`:""}${le&&lr(le)?` · ${lr(le)}`:""}`:"ריק";$.textContent=He?`${w(He.itemType)} ×${He.count}`:"—",$.title=Ee,$.setAttribute("aria-label",`${I} ${ne}: ${Ee}`),$.disabled=y(),$.setAttribute("aria-pressed",String(S?.area===j&&S.slot===Ne)),$.addEventListener("click",he=>N(Oe,he.shiftKey)),$.addEventListener("contextmenu",he=>{he.preventDefault(),N(Oe,!0)}),ve.append($)}),J.append(Se,ve),T.append(J),J}function z(){const I=S&&M(S),j=I&&t.items.find(Ee=>Ee.itemType===I.itemType);b.textContent=j?`${w(j.itemType)}: ${lr(j)}`:"",b.hidden=!j||!lr(j),m.disabled=S?.area!=="bag"||y(),p.hidden=P.mode!=="survival",p.disabled=S?.area!=="bag"||!t.items.find(Ee=>Ee.itemType===(S?M(S)?.itemType:null))?.food||y()||P.vitals?.food===20;const H=document.activeElement,X=H?.dataset.area,J=H?.dataset.slot;T.replaceChildren();const Se=P.inventory;if(!Se)return;W("תיק","bag",Se.bag,9),W("ציוד","equipment",Se.equipment,li.length);const ve=Se.station==="workbench"?3:2,He=ve===3?Se.craft3:Se.craft2,Ne=W(ve===3?"שולחן יצירה 3×3":"יצירה 2×2",ve===3?"craft3":"craft2",He,ve),Oe=h_(He,ve,t.recipes,r),$=a(Oe?`יצירה: ${w(Oe.result.itemType)} ×${Oe.result.count}`:"סדרו פריטים לפי מתכון",()=>e.command({type:"inventory",operation:{kind:"craft",grid:ve,count:1,revision:Se.revision}}));if($.id="inventory-craft",$.disabled=!Oe||y(),Ne.append($),ve!==3&&Se.craft3.some(Boolean)&&W("פריטים שנשמרו משולחן יצירה","craft3",Se.craft3,3),Se.container&&W("תיבה משותפת","container",Se.container.slots,9),Se.catalog){const Ee=document.createElement("section"),he=document.createElement("h3");he.textContent="קטלוג יצירתי";const Fe=document.createElement("select");Fe.id="inventory-catalog",Fe.setAttribute("aria-label","פריט מהקטלוג היצירתי");for(const Ue of t.items){const Ve=document.createElement("option");Ve.value=Ue.itemType,Ve.textContent=w(Ue.itemType),Fe.append(Ve)}Fe.value=L,Fe.addEventListener("change",()=>{L=Fe.value});const ft=a("הוספה לתיק",()=>{const Ue=t.items.find(Ve=>Ve.itemType===Fe.value);Ue&&e.command({type:"inventory",operation:{kind:"give",itemType:Ue.itemType,count:Math.min(64,Ue.maxStack),revision:Se.revision}})});ft.id="inventory-give",ft.disabled=y(),Ee.append(he,Fe,ft),T.append(Ee)}const ne=document.createElement("details"),le=document.createElement("summary");le.textContent="מתכונים",ne.append(le);for(const Ee of t.recipes){const he=document.createElement("p");he.textContent=`${w(Ee.result.itemType)} ×${Ee.result.count} (${Ee.size}×${Ee.size}): ${Array.from({length:Ee.size},(Fe,ft)=>Ee.ingredients.slice(ft*Ee.size,(ft+1)*Ee.size).map(Ue=>Ue?w(Ue):"—").join(" / ")).join(" · ")}`,ne.append(he)}T.append(ne),X&&J&&T.querySelector(`[data-area="${X}"][data-slot="${J}"]`)?.focus()}const C=e.subscribe(I=>{const j=P?.inventoryPending!==I.inventoryPending,H=P?.status!==I.status||P?.lifecycle!==I.lifecycle,X=P?.vitals?.food!==I.vitals?.food;P=I,I.inventoryOpen&&!c.open&&(c.showModal(),h.focus()),!I.inventoryOpen&&c.open&&(c.close(),S=null);const J=I.inventory!==null&&I.lifecycle==="playing"&&!I.inventoryPending&&["playing","paused"].includes(I.status);o.disabled=l.disabled=!J,f.textContent=I.inventoryPending?"ממתינים לעדכון…":I.message.startsWith("לחצו על העולם")?"":I.message,(I.inventory!==R||j||H||X)&&((I.inventory?.revision!==R?.revision||I.inventory?.container?.id!==R?.container?.id)&&(S=null),R=I.inventory,z())}),V=I=>{I.preventDefault(),e.command({type:"inventory",operation:{kind:"close"}})},O=I=>{I.repeat||I.code!=="KeyE"||I.target instanceof HTMLElement&&["INPUT","SELECT","TEXTAREA"].includes(I.target.tagName)||!P.inventoryOpen&&(!P.inventory||y()||P.role==="observer")||(I.preventDefault(),e.command({type:"inventory",operation:P.inventoryOpen?{kind:"close"}:{kind:"open",target:null}}))};return c.addEventListener("cancel",V),window.addEventListener("keydown",O),{dispose(){A||(A=!0,C(),window.removeEventListener("keydown",O),c.removeEventListener("cancel",V),c.close(),c.remove(),o.remove(),l.remove())}}}const fn={bucket:"דלי",water_bucket:"דלי מים",dirt:"אדמה",glass:"זכוכית",glowstone:"אבן מאירה",grass_block:"דשא",ladder:"סולם",lava:"לבה",oak_leaves:"עלים",oak_log:"גזע עץ",oak_planks:"קרשי עץ",oak_stairs:"מדרגות עץ",sand:"חול",short_grass:"עשב",stone:"אבן",stone_slab:"חצי אבן",torch:"לפיד",water:"מים",chest:"תיבה",crafting_table:"שולחן יצירה",stick:"מקל",wooden_pickaxe:"מכוש עץ",stone_pickaxe:"מכוש אבן",wooden_axe:"גרזן עץ",wooden_shovel:"את עץ",trail_boots:"מגפי שטח",swift_pickaxe:"מכוש זריז",feather_talisman:"קמע נוצה",helios_medallion:"מדליון שמש",helium_boots:"מגפי הליום",glow_talisman:"קמע זוהר",apple:"תפוח",heavy_shield:"מגן כבד",tnt:"TNT",charcoal:"פחם עץ",gunpowder:"אבקת הבזק",firestarter:"מצת"},$_={air:"אוויר",bedrock:"סלע יסוד",cobblestone:"אבן מרוצפת",bricks:"לבנים",bookshelf:"ספרייה",mossy_cobblestone:"אבן מרוצפת עם אזוב",stone_bricks:"לבני אבן",mossy_stone_bricks:"לבני אבן עם אזוב",granite:"גרניט",diorite:"דיוריט",andesite:"אנדזיט",deepslate:"אבן עומק",gravel:"חצץ",sandstone:"אבן חול",obsidian:"אובסידיאן",snow:"שלג",ice:"קרח",snowy_grass:"אדמת שלג",sponge:"ספוג נוי",pumpkin:"דלעת",melon:"אבטיח",cactus:"קקטוס",sapling:"שתיל נוי",dandelion:"שן הארי",poppy:"פרג",cornflower:"דרדר",dead_bush:"שיח יבש",brown_mushroom:"פטרייה חומה",red_mushroom:"פטרייה אדומה",sugar_cane:"קנה סוכר",coal:"פחם",iron_ingot:"מטיל ברזל",gold_ingot:"מטיל זהב",diamond:"יהלום",lapis:"לפיס",plant_fiber:"סיבי צמח",wheat:"חיטה",sugar:"סוכר",cocoa_beans:"פולי קקאו",egg:"ביצה",bread:"לחם",cookie:"עוגייה",melon_slice:"פלח אבטיח",carrot:"גזר",golden_carrot:"גזר זהוב",potato:"תפוח אדמה",baked_potato:"תפוח אדמה אפוי",cake:"עוגה",paper:"נייר",iron_vest:"אפודת ברזל","#planks":"קרשים (כל סוג)","#logs":"גזעים (כל סוג)","#leaves":"עלים (כל סוג)","#fuel":"פחם או פחם עץ"};Object.assign(fn,$_);for(const[i,e]of Object.entries({white:"לבן",orange:"כתום",magenta:"ארגמן",light_blue:"תכלת",yellow:"צהוב",lime:"ירוק בהיר",pink:"ורוד",gray:"אפור",light_gray:"אפור בהיר",cyan:"טורקיז",purple:"סגול",blue:"כחול",brown:"חום",green:"ירוק",red:"אדום",black:"שחור"}))fn[`${i}_wool`]=`צמר ${e}`,fn[`${i}_concrete`]=`בטון ${e}`,fn[`${i}_stained_glass`]=`זכוכית בצבע ${e}`,fn[`${i}_pigment`]=`פיגמנט ${e}`;for(const[i,e]of Object.entries({oak:"אלון",birch:"ליבנה",spruce:"אשוח"}))fn[`${i}_log`]=`גזע ${e}`,fn[`${i}_planks`]=`קרשי ${e}`,fn[`${i}_leaves`]=`עלי ${e}`;for(const[i,e]of Object.entries({coal:"פחם",iron:"ברזל",gold:"זהב",diamond:"יהלום",lapis:"לפיס"}))fn[`${i}_ore`]=`עפרת ${e}`,i!=="coal"&&(fn[`${i}_block`]=`גוש ${e}`);for(const[i,e]of Object.entries({wooden:"עץ",stone:"אבן",iron:"ברזל",diamond:"יהלום"}))for(const[t,n]of Object.entries({pickaxe:"מכוש",axe:"גרזן",shovel:"את"}))fn[`${i}_${t}`]=`${n} ${e}`;export{fn as ITEM_LABELS,xt as content,Ri as identity,Q_ as mountInventoryControls,J_ as mountTouchControls,Z_ as mountVoxel,Nu as supportProblem};
