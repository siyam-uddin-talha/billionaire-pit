"""Continuous chest, trapezius, neck and arms with blended joint weights."""
import bpy, math
from mathutils import Vector

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)))
    return t*t*(3-2*t)

def torso_section(z,width):
    profile=[(1.08,.225,.137,0),(1.22,.242,.148,0),(1.39,.281,.164,.008),
             (1.51,.319,.163,.014),(1.58,.322,.135,.022),
             (1.63,.210,.102,.027),(1.68,.100,.079,.029),
             (1.73,.073,.072,.030),(1.79,.070,.072,.027),(1.835,.082,.075,.023)]
    k=next((k for k in range(len(profile)-1) if z<=profile[k+1][0]),len(profile)-2)
    a,b=profile[k],profile[k+1];dz=b[0]-a[0];t=(z-a[0])/dz
    before=profile[max(0,k-1)];after=profile[min(len(profile)-1,k+2)]
    def interpolate(c):
        m0=(b[c]-before[c])/(b[0]-before[0]);m1=(after[c]-a[c])/(after[0]-a[0])
        return (2*t**3-3*t*t+1)*a[c]+(t**3-2*t*t+t)*dz*m0+(-2*t**3+3*t*t)*b[c]+(t**3-t*t)*dz*m1
    rx,ry,cy=[interpolate(c) for c in (1,2,3)]
    rx*=1+(width-1)*(1-smooth(1.57,1.73,z))
    return rx,ry,cy

def build_upper_body(skin,width,joints):
    parts=[]
    # Cross sections continue through the collar into the neck under the jaw.
    verts=[];faces=[];n=64;rows=80
    for j in range(rows+1):
        z=1.08+(1.835-1.08)*j/rows
        rx,ry,cy=torso_section(z,width)
        for i in range(n):
            theta=2*math.pi*i/n;x=rx*math.cos(theta);y=cy+ry*math.sin(theta)
            if math.sin(theta)<0:
                front=(-math.sin(theta))**4
                pec=.034*math.exp(-((abs(x)-.145)/.105)**2-((z-1.48)/.075)**2)
                sternum=-.006*math.exp(-(x/.024)**2-((z-1.48)/.13)**2)
                clavicle=.009*math.exp(-((z-(1.61-.07*abs(x)))/.014)**2)*math.exp(-((abs(x)-.13)/.11)**2)
                abs_relief=sum(.008*math.exp(-((abs(x)-.061)/.045)**2-((z-v)/.033)**2) for v in (1.22,1.30,1.38))
                tendon=.004*math.exp(-((abs(x)-(.046+.22*(1.78-z)))/.011)**2)*smooth(1.62,1.72,z)
                y-=front*(pec+sternum+clavicle+abs_relief+tendon)
            verts.append((x,y,z))
    for j in range(rows):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    faces.append(tuple(reversed(range(n))));faces.append(tuple(rows*n+i for i in range(n)))
    mesh=bpy.data.meshes.new('Chest through neck');mesh.from_pydata(verts,[],faces);mesh.update()
    torso=bpy.data.objects.new('Continuous upper body',mesh);bpy.context.collection.objects.link(torso);parts.append(torso)
    def ellipsoid(loc,scale):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=loc)
        obj=bpy.context.object;obj.scale=scale
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);parts.append(obj)
        return obj
    for side,sign in [('L',1),('R',-1)]:
        # One continuous sweep from the chest through the elbow to the wrist.
        # No spherical joint caps or intersecting upper/forearm tubes.
        control=[(sign*.160,.015,1.520,.070),(sign*.330,0,1.555,.075),
                 (sign*.465,-.015,1.420,.077),(sign*.560,-.029,1.285,.058),
                 (sign*.590,-.035,1.230,.049),(sign*.578,-.150,1.321,.063),
                 (sign*.535,-.310,1.435,.052),(sign*.513,-.401,1.510,.044)]
        points=[Vector(p[:3]) for p in control]
        vertices=[];polygons=[];steps=96;segments=32
        def section(t):
            k=min(len(points)-2,int(t));f=t-k
            a=points[max(0,k-1)];b=points[k];c=points[k+1];d=points[min(len(points)-1,k+2)]
            center=.5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f)
            radius=control[k][3]*(1-f)+control[k+1][3]*f
            return center,radius
        for j in range(steps+1):
            t=(len(points)-1)*j/steps;center,r=section(t)
            tangent=(section(min(len(points)-1,t+.005))[0]-section(max(0,t-.005))[0]).normalized()
            u=tangent.cross(Vector((0,1,0))).normalized();v=tangent.cross(u)
            for i in range(segments):
                theta=2*math.pi*i/segments
                vertices.append(center+r*(math.cos(theta)*u+.93*math.sin(theta)*v))
        for j in range(steps):
            for i in range(segments):
                ia=j*segments+i;ib=j*segments+(i+1)%segments;polygons.append((ia,ib,ib+segments,ia+segments))
        polygons.append(tuple(reversed(range(segments))));polygons.append(tuple(steps*segments+i for i in range(segments)))
        am=bpy.data.meshes.new('Continuous human arm');am.from_pydata(vertices,[],polygons);am.update()
        obj=bpy.data.objects.new('Shoulder to wrist '+side,am);bpy.context.collection.objects.link(obj);parts.append(obj)
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:part.select_set(True)
    bpy.context.view_layer.objects.active=torso;bpy.ops.object.join()
    # Weld the intersections before skinning so shoulders and elbows cannot split.
    modifier=torso.modifiers.new('Weld anatomical transitions','REMESH');modifier.mode='VOXEL';modifier.voxel_size=.009;modifier.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=torso.modifiers.new('Relax muscle transitions','SMOOTH');modifier.factor=.75;modifier.iterations=6
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=torso.modifiers.new('Game mesh density','DECIMATE');modifier.ratio=.24
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    torso.data.materials.clear();torso.data.materials.append(skin)
    for poly in torso.data.polygons:poly.use_smooth=True
    groups={name:torso.vertex_groups.new(name=name) for name in ['chest','pelvis','head','upper_arm.L','forearm.L','upper_arm.R','forearm.R']}
    def distance(p,a,b):
        a,b=Vector(a),Vector(b);d=b-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));return (p-a-t*d).length
    for vertex in torso.data.vertices:
        p=vertex.co;side='L' if p.x>=0 else 'R'
        arm_weight=smooth(.235,.435,abs(p.x))*(1-smooth(1.66,1.76,p.z))
        upper=math.exp(-(distance(p,*joints['upper_arm.'+side][:2])/.065)**2)
        lower=math.exp(-(distance(p,*joints['forearm.'+side][:2])/.065)**2)
        fore=lower/(upper+lower+1e-20)
        head=smooth(1.63,1.815,p.z);pelvis=1-smooth(1.10,1.29,p.z)
        weights={'upper_arm.'+side:arm_weight*(1-fore),'forearm.'+side:arm_weight*fore,
                 'head':(1-arm_weight)*head,'pelvis':(1-arm_weight)*(1-head)*pelvis,
                 'chest':(1-arm_weight)*(1-head)*(1-pelvis)}
        for name,weight in weights.items():
            if weight>1e-6:groups[name].add([vertex.index],weight,'REPLACE')
    return torso
