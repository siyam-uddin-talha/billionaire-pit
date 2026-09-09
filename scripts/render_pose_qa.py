import bpy,os
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=os.path.abspath('scripts/fighter-source.blend'))
rig=bpy.data.objects['FighterRig'];scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=640;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.world.color=(.15,.17,.14)
bpy.ops.object.camera_add(location=(3,-5.5,2.8));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.2,1.1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.8;scene.camera=cam
for loc,power,col in [((-3,-4,5),600,(1,.95,.9)),((3,0,3),400,(.6,.8,1))]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.color=col;light.data.size=4;light.rotation_euler=(Vector((0,0,1.2))-light.location).to_track_quat('-Z','Y').to_euler()
tracks={t.name:t.strips[0].action for t in rig.animation_data.nla_tracks}
for t in rig.animation_data.nla_tracks:t.mute=True
for name,frame in [('idle',1),('punch_light',6),('kick_front',10),('ko',30),('victory',50)]:
 rig.animation_data.action=tracks[name];scene.frame_set(frame);bpy.context.view_layer.update();scene.render.filepath='/tmp/pit-pose-'+name+'.png';bpy.ops.render.render(write_still=True)
