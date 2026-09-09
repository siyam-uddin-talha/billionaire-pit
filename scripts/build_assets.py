"""Original low-poly fighters, shared skinned rig, clips, arena and trophy. Blender 4.5+."""
import bpy, math, os, json
from mathutils import Vector, Matrix
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT,'public','models')
os.makedirs(OUT, exist_ok=True)

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
    hair=mat('Hair',tuple(v*.34 for v in hairC),0,.92); black=mat('Obsidian fightwear',(.018,.024,.029),.15,.36)
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
    # Continuous torso surface with shallow muscular relief, rather than separate spherical muscles.
    torso_vertices=[];torso_faces=[];ring_segments=48;height_segments=30
    for j in range(height_segments+1):
        t=j/height_segments;z=1.09+t*.58
        rx=(.238+.102*math.sin(t*math.pi*.92))*width;ry=.153+.026*math.sin(t*math.pi)
        if t>.88:
            shoulder_blend=(t-.88)/.12;rx=rx*(1-shoulder_blend)+.084*shoulder_blend;ry=ry*(1-shoulder_blend)+.079*shoulder_blend
        for i in range(ring_segments):
            theta=2*math.pi*i/ring_segments;x=rx*math.cos(theta);y=ry*math.sin(theta)
            if y<0:
                front=max(0,-math.sin(theta))**5
                pec=.027*math.exp(-((abs(x)-.15)/.12)**2-((z-1.49)/.085)**2)
                abdominal=sum(.008*math.exp(-((abs(x)-.063)/.05)**2-((z-a)/.037)**2) for a in [1.21,1.30,1.38])
                y-=front*(pec+abdominal)
            torso_vertices.append((x,y,z))
    for j in range(height_segments):
        for i in range(ring_segments):
            a=j*ring_segments+i;b=j*ring_segments+(i+1)%ring_segments;torso_faces.append((a,b,b+ring_segments,a+ring_segments))
    top_index=len(torso_vertices);torso_vertices.append((0,0,1.675))
    for i in range(ring_segments):torso_faces.append((height_segments*ring_segments+i,height_segments*ring_segments+(i+1)%ring_segments,top_index))
    tm=bpy.data.meshes.new('Continuous anatomical torso');tm.from_pydata(torso_vertices,[],torso_faces);tm.update();to=bpy.data.objects.new('Torso',tm);bpy.context.collection.objects.link(to);to.data.materials.append(skin)
    for poly in tm.polygons:poly.use_smooth=True
    to.vertex_groups.new(name='chest').add(list(range(len(torso_vertices))),1,'REPLACE')
    # Projection-mapped, curved, textured heads: each uses its own atlas quadrant.
    uv('Neck',(0,.015,1.725),(.083,.085,.105),skin,'head',32)
    uv('Anatomical skull',(0,.028,1.949),(.130*headscale,.108,.177),skin,'head',40)
    uv('Hair back',(0,.054,2.027),(.132,.108,.108),hair,'head',32)
    uv('Fitted hair cap',(0,.013,2.068),(.132,.117,.068),hair,'head',32)
    face_material=bpy.data.materials.new('Facial likeness texture');face_material.use_nodes=True
    shader=face_material.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.83
    shader.inputs['Specular IOR Level'].default_value=.12
    texture_node=face_material.node_tree.nodes.new('ShaderNodeTexImage');texture_node.image=bpy.data.images.load(os.path.join(OUT,'fighter-face-atlas.png'),check_existing=True)
    uv_node=face_material.node_tree.nodes.new('ShaderNodeUVMap');uv_node.uv_map='Face atlas UV';face_material.node_tree.links.new(uv_node.outputs['UV'],texture_node.inputs['Vector'])
    face_material.node_tree.links.new(texture_node.outputs['Color'],shader.inputs['Base Color'])
    face_material.node_tree.links.new(texture_node.outputs['Alpha'],shader.inputs['Alpha'])
    face_material.node_tree.links.new(texture_node.outputs['Color'],shader.inputs['Emission Color']);shader.inputs['Emission Strength'].default_value=.10
    face_material.surface_render_method='DITHERED';face_material.use_backface_culling=True
    fid_index=[item[0] for item in ROSTER].index(fid);col=fid_index%2;row=fid_index//2
    vertices=[];polygons=[];uvs=[];nx=48;ny=56
    for j in range(ny+1):
        v=j/ny
        for i in range(nx+1):
            u=i/nx;x=(u-.5)*.397;z=1.735+v*.43
            side=max(0,1-((u-.5)/.39)**2)**.5
            vertical=.78+.22*math.sin(v*math.pi)
            nose=.035*math.exp(-((u-.5)/.063)**2-((v-.425)/.10)**2)
            y=-.025-.125*side*vertical-nose
            vertices.append((x,y,z));uvs.append(((col+u)/2,(1-row+v)/2))
    for j in range(ny):
        for i in range(nx):
            a=j*(nx+1)+i;polygons.append((a,a+1,a+nx+2,a+nx+1))
    mesh=bpy.data.meshes.new('Projected facial surface');mesh.from_pydata(vertices,[],polygons);mesh.update()
    face=bpy.data.objects.new('Recognizable textured face',mesh);bpy.context.collection.objects.link(face);face.data.materials.append(face_material)
    layer=mesh.uv_layers.new(name='Face atlas UV')
    for poly in mesh.polygons:
        poly.use_smooth=True
        for loop in poly.loop_indices:layer.data[loop].uv=uvs[mesh.loops[loop].vertex_index]
    face.vertex_groups.new(name='head').add(list(range(len(vertices))),1,'REPLACE')
    box('Fight shorts',(0,.005,1.005),(.54*width,.35,.28),black,'pelvis',.055)
    box('Waistband',(0,-.004,1.14),(.55*width,.36,.055),accent,'pelvis',.015)
    box('Belt clasp',(0,-.193,1.13),(.07,.018,.045),metal,'pelvis',.008)
    for s,sgn in [('L',1),('R',-1)]:
        for part,r,mt in [('upper_arm',.112,skin),('forearm',.087,skin),('thigh',.139,skin),('shin',.086,skin)]:
            a,b,_=joints[f'{part}.{s}'];limb(part,a,b,r,mt,f'{part}.{s}')
        uv('Deltoid',(sgn*.365,0,1.586),(.128,.13,.15),skin,f'upper_arm.{s}')
        uv('Short leg',(sgn*.18,0,.95),(.175,.18,.18),black,f'thigh.{s}')
        box('Short stripe',(sgn*.321,-.02,.956),(.025,.24,.20),accent,f'thigh.{s}',.008)
        uv('Knee pad',(sgn*.24,-.067,.56),(.095,.08,.088),black,f'shin.{s}')
        uv('MMA glove',(sgn*.515,-.405,1.531),(.114,.108,.135),black,f'hand.{s}')
        box('Glove knuckles',(sgn*.51,-.484,1.56),(.176,.067,.09),accent,f'hand.{s}',.026)
        uv('Thumb',(sgn*.435,-.42,1.51),(.046,.06,.071),black,f'hand.{s}')
        box('Wrist wrap',(sgn*.525,-.336,1.449),(.158,.13,.08),accent,f'forearm.{s}',.013)
        uv('Shin wrap',(sgn*.264,.025,.225),(.101,.10,.13),black,f'shin.{s}')
        box('Boot',(sgn*.27,-.075,.074),(.20,.34,.14),black,f'foot.{s}',.045)
        box('Boot sole',(sgn*.27,-.08,.022),(.205,.34,.038),accent,f'foot.{s}',.008)
        box('Boot seam',(sgn*.27,-.234,.08),(.10,.015,.026),glow,f'foot.{s}',.005)
    # Shared skinned mesh retains normalized material UVs and identical bone names.
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name=fid+'_body'
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
                b=rig.pose.bones[bone_name];direction=Vector(target)-b.head
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
