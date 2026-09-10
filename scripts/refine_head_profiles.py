"""Refine exported skinned geometry and vertex colors; never edits raster textures.
Run after build_assets.py. An asset marker makes this safe to run repeatedly.
"""
import json, math, struct
from pathlib import Path

PROFILES = {
 'elon_musk': dict(temple=.62,nape=.33,sideburn=.43,wave=.0012,frequency=48,ear=.94),
 'mark_zuckerberg': dict(temple=.68,nape=.43,sideburn=.47,wave=.0028,frequency=180,ear=1.08),
 'dario_amodei': dict(temple=.55,nape=.34,sideburn=.36,wave=.0022,frequency=78,ear=1.02),
 'sam_altman': dict(temple=.63,nape=.40,sideburn=.44,wave=.0015,frequency=95,ear=.97),
}
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a))); return t*t*(3-2*t)
def refine(path, fid):
 raw=path.read_bytes(); size=struct.unpack_from('<I',raw,12)[0]
 doc=json.loads(raw[20:20+size]); binary=bytearray(raw[28+size:])
 if doc.get('extras',{}).get('headProfileRevision')==1: return
 def read(index):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
  n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
  fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]*n
  step=v.get('byteStride',struct.calcsize(fmt));offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [list(struct.unpack_from('<'+fmt,binary,offset+i*step)) for i in range(a['count'])]
 def write(index,values):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];n=len(values[0]);fmt={5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]*n
  step=v.get('byteStride',struct.calcsize(fmt));offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  for i,value in enumerate(values):struct.pack_into('<'+fmt,binary,offset+i*step,*value)
  if 'min' in a:a['min']=[min(v[k] for v in values) for k in range(n)];a['max']=[max(v[k] for v in values) for k in range(n)]
 skin_mat=next(m for m in doc['materials'] if m['name']=='Skin' or m['name'].startswith('Skin.'))
 skin=skin_mat['pbrMetallicRoughness']['baseColorFactor'][:3]
 cfg=PROFILES[fid]
 for mesh in doc['meshes']:
  for primitive in mesh['primitives']:
   material=doc['materials'][primitive['material']]['name'];attrs=primitive['attributes']
   positions=read(attrs['POSITION']); changed=False
   if material==skin_mat['name']:
    joints=read(attrs['JOINTS_0']);weights=read(attrs['WEIGHTS_0'])
    for i,p in enumerate(positions):
     x,y,z=p
     if y>1.68 and abs(x)<.105 and -.13<z<.12:
      amount=smooth(1.68,1.84,y)
      p[1]+=.025*amount;p[2]+=.030*amount;p[0]*=1+.10*amount
      # Match the head's rigid weight before the visible jaw overlap.
      head=smooth(1.69,1.80,y)
      joints[i]=[3,2,0,0];weights[i]=[head,1-head,0,0]
      changed=True
    write(attrs['JOINTS_0'],joints);write(attrs['WEIGHTS_0'],weights)
   elif 'continuous scalp and jaw' in material:
    colors=read(attrs['COLOR_0']);lo=min(p[1] for p in positions);hi=max(p[1] for p in positions)
    crown=[colors[i] for i,p in enumerate(positions) if p[1]>hi-.025 and p[2]<-.015]
    hair=[sorted(c[k] for c in crown)[len(crown)//2] for k in range(3)]
    for i,p in enumerate(positions):
     x,y,z=p;v=(y-lo)/(hi-lo)
     # Exclude the attached ear shell and blend into the untouched face seam.
     ear=abs(x)>.078 and .24<v<.61 and z>-.035
     if ear:
      p[0]=math.copysign(.078+(abs(x)-.078)*cfg['ear'],x)
      continue
     rear=smooth(.008,.09,-z)
     threshold=cfg['temple']*(1-rear)+cfg['nape']*rear
     # Separate narrow sideburns, curved temple recession, and a natural nape.
     burn=(1-smooth(.015,.055,abs(z)))*smooth(.065,.085,abs(x))
     threshold=threshold*(1-burn)+cfg['sideburn']*burn
     threshold+=.018*math.sin(x*cfg['frequency']+z*37)
     coverage=smooth(threshold-.04,threshold+.055,v)
     grain=.92+.08*math.sin(x*cfg['frequency']+y*220+z*110)**2
     shade=[skin[k]*(1-coverage)+hair[k]*grain*coverage for k in range(3)]
     seam=smooth(-.002,-.04,z)
     colors[i]=[colors[i][k]*(1-seam)+shade[k]*seam for k in range(3)]
     # Small identity-specific waves in the existing scalp, rather than a helmet.
     ripple=cfg['wave']*math.sin(x*cfg['frequency']+z*90)*math.sin(y*150)*smooth(.60,.85,v)*seam
     p[2]+=ripple+dict(elon_musk=.018,mark_zuckerberg=.030,dario_amodei=.010,sam_altman=.022)[fid]*rear*smooth(.15,.50,v)*(1-smooth(.85,1,v));changed=True
    write(attrs['COLOR_0'],colors)
   if changed:
    write(attrs['POSITION'],positions)
    # Recompute smooth normals on changed geometry.
    normals=[[0.,0.,0.] for _ in positions];indices=[v[0] for v in read(primitive['indices'])]
    for k in range(0,len(indices),3):
     a,b,c=indices[k:k+3];u=[positions[b][j]-positions[a][j] for j in range(3)];v=[positions[c][j]-positions[a][j] for j in range(3)]
     n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
     for idx in (a,b,c):
      for j in range(3):normals[idx][j]+=n[j]
    # UV and skinning seams duplicate vertices; average their normals together.
    sums={}
    for p,n in zip(positions,normals):
     key=tuple(round(v,6) for v in p)
     if key not in sums:sums[key]=[0.,0.,0.]
     for k in range(3):sums[key][k]+=n[k]
    for i,p in enumerate(positions):
     n=sums[tuple(round(v,6) for v in p)];length=math.sqrt(sum(v*v for v in n)) or 1
     normals[i]=[v/length for v in n]
    write(attrs['NORMAL'],normals)
 doc.setdefault('extras',{})['headProfileRevision']=1
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
 binary+=b'\0'*((-len(binary))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
 print('Refined neck and side profile:',fid)
def main():
 root=Path(__file__).resolve().parent.parent/'public/models'
 for fid in PROFILES:refine(root/(fid+'.glb'),fid)
if __name__=='__main__':main()
