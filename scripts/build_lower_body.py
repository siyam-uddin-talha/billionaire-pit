"""Tapered anatomical legs and fitted fight shorts, using the shared skeleton."""
import bpy, math
from build_upper_body import smooth, torso_section

def build_lower_body(skin,cloth,accent,width):
    shorts=[]
    def loft(name,sections,material,weight_fn):
        vertices=[];faces=[];n=40
        for z,cx,rx,ry,cy in sections:
            for i in range(n):
                t=2*math.pi*i/n;vertices.append((cx+rx*math.cos(t),cy+ry*math.sin(t),z))
        for j in range(len(sections)-1):
            for i in range(n):
                a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
        faces.append(tuple(reversed(range(n))));faces.append(tuple((len(sections)-1)*n+i for i in range(n)))
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
        obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);mesh.materials.append(material)
        for p in mesh.polygons:p.use_smooth=True
        groups={}
        for v in mesh.vertices:
            for bone,w in weight_fn(v.co.z).items():
                if w>1e-6:
                    if bone not in groups:groups[bone]=obj.vertex_groups.new(name=bone)
                    groups[bone].add([v.index],w,'REPLACE')
        return obj
    for side,sign in [('L',1),('R',-1)]:
        def weights(z):
            thigh=smooth(.48,.67,z);foot=1-smooth(.12,.23,z)
            return {'thigh.'+side:thigh,'shin.'+side:(1-thigh)*(1-foot),'foot.'+side:(1-thigh)*foot}
        # Several closely spaced sections give continuous quads/calf/knee contours.
        knots=[(.12,.049,.054),(.20,.052,.056),(.30,.068,.074),(.40,.083,.088),(.48,.079,.074),
               (.56,.075,.072),(.63,.085,.090),(.73,.105,.115),(.85,.126,.135),(.98,.140,.145),(1.10,.133,.139)]
        sections=[]
        for j in range(65):
            z=.12+.98*j/64;k=next((k for k in range(len(knots)-1) if z<=knots[k+1][0]),len(knots)-2)
            a,b=knots[k],knots[k+1];t=(z-a[0])/(b[0]-a[0]);rx=a[1]*(1-t)+b[1]*t;ry=a[2]*(1-t)+b[2]*t
            cx=sign*(.27-(z-.14)/(.57-.14)*.03 if z<.57 else .24-(z-.57)/(.46)*.07)
            cy=.025-.043*smooth(.28,.53,z)+.024*smooth(.64,.86,z)
            sections.append((z,cx,rx,ry,cy))
        obj=loft('Continuous leg '+side,sections,skin,weights)
        for vertex in obj.data.vertices:
            t=smooth(.94,1.10,vertex.co.z)
            belly=torso_section(max(1.08,vertex.co.z),width)[0]
            vertex.co.x*=1-t+t*min(1,(belly-.005)/.30)
        modifier=obj.modifiers.new('Relax knee and calf contours','SMOOTH');modifier.factor=.65;modifier.iterations=4
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=modifier.name)
        def short_weights(z):
            p=smooth(.96,1.12,z);return {'pelvis':p,'thigh.'+side:1-p}
        shorts.append(loft('Tailored shorts '+side,[(.83,sign*.198,.144,.148,.003),(.86,sign*.194,.147,.153,.003),
             (.95,sign*.179,.160,.166,.003),(1.045,sign*.150,.170,.170,.003),(1.125,sign*.127,.153,.154,0)],cloth,short_weights))
        loft('Short hem '+side,[(.832,sign*.198,.145,.149,.003),(.848,sign*.196,.146,.152,.003)],accent,short_weights)
    shorts.append(loft('Continuous shorts hip panel',[(.995,0,.266,.165,0),(1.065,0,.292,.174,0),(1.128,0,.260,.155,0)],cloth,lambda z:{'pelvis':1}))
    # Fit the same abdominal cross-section used by this fighter's torso.
    for obj in shorts:
        for vertex in obj.data.vertices:
            z=vertex.co.z;t=smooth(.95,1.128,z)
            rx,ry,cy=torso_section(max(1.08,z),width)
            vertex.co.x*=1-t+t*(rx+.006)/.28
            vertex.co.y*=1-t+t*(ry+.006)/.155
    bpy.ops.object.select_all(action='DESELECT')
    for obj in shorts:obj.select_set(True)
    garment=shorts[-1];bpy.context.view_layer.objects.active=garment;bpy.ops.object.join()
    modifier=garment.modifiers.new('Continuous fitted cloth','REMESH');modifier.mode='VOXEL';modifier.voxel_size=.009;modifier.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=garment.modifiers.new('Soften fabric seams','SMOOTH');modifier.factor=.75;modifier.iterations=5
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=garment.modifiers.new('Cloth game mesh','DECIMATE');modifier.ratio=.14
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    garment.vertex_groups.clear()
    groups={name:garment.vertex_groups.new(name=name) for name in ['pelvis','thigh.L','thigh.R']}
    for vertex in garment.data.vertices:
        p=smooth(.98,1.115,vertex.co.z);side='L' if vertex.co.x>=0 else 'R'
        groups['pelvis'].add([vertex.index],p,'REPLACE');groups['thigh.'+side].add([vertex.index],1-p,'REPLACE')
    waistband=[]
    for z in [1.114,1.126,1.138,1.146]:
        rx,ry,cy=torso_section(z,width)
        waistband.append((z,0,rx+.004,ry+.004,cy))
    loft('Fitted waistband',waistband,accent,lambda z:{'pelvis':1})
