"""Original low-poly fighters, shared skinned rig, clips, arena and trophy. Blender 4.5+."""
import bpy, math, os, json, sys
from mathutils import Vector, Matrix
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT,'public','models')
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_head import build_head
from build_upper_body import build_upper_body
from build_lower_body import build_lower_body

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for d in list(bpy.data.actions): bpy.data.actions.remove(d)

def mat(name, color, metal=0, rough=.5, emit=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1); p.inputs['Emission Strength'].default_value=emit
    return m

def uv(name, loc, scale, material, bone=None, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=16, location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth=True
    if bone: o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE')
    return o

def box(name, loc, scale, material, bone=None, bevel=.04):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Soft manufactured edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material)
    if bone:o.vertex_groups.new(name=bone).add(list(range(len(o.data.vertices))),1,'REPLACE')
    return o

def limb(name, a,b, radius, material, bone):
    a,b=Vector(a),Vector(b);o=uv(name,(a+b)/2,(radius,radius,(b-a).length/2+radius*.4),material,bone)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference(b-a)
    bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
    return o

ROSTER=[('elon_musk',(.55,.345,.26),(.075,.045,.035),(.64,.9,.045),1.08,1.05),('mark_zuckerberg',(.57,.37,.29),(.21,.095,.045),(.16,.38,.95),.91,.99),('dario_amodei',(.50,.31,.23),(.045,.025,.022),(.64,.18,.95),.98,1.03),('sam_altman',(.55,.36,.27),(.12,.065,.039),(.05,.75,.81),.94,.98)]
for fid,skinC,hairC,accentC,width,headscale in ROSTER:
    reset()
    skin=mat('Skin',skinC,0,.59); shadow=mat('Skin contours',tuple(v*.72 for v in skinC),0,.65)
    hair=mat('Hair',tuple(v*.34 for v in hairC),0,.92); black=mat('Obsidian fightwear',(.018,.024,.029),0,.76)
    accent=mat('Fighter accent',accentC,.2,.36); glow=mat('Luminous seam',accentC,.15,.3,1.4)
    white=mat('Eye whites',(.79,.83,.8),0,.4); pupil=mat('Iris',(.025,.055,.07),0,.4)
    metal=mat('Titanium',(.25,.29,.31),.7,.32)
    # Bone geometry is shared across all identities.
    joints={'root':((0,0,0),(0,0,.18),None),'pelvis':((0,0,1.00),(0,0,1.18),'root'),'chest':((0,0,1.18),(0,0,1.67),'pelvis'),'head':((0,0,1.67),(0,0,2.0),'chest')}
    for s,sgn in [('L',1),('R',-1)]:
        joints.update({f'upper_arm.{s}':((sgn*.36,0,1.60),(sgn*.59,-.035,1.23),'chest'),f'forearm.{s}':((sgn*.59,-.035,1.23),(sgn*.52,-.38,1.48),f'upper_arm.{s}'),f'hand.{s}':((sgn*.52,-.38,1.48),(sgn*.51,-.45,1.60),f'forearm.{s}'),f'thigh.{s}':((sgn*.17,0,1.03),(sgn*.24,-.015,.57),'pelvis'),f'shin.{s}':((sgn*.24,-.015,.57),(sgn*.27,.035,.14),f'thigh.{s}'),f'foot.{s}':((sgn*.27,.035,.14),(sgn*.27,-.18,.09),f'shin.{s}')})
    arm=bpy.data.armatures.new('Pit shared skeleton');rig=bpy.data.objects.new('FighterRig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;rig.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    for name,(h,t,parent) in joints.items():
        b=arm.edit_bones.new(name);b.head=h;b.tail=t
        if parent:b.parent=arm.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
    build_upper_body(skin,width,joints)
    build_head(fid, os.path.join(OUT,'fighter-face-atlas.png'), skin)
    build_lower_body(skin,black,accent,width)
    for s,sgn in [('L',1),('R',-1)]:
        uv('MMA glove',(sgn*.515,-.405,1.531),(.083,.083,.102),black,f'hand.{s}')
        box('Glove knuckles',(sgn*.51,-.465,1.55),(.130,.046,.068),accent,f'hand.{s}',.026)
        uv('Thumb',(sgn*.455,-.42,1.51),(.032,.045,.055),black,f'hand.{s}')
        wrist=Vector(joints[f'forearm.{s}'][1]);axis=(wrist-Vector(joints[f'forearm.{s}'][0])).normalized()
        bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.052,depth=.036,location=wrist-axis*.030)
        cuff=bpy.context.object;cuff.name='Fitted wrist cuff';cuff.rotation_mode='QUATERNION';cuff.rotation_quaternion=Vector((0,0,1)).rotation_difference(axis)
        cuff.data.materials.append(accent);cuff.vertex_groups.new(name=f'forearm.{s}').add(list(range(len(cuff.data.vertices))),1,'REPLACE')
        for poly in cuff.data.polygons:poly.use_smooth=len(poly.vertices)==4
        box('Boot',(sgn*.27,-.075,.074),(.162,.295,.12),black,f'foot.{s}',.045)
        box('Boot sole',(sgn*.27,-.08,.022),(.166,.30,.024),accent,f'foot.{s}',.008)
        box('Boot seam',(sgn*.27,-.215,.065),(.10,.015,.026),glow,f'foot.{s}',.005)
    # Shared skinned mesh retains normalized material UVs and identical bone names.
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name=fid+'_body'
    # Joined body loops need white albedo because glTF multiplies vertex color
    # into every primitive; only the fitted scalp uses sampled vertex colors.
    albedo=body.data.color_attributes.get('Head albedo')
    for poly in body.data.polygons:
        if 'continuous scalp and jaw' not in body.data.materials[poly.material_index].name:
            for loop in poly.loop_indices:albedo.data[loop].color=(1,1,1,1)
    # Adult proportions: longer legs, narrower torso, smaller head; preserve height.
    def proportion(p):
        x,y,z=p
        sx=.78+(.84-.78)*max(0,min(1,(z-1.65)/.115))
        nz=z*1.10 if z<=1.14 else (1.254+(z-1.14)*.93 if z<=1.765 else 1.83525+(z-1.765)*.82)
        neck_t=max(0,min(1,(z-1.63)/.14))
        nz-=.035*neck_t*neck_t*(3-2*neck_t)
        return Vector((x*sx,y*.90,nz))
    for vertex in body.data.vertices:vertex.co=proportion(vertex.co)
    bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
    for bone in arm.edit_bones:
        bone.head=proportion(bone.head);bone.tail=proportion(bone.tail)
    bpy.ops.object.mode_set(mode='OBJECT')
    mod=body.modifiers.new('Shared fighter rig','ARMATURE');mod.object=rig;body.parent=rig
    for b in rig.pose.bones:b.rotation_mode='XYZ'
    def clip(name, duration, poses, loop=False):
        rig.animation_data_create()
        for existing in rig.animation_data.nla_tracks:existing.mute=True
        action=bpy.data.actions.new(name);rig.animation_data.action=action
        for frame,pose in poses:
            bpy.context.scene.frame_set(frame)
            for b in rig.pose.bones:
                b.rotation_euler=pose.get(b.name,(0,0,0));b.location=(0,0,0)
                if b.name=='root':b.location=pose.get('_root',(0,0,0))
            bpy.context.view_layer.update()
            for bone_name,target in pose.get('_targets',{}).items():
                b=rig.pose.bones[bone_name];direction=proportion(target)-b.head
                delta=(b.tail-b.head).rotation_difference(direction)
                b.matrix=Matrix.LocRotScale(b.head,delta @ b.matrix.to_quaternion(),Vector((1,1,1)))
                bpy.context.view_layer.update()
            for b in rig.pose.bones:
                b.keyframe_insert('rotation_euler',frame=frame);b.keyframe_insert('location',frame=frame)
        track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,action);strip.action_frame_start=1;strip.action_frame_end=duration
        rig.animation_data.action=None;track.mute=True
    clip('idle',60,[(1,{}),(30,{'chest':(.015,.01,0),'head':(0,.01,.025),'upper_arm.L':(.025,0,.025),'upper_arm.R':(-.025,0,-.025)}),(60,{})],True)
    clip('walk_forward',24,[(1,{'thigh.L':(.22,0,0),'thigh.R':(-.22,0,0)}),(12,{'thigh.L':(-.22,0,0),'thigh.R':(.22,0,0)}),(24,{'thigh.L':(.22,0,0),'thigh.R':(-.22,0,0)})],True)
    def punch_pose(extension=1,heavy=False):
        return {'chest':(0,.035,.28 if heavy else .17),'pelvis':(0,0,.09),'head':(0,0,-.10),'_root':(0,-.045*extension,-.014),'_targets':{'upper_arm.R':(-.28,-.39*extension,1.54),'forearm.R':(-.20,-.84*extension,1.57),'upper_arm.L':(.31,-.19,1.44),'forearm.L':(.21,-.41,1.69)}}
    for name,dur,wind,contact in [('punch_light',14,4,6),('punch_heavy',24,8,11)]:
        heavy=name=='punch_heavy'
        prepare={'chest':(0,-.04,-.18 if heavy else -.075),'pelvis':(0,0,-.09),'_root':(0,.03,0),'_targets':{'forearm.R':(-.32,-.26,1.58)}}
        clip(name,dur,[(1,{}),(wind,prepare),(contact,punch_pose(1,heavy)),(contact+2,punch_pose(.93,heavy)),(dur,{})])
    for name,dur,wind,contact in [('kick_front',21,7,10),('kick_power',32,11,15)]:
        heavy=name=='kick_power'
        chamber={'chest':(.08,0,0),'pelvis':(0,0,-.08),'_root':(.08,0,-.025),'_targets':{'thigh.R':(-.19,-.37,.93),'shin.R':(-.19,-.20,.55),'upper_arm.L':(.34,-.10,1.41),'forearm.L':(.24,-.43,1.68)}}
        impact={'chest':(.17,0,.13 if heavy else 0),'pelvis':(0,0,-.08),'_root':(.10,.04,-.035),'_targets':{'thigh.R':(-.18,-.46,1.04),'shin.R':(-.15,-.90,1.08 if heavy else .95),'foot.R':(-.15,-1.08,1.00),'upper_arm.R':(-.43,.1,1.40),'forearm.R':(-.52,-.10,1.52),'upper_arm.L':(.26,-.2,1.46),'forearm.L':(.20,-.40,1.68)}}
        clip(name,dur,[(1,{}),(wind,chamber),(contact,impact),(contact+3,impact),(dur-5,chamber),(dur,{})])
    guard={'chest':(.05,0,0),'head':(.10,0,0),'_targets':{'upper_arm.L':(.28,-.18,1.35),'forearm.L':(.12,-.30,1.74),'upper_arm.R':(-.28,-.18,1.35),'forearm.R':(-.12,-.30,1.74)}}
    clip('block',30,[(1,guard),(30,guard)])
    clip('dodge',19,[(1,{}),(5,{'chest':(.18,.10,.25),'pelvis':(.05,0,-.10),'_root':(.12,.07,-.13)}),(9,{'chest':(.13,-.08,-.18),'_root':(-.10,.11,-.12)}),(19,{})])
    clip('hit',10,[(1,{}),(3,{'chest':(-.18,.06,.14),'head':(-.16,0,.12),'_root':(0,.055,-.02)}),(10,{})])
    clip('ko',30,[(1,{}),(9,{'chest':(-.22,.10,0),'head':(-.23,0,.12),'_root':(0,.06,-.10)}),(17,{'root':(-.7,0,.12),'_root':(0,.12,-.10)}),(30,{'root':(-1.54,0,.1),'_root':(0,.20,.09),'upper_arm.L':(.1,0,.3),'upper_arm.R':(.1,0,-.3)})])
    victory={'head':(-.06,0,0),'_targets':{'upper_arm.L':(.38,-.05,2.00),'forearm.L':(.20,-.12,2.39),'upper_arm.R':(-.38,-.05,2.00),'forearm.R':(-.20,-.12,2.39)}}
    clip('victory',50,[(1,{}),(25,victory),(50,victory)])
    clip('trophy_lift',60,[(1,guard),(35,victory),(60,victory)])
    bpy.context.scene.render.fps=30
    # Export each NLA track as its own normalized animation.
    for track in rig.animation_data.nla_tracks:track.mute=False
    bpy.context.scene.frame_set(1)
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,fid+'.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_yup=True)
    if fid=='elon_musk':bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'scripts','fighter-source.blend'))
    # Transparent roster portrait rendered from the same model used in gameplay.
    for track in rig.animation_data.nla_tracks: track.mute=True
    for bone in rig.pose.bones: bone.rotation_euler=(0,0,0);bone.location=(0,0,0)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=32
    scene.render.resolution_x=480;scene.render.resolution_y=540;scene.render.resolution_percentage=100;scene.render.film_transparent=True
    scene.world.color=(.15,.17,.14)
    bpy.ops.object.camera_add(location=(.55,-5.5,2.40));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.51))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.65;scene.camera=cam
    for loc,power,color,size in [((-3,-4,5),550,(.94,1,.88),4),((3,1,3),850,accentC,3),((3,-2,2),100,(.6,.8,1),2)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.color=color;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1.4))-light.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=os.path.join(OUT,fid+'.png');bpy.ops.render.render(write_still=True)

# Arena mesh. Runtime physics boundaries follow the same regular octagon.
reset();floor=mat('Arena graphite',(.046,.058,.064),.45,.52);edge=mat('Powder coated steel',(.012,.018,.021),.65,.38);trim=mat('Arena luminous trim',(.66,.9,.055),.2,.25,2)
for name,r,depth,z,ma in [('Octagonal foundation',4.75,.25,-.16,floor),('Inner mat',4.39,.035,-.015,floor)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=depth,location=(0,0,z),rotation=(0,0,math.pi/8));bpy.context.object.name=name;bpy.context.object.data.materials.append(ma)
for i in range(8):
    a=i*math.pi/4+math.pi/8;b=(i+1)*math.pi/4+math.pi/8
    p=Vector((4.5*math.cos(a),4.5*math.sin(a),0));q=Vector((4.5*math.cos(b),4.5*math.sin(b),0))
    box('Corner post',(*p[:2],.91),(.115,.115,1.82),edge,bevel=.024)
    box('Post light',(*p[:2],1.00),(.13,.13,.55),trim,bevel=.01)
    for z in [.08,.68,1.38,1.80]:
        bar=box('Cage rail',((p.x+q.x)/2,(p.y+q.y)/2,z),((p-q).length,.036,.038),trim if z==.08 else edge,bevel=.01);bar.rotation_euler[2]=math.atan2(q.y-p.y,q.x-p.x)
# GLB arena is kept intentionally open at the front by runtime material visibility.
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'arena.glb'),export_format='GLB',export_animations=False)
reset();gold=mat('Championship gold',(.8,.52,.12),.85,.24);black=mat('Trophy base',(.025,.035,.04),.3,.33)
box('Trophy plinth',(0,0,.1),(.55,.43,.2),black)
for r,dep,z in [(.17,.55,.44),(.30,.10,.72)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=dep,location=(0,0,z));bpy.context.object.data.materials.append(gold)
uv('Golden globe',(0,0,.99),(.33,.33,.33),gold)
for s in [-1,1]:
    bpy.ops.mesh.primitive_torus_add(major_radius=.24,minor_radius=.045,major_segments=20,minor_segments=8,location=(s*.3,0,.8),rotation=(math.pi/2,0,0));bpy.context.object.data.materials.append(gold)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'trophy.glb'),export_format='GLB',export_animations=False)
print('FIGHTER AND ARENA ASSETS COMPLETE')
