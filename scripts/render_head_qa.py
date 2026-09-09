"""Render the four fitted heads from front, three-quarter and profile views."""
import bpy, bmesh, math, os, sys
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_head import build_head, PROFILES

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
atlas = os.path.abspath('public/models/fighter-face-atlas.png')
for row, fid in enumerate(PROFILES):
    skin = bpy.data.materials.new('QA skin'); skin.use_nodes = True
    head = build_head(fid, atlas, skin)
    topology=bmesh.new(); topology.from_mesh(head.data)
    assert all(edge.is_manifold for edge in topology.edges), fid+' has an open head surface'
    topology.free()
    assert all(len(vertex.groups)==1 and vertex.groups[0].weight==1 for vertex in head.data.vertices), fid+' has an unweighted head vertex'
    mapped=[loop.uv[:] for loop in head.data.uv_layers['Face atlas UV'].data]
    assert all(0<=u<=1 and 0<=v<=1 for u,v in mapped), fid+' has invalid texture coordinates'
    assert max(u for u,v in mapped)-min(u for u,v in mapped)>.1, fid+' lost its texture mapping'
    print('HEAD VERIFIED',fid,len(head.data.vertices),'vertices, closed surfaces, head weights and UVs valid')
    for col, angle in enumerate([0, math.pi/4, math.pi/2]):
        obj = head if col == 0 else head.copy()
        if col: bpy.context.collection.objects.link(obj)
        obj.location = ((col-1)*.55, 0, (3-row)*.54-1.62)
        obj.rotation_euler[2] = angle
    bpy.ops.object.text_add(location=(-.76, -.04, (3-row)*.54+.075), rotation=(math.pi/2, 0, 0))
    text = bpy.context.object; text.data.body = fid.replace('_', ' ').upper(); text.data.size = .035
    ink = bpy.data.materials.get('Label') or bpy.data.materials.new('Label')
    ink.diffuse_color=(.7,.75,.8,1); text.data.materials.append(ink)

scene = bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.render.resolution_x=1536; scene.render.resolution_y=2048; scene.render.resolution_percentage=100
scene.world.color=(.11,.11,.11)
scene.view_settings.view_transform='Standard'
bpy.ops.object.camera_add(location=(0,-6,1.19))
cam=bpy.context.object; cam.rotation_euler=(Vector((0,0,1.19))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO'; cam.data.ortho_scale=2.35; scene.camera=cam
for loc, power in [((-3,-4,5),400),((3,-3,3),250),((0,3,4),250)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object; light.data.energy=power; light.data.size=4
    light.rotation_euler=(Vector((0,0,1.2))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath='/tmp/pit-head-fit-qa.png'; bpy.ops.render.render(write_still=True)
