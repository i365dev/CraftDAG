# Blender 5.2.2 headless scene authoring for CraftDAG issue #114 Stage 1B.
# Coordinates are authored Y-up to match Stage 1A and CraftDAG mesh adapter.
import bpy, math, os, sys
from mathutils import Vector

CASES = ("simple-house", "castle-tower", "ship", "statue", "dragon")
CASE = next((a for a in sys.argv[sys.argv.index("--")+1:] if a in CASES), None) if "--" in sys.argv else None
if CASE is None: raise RuntimeError("Pass one case after --: " + ", ".join(CASES))
OUT = os.environ.get("STAGE1B_OUT", os.path.abspath("experiments/stage-1b-blender/artifacts"))
os.makedirs(OUT, exist_ok=True)

# Reset default scene; keep intentional object and collection names as lightweight semantics.
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name != "Collection": bpy.data.collections.remove(c)
root = bpy.context.scene.collection
collections = {}
def coll(name):
    if name not in collections:
        c=bpy.data.collections.new(name); root.children.link(c); collections[name]=c
    return collections[name]
def place(obj, name, group):
    obj.name=name
    for c in list(obj.users_collection): c.objects.unlink(obj)
    coll(group).objects.link(obj)
    return obj
def mat(name, color):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.diffuse_color=(*color,1); m.use_nodes=True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(*color,1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value=.78
    return m
wood=mat("warm timber",(0.38,.19,.075)); stone=mat("weathered stone",(.38,.4,.39))
roofmat=mat("roof slate",(.16,.2,.23)); sailmat=mat("canvas",(.78,.7,.48))
bronze=mat("aged bronze",(.32,.42,.36)); dragonmat=mat("deep green",(.13,.28,.21))
dark=mat("recess",(.055,.045,.03)); accent=mat("gold details",(.65,.43,.13))
def finish(obj,name,group,material):
    place(obj,name,group); obj.data.materials.append(material)
    return obj
def cube(name, dims, loc, group, material, rot=(0,0,0), bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o=bpy.context.object; o.dimensions=dims; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.rotation_euler=rot
    if bevel:
        mod=o.modifiers.new("small worn edges","BEVEL"); mod.width=bevel; mod.segments=1
    return finish(o,name,group,material)
def uv(name, loc, scale, group, material, seg=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc)
    o=bpy.context.object; o.scale=scale; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o,name,group,material)
def cyl(name, radius, depth, loc, group, material, vertices=16, r=(math.pi/2,0,0), radius2=None):
    op=bpy.ops.mesh.primitive_cone_add if radius2 is not None else bpy.ops.mesh.primitive_cylinder_add
    kw=dict(vertices=vertices, depth=depth, location=loc, rotation=r)
    if radius2 is not None: kw.update(radius1=radius, radius2=radius2)
    else: kw["radius"]=radius
    op(**kw); return finish(bpy.context.object,name,group,material)
def mesh_obj(name, verts, faces, loc, group, material):
    me=bpy.data.meshes.new(name+" mesh"); me.from_pydata(verts,[],faces); me.materials.append(material)
    o=bpy.data.objects.new(name,me); coll(group).objects.link(o); o.location=loc
    return o
def rod(name,a,b,radius,group,material,vertices=12):
    # Blender cylinders run along local Z; rotate their axis to the endpoint vector.
    av,bv=Vector(a),Vector(b); d=bv-av
    o=cyl(name,radius,d.length,(av+bv)*.5,group,material,vertices)
    o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return o
def make_house():
    cube("ground_floor_walls",(24,20,16),(0,10,0),"walls",wood)
    cube("upper_floor_walls",(22,18,15),(0,27.5,0),"walls",wood)
    # Dark inset panels preserve readable apertures without voxel-specific geometry.
    cube("front_door",(3.4,7,0.5),(0,3.6,-8.25),"openings",dark)
    for x in (-7,7):
        cube("ground_window_"+str(x),(4.2,4.2,.6),(x,12,-8.3),"openings",dark)
        cube("upper_window_"+str(x),(4.2,4.2,.6),(x,29,-9.3),"openings",dark)
    # two pitched roof slabs, ridge parallel to depth.
    cube("left_roof",(15,2.4,24),(-7.1,38,0),"roof",roofmat,(0,0,.55))
    cube("right_roof",(15,2.4,24),(7.1,38,0),"roof",roofmat,(0,0,-.55))
def make_tower():
    cyl("tower_shaft",11,49,(0,24.5,0),"tower",stone)
    cyl("flared_base",14,9,(0,4.5,0),"tower",stone)
    cyl("upper_walkway",13,5,(0,51,0),"lookout",stone)
    cube("entrance_shadow",(4.2,9,.7),(0,5,-11.1),"openings",dark)
    cube("arrow_slit",(1.5,5,.7),(0,35,-11.15),"openings",dark)
    for i in range(8):
        a=i*math.tau/8
        cube("merlon_%02d"%i,(3.2,5,3.2),(math.cos(a)*10,56,math.sin(a)*10),"battlements",stone)
def make_ship():
    # Boat length is X, height Y, beam Z; low-poly closed tapered hull section.
    stations=[(-16,5,0),(-13,3.8,5),(-7,3,7),(7,3,7),(14,4.2,5),(17,6,0)]
    verts=[]
    for x,y,z in stations:
        keel_y=max(1.8,y-4)
        verts.extend([(x,y,-z),(x,keel_y,0),(x,y,z)])
    faces=[]
    for i in range(len(stations)-1):
        a=3*i; b=a+3
        faces.extend([(a,b,b+1,a+1),(a+1,b+1,b+2,a+2),(a,a+2,b+2,b)])
    faces += [(0,1,2),(len(verts)-3,len(verts)-2,len(verts)-1)]
    mesh_obj("continuous_tapered_hull",verts,faces,(0,0,0),"hull",wood)
    cube("deck",(27,1.7,13),(0,8.2,0),"deck",wood)
    cube("front_rail",(26,2,1.1),(0,9.7,-6.5),"deck",wood)
    cyl("mast",1.35,48,(0,32,0),"mast",wood,12)
    cube("yard",(29,1.2,1.2),(0,39,0),"mast",wood)
    mesh_obj("lower_sail",[(-7,10,0),(7,10,0),(6,34,0),(-6,34,0)],[(0,1,2,3)],(0,0,0),"sails",sailmat)
    mesh_obj("upper_sail",[(-5,38,0),(5,38,0),(4.5,52,0),(-4.5,52,0)],[(0,1,2,3)],(0,0,0),"sails",sailmat)
def make_statue():
    cube("monument_base",(23,6,18),(0,3,0),"plinth",stone)
    cube("upper_step",(18,3,14),(0,7.5,0),"plinth",stone)
    uv("torso",(0,31,0),(6.4,11,4.7),"body",bronze)
    cyl("neck",3,5,(0,43,0),"body",bronze)
    uv("head",(0,51,0),(4.8,5.2,4.5),"head",bronze)
    cube("brow",(7,1.1,1),(0,54,-4),"head",bronze)
    # Arms angle gently down from shoulders, legs separate under tunic.
    rod("left_arm",(-5,39,0),(-10,23,0),2.1,"limbs",bronze)
    rod("right_arm",(5,39,0),(10,23,0),2.1,"limbs",bronze)
    rod("left_leg",(-3.5,20,0),(-4,10,0),2.6,"limbs",bronze)
    rod("right_leg",(3.5,20,0),(4,10,0),2.6,"limbs",bronze)
def make_dragon():
    uv("torso",(0,27,0),(13.5,8,7.5),"body",dragonmat,20,12)
    uv("chest",(8,29,0),(8,9,7),"body",dragonmat)
    rod("arched_neck",(9,30,0),(15,42,0),4.5,"neck",dragonmat)
    uv("head",(19,44,0),(6.5,4.8,5.5),"head",dragonmat)
    # tapered snout axis along X
    cyl("snout",3.7,8,(25,43,0),"head",dragonmat,12, (0,math.pi/2,0), radius2=1.6)
    rod("horn", (17,48,0),(16,54,0),1.1,"head",accent)
    rod("tail_base",(-10,25,0),(-24,22,0),4.2,"tail",dragonmat)
    rod("tail_tip",(-24,22,0),(-40,20,0),2.0,"tail",dragonmat)
    # Each wing uses a raised leading spar and a broad polygon membrane.
    for side,label in [(1,"near"),(-1,"far")]:
        z=side*4
        rod(label+"_wing_spar",(0,31,z),(-7,54,side*18),1.7,"wings",dragonmat)
        verts=[(1,34,side*4),(-7,54,side*18),(-4,38,side*21),(5,36,side*13),(8,33,side*5)]
        mesh_obj(label+"_wing_membrane",verts,[(0,1,2,3,4)],(0,0,0),"wings",dragonmat)
    for x in (-7,7):
        for z in (-5,5):
            rod("leg_%s_%s"%(x,z),(x,25,z),(x+(-1 if x<0 else 1),12,z),2.4,"legs",dragonmat)
            uv("foot_%s_%s"%(x,z),(x+(-1 if x<0 else 1),11,z),(3,1.4,2.5),"legs",dragonmat)
BUILD={"simple-house":make_house,"castle-tower":make_tower,"ship":make_ship,"statue":make_statue,"dragon":make_dragon}
BUILD[CASE]()
# Normalize mesh bounds to exact 64-unit Y extent, with base at zero. This is a general scale step.
meshes=[o for o in bpy.context.scene.objects if o.type=="MESH"]
deps=bpy.context.evaluated_depsgraph_get()
coords=[o.matrix_world @ Vector(corner) for o in meshes for corner in o.bound_box]
ymin=min(p.y for p in coords); ymax=max(p.y for p in coords); scale=64/(ymax-ymin)
for o in meshes:
    o.location=(o.location.x,(o.location.y-ymin)*scale,o.location.z)
    o.scale*=scale
bpy.context.view_layer.update()
# Set camera and lighting for legible neutral three-quarter evidence.
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.cavity_type='BOTH'
scene.render.resolution_x=1000; scene.render.resolution_y=850; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world.color=(.055,.055,.055)
center=Vector((0,32,0))
cam_data=bpy.data.cameras.new("review_camera"); cam=bpy.data.objects.new("review_camera",cam_data); scene.collection.objects.link(cam)
cam.location=Vector((95,92,-125)); cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
cam_data.type='ORTHO'; cam_data.ortho_scale=max(86, max((p-center).length for p in coords)*2.2)
scene.camera=cam
ld=bpy.data.lights.new("large_softbox","AREA"); lo=bpy.data.objects.new("large_softbox",ld); scene.collection.objects.link(lo); lo.location=(30,95,-40); ld.energy=5200; ld.shape='DISK'; ld.size=70
scene.view_settings.view_transform='Standard'
scene.render.filepath=os.path.join(OUT,CASE+"-blender.png")
# Useful viewport defaults on reopen.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=115
# Select mesh objects for reliable export; Blender 5 ships OBJ exporter.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
blend=os.path.join(OUT,CASE+".blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)
# Export Blender authored geometry; export materials are incidental, adapter uses geometry.
obj=os.path.join(OUT,CASE+".obj")
bpy.ops.wm.obj_export(filepath=obj, export_selected_objects=True, forward_axis='Y', up_axis='Z', export_uv=False, export_normals=False, export_materials=False)
scene.render.filepath=os.path.join(OUT,CASE+"-blender.png")
bpy.ops.render.render(write_still=True)
print("EXPORTED",CASE,obj,"mesh_objects",len(meshes))
