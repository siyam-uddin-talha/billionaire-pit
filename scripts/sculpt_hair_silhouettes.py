"""Sculpt distinct hair silhouettes directly in GLB geometry, preserving the face atlas."""
import json, math, struct
from pathlib import Path

def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def sculpt(path,fid):
 raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 doc=json.loads(raw[20:20+length]);data=bytearray(raw[28+length:])
 if doc.get('extras',{}).get('hairSilhouetteRevision')==1:return
 def values(index):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3}[a['type']];code={5123:'H',5125:'I',5126:'f'}[a['componentType']];fmt='<'+code*n;stride=v.get('byteStride',struct.calcsize(fmt));offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  return [list(struct.unpack_from(fmt,data,offset+i*stride)) for i in range(a['count'])]
 def save(index,rows):
  a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']];stride=v.get('byteStride',12);offset=v.get('byteOffset',0)+a.get('byteOffset',0)
  for i,row in enumerate(rows):struct.pack_into('<fff',data,offset+i*stride,*row)
  if 'min' in a:a['min']=[min(p[k] for p in rows) for k in range(3)];a['max']=[max(p[k] for p in rows) for k in range(3)]
 for mesh in doc['meshes']:
  for primitive in mesh['primitives']:
   name=doc['materials'][primitive['material']]['name']
   if 'fitted face' not in name and 'continuous scalp' not in name:continue
   attrs=primitive['attributes'];points=values(attrs['POSITION']);top=max(p[1] for p in points);bottom=min(p[1] for p in points)
   for p in points:
    x,y,z=p;v=(y-bottom)/(top-bottom);crown=smooth(.69,.95,v);side=smooth(.055,.10,abs(x))*smooth(.56,.8,v)
    if fid=='mark_zuckerberg':
     # Short, close-cropped crown and tight small curls, with narrow sides.
     p[1]-=.027*crown;p[0]*=1-.10*side
     p[1]+=.0035*math.sin(x*360)*math.cos(z*310)*crown
    elif fid=='elon_musk':
     # Swept-back high forelock with an asymmetric part.
     p[1]+=.019*crown*(.65+.35*math.sin(x*20));p[2]-=.012*crown
     p[0]+=.009*crown
    elif fid=='dario_amodei':
     # Fuller, irregular wavy hair; broader crown than the cropped fighters.
     wave=.006*math.sin(x*140+z*60)*math.cos(z*125)
     p[1]+=(.012+wave)*crown;p[0]*=1+.07*crown
     p[2]+=.003*math.sin(y*180+x*140)*crown
    else:
     # Low, side-parted sweep with a slight forward fringe.
     p[1]+=(.008*math.sin(x*25)-.009)*crown
     p[0]-=.012*crown;p[2]+=.008*crown
   save(attrs['POSITION'],points)
   triangles=[r[0] for r in values(primitive['indices'])];normals=[[0.,0.,0.] for _ in points]
   for i in range(0,len(triangles),3):
    a,b,c=triangles[i:i+3];u=[points[b][k]-points[a][k] for k in range(3)];v=[points[c][k]-points[a][k] for k in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    for idx in (a,b,c):
     for k in range(3):normals[idx][k]+=n[k]
   sums={}
   for p,n in zip(points,normals):
    key=tuple(round(x,6) for x in p);sums.setdefault(key,[0.,0.,0.])
    for k in range(3):sums[key][k]+=n[k]
   for i,p in enumerate(points):
    n=sums[tuple(round(x,6) for x in p)];size=math.sqrt(sum(x*x for x in n)) or 1;normals[i]=[x/size for x in n]
   save(attrs['NORMAL'],normals)
 doc.setdefault('extras',{})['hairSilhouetteRevision']=1
 encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);data+=b'\0'*((-len(data))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(data))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(data),0x004e4942)+data)
def main():
 for fid in ['elon_musk','mark_zuckerberg','dario_amodei','sam_altman']:
  sculpt(Path(__file__).resolve().parent.parent/'public/models'/(fid+'.glb'),fid)
if __name__=='__main__':main()
