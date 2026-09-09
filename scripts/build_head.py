"""Fit a closed, skinned head to each source likeness without a floating face card.

The atlas stays unchanged. Its opaque contour determines geometry, and facial
landmarks determine the relief and alignment. Side/back colors come from the
same source. Coordinates below are pixels in the original 1254px image.
"""
import bpy
import math
import numpy as np

PROFILES = {
    'elon_musk': dict(crop=(100, 0, 590, 600), nose=(336, 385), eyes=(267, 403, 309), height=.365, depth=1.02,
                      ears=((139, 174, 300, 442), (500, 542, 300, 439)), temples=(164, 174, 515, 500)),
    'mark_zuckerberg': dict(crop=(670, 0, 1170, 603), nose=(906, 381), eyes=(840, 977, 299), height=.368, depth=1.00,
                            ears=((709, 765, 291, 432), (1052, 1116, 290, 429)), temples=(751, 761, 1066, 1048)),
    'dario_amodei': dict(crop=(95, 600, 590, 1210), nose=(340, 995), eyes=(273, 406, 902), height=.375, depth=1.02,
                        ears=((137, 187, 899, 1041), (491, 544, 899, 1043)), temples=(177, 185, 516, 494)),
    'sam_altman': dict(crop=(680, 606, 1170, 1220), nose=(940, 1002), eyes=(872, 1003, 905), height=.367, depth=.98,
                      ears=((735, 775, 910, 1040), (1076, 1127, 903, 1039)), temples=(768, 781, 1100, 1075)),
}


def linear(rgb):
    return tuple(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4 for c in rgb)


def build_head(fid, atlas_path, skin_material):
    profile = PROFILES[fid]
    atlas = bpy.data.images.load(atlas_path, check_existing=True)
    w, h = atlas.size
    # Blender stores rows bottom-up. Read-only sampling; no generated image edits.
    pixels = np.asarray(atlas.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    x0, y0, x1, y1 = profile['crop']
    mask = pixels[y0:y1, x0:x1, 3] > .92
    rows = np.flatnonzero(mask.sum(axis=1) > 20)
    top, bottom = y0 + int(rows[0]) + 2, y0 + int(rows[-1]) - 2
    center = profile['nose'][0]
    scale = profile['height'] / (bottom - top)
    chin = 1.765

    def sample(px, py, radius=2):
        px, py = int(round(px)), int(round(py))
        patch = pixels[max(0, py-radius):min(h, py+radius+1), max(0, px-radius):min(w, px+radius+1)]
        opaque = patch[patch[:, :, 3] > .92]
        return tuple(np.median(opaque[:, :3], axis=0)) if len(opaque) else (.2, .13, .10)

    # Match exposed skin to the source's cheek rather than an unrelated preset.
    skin_rgb = sample(center - 80, profile['nose'][1] + 45, 14)
    skin_linear = linear(skin_rgb)
    shader = skin_material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*skin_linear, 1)
    skin_material.diffuse_color = (*skin_linear, 1)
    shader.inputs['Roughness'].default_value = .76
    shader.inputs['Specular IOR Level'].default_value = .18

    front = bpy.data.materials.new(fid + ' fitted face')
    front.use_nodes = True
    shader = front.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .82
    shader.inputs['Specular IOR Level'].default_value = .12
    texture = front.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = atlas
    uv_node = front.node_tree.nodes.new('ShaderNodeUVMap')
    uv_node.uv_map = 'Face atlas UV'
    front.node_tree.links.new(uv_node.outputs['UV'], texture.inputs['Vector'])
    front.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    # The surface ends inside the opaque silhouette; alpha planes are unnecessary.
    back = bpy.data.materials.new(fid + ' continuous scalp and jaw')
    back.use_nodes = True
    shader = back.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .82
    shader.inputs['Specular IOR Level'].default_value = .12
    color = back.node_tree.nodes.new('ShaderNodeVertexColor')
    color.layer_name = 'Head albedo'
    back.node_tree.links.new(color.outputs['Color'], shader.inputs['Base Color'])

    nx, ny, nb = 64, 88, 40
    ring_size = nx + nb
    vertices, uvs, colors, faces, materials = [], [], [], [], []

    def contour(py):
        # Average neighboring scanlines to remove single-pixel hair flyaways.
        boundaries = []
        for row in range(max(top, int(py)-9), min(bottom, int(py)+9)+1):
            xs = np.flatnonzero(pixels[row, x0:x1, 3] > .92)
            if len(xs) > 10:
                boundaries.append((x0 + int(xs[0]) + 2, x0 + int(xs[-1]) - 2))
        left, right = np.mean(boundaries, axis=0)
        # An ear's silhouette must not widen every cross-section of the skull.
        for side, ear in enumerate(profile['ears']):
            _, _, ey0, ey1 = ear
            t = max(0, min(1, (py-ey0)/(ey1-ey0)))
            core = profile['temples'][side*2]*(1-t) + profile['temples'][side*2+1]*t
            weight = max(0, min(1, (py-ey0+28)/28, (ey1+28-py)/28))
            weight = weight*weight*(3-2*weight)
            if side == 0: left = left*(1-weight) + max(left, core)*weight
            else: right = right*(1-weight) + min(right, core)*weight
        return left, right

    source_contours = np.array([contour(bottom-j/ny*(bottom-top)) for j in range(ny+1)])
    kernel = np.exp(-np.arange(-8,9,dtype=float)**2/(2*3.0**2)); kernel /= kernel.sum()
    smooth_contours = np.column_stack([np.convolve(np.pad(source_contours[:,k],8,mode='edge'),kernel,mode='valid') for k in range(2)])
    for j in range(ny + 1):
        v = j / ny
        py = bottom - v * (bottom - top)
        left, right = smooth_contours[j]
        texture_left, texture_right = source_contours[j]
        mid, radius = (left + right) / 2, (right - left) / 2
        z = chin + v * profile['height']
        edge_y = -.059 * math.exp(-v / .115)
        depth = (.103 * max(.045, math.sin(math.pi * v)) ** .28) * profile['depth']
        rear_depth = .142 * max(.035, math.sin(math.pi * v)) ** .55 * min(1, .2 + v * 3)
        for i in range(ring_size):
            if i <= nx:
                theta = -math.pi/2 + math.pi * i/nx
                px = (texture_left+texture_right)/2 + (texture_right-texture_left)/2*math.sin(theta)
                x = (mid + radius * math.sin(theta) - center) * scale
                relief = depth * max(0, math.cos(theta)) ** .70
                # The nose, bridge, eye sockets, lips and chin follow this identity's landmarks.
                nose_x, nose_y = profile['nose']
                nose_dx = (px - nose_x) * scale
                nose_dz = (py - nose_y) * scale
                relief += .034 * math.exp(-(nose_dx/.022)**2 - (nose_dz/.019)**2)
                relief += .016 * math.exp(-(nose_dx/.014)**2 - ((nose_dz+.025)/.035)**2)
                relief += .013 * math.exp(-(nose_dx/.046)**2 - ((nose_dz-.048)/.014)**2)
                relief += .013 * math.exp(-(nose_dx/.041)**2 - ((v-.10)/.09)**2)
                for eye_x in profile['eyes'][:2]:
                    relief -= .011 * math.exp(-(((px-eye_x)*scale)/.026)**2 - (((py-profile['eyes'][2])*scale)/.014)**2)
                # Relief tapers to zero at the shared seam with the back of the head.
                relief *= min(1, max(0, math.cos(theta))*12)
                y = edge_y - relief
                uv = (px/w, 1-py/h)
                rgb = (1, 1, 1)
            else:
                theta = math.pi * (i-nx)/nb
                x = ((mid-center) + radius * math.cos(theta))*scale
                y = edge_y + rear_depth * math.sin(theta)
                # Boundary color follows the actual hairline on each side. Farther around
                # the skull use a stable scalp sample, avoiding stretched facial features.
                side_px = texture_right-3 if theta < math.pi/2 else texture_left+3
                edge_rgb = sample(side_px, py, 4)
                hair_rgb = sample(mid, top + (bottom-top)*.12, 14)
                hair_weight = max(0, min(1, (v-.46)/.11))
                base_rgb = tuple(skin_rgb[k]*(1-hair_weight) + hair_rgb[k]*hair_weight for k in range(3))
                blend = min(1, math.sin(theta)*9)
                rgb = linear(tuple(edge_rgb[k]*(1-blend)+base_rgb[k]*blend for k in range(3)))
                uv = (side_px/w, 1-py/h)
            vertices.append((x, y, z)); uvs.append(uv); colors.append(rgb)

    for j in range(ny):
        for i in range(ring_size):
            a = j*ring_size+i
            b = j*ring_size+(i+1)%ring_size
            faces.append((a, b, b+ring_size, a+ring_size))
            materials.append(0 if i < nx else 1)
    # Both ends are sealed. The chin connects naturally over the neck.
    for j, reverse in [(0, True), (ny, False)]:
        ring = vertices[j*ring_size:(j+1)*ring_size]
        pole = len(vertices)
        vertices.append(tuple(sum(p[k] for p in ring)/ring_size for k in range(3)))
        uvs.append(uvs[j*ring_size+nx//2]); colors.append(linear(skin_rgb if reverse else hair_rgb))
        for i in range(ring_size):
            a, b = j*ring_size+i, j*ring_size+(i+1)%ring_size
            faces.append((b, a, pole) if reverse else (a, b, pole)); materials.append(1)

    # Closed ear volumes, attached to the temples and weighted to the same bone.
    # Their UVs stay within their own ear region instead of wrapping around the skull.
    for side, (ex0, ex1, ey0, ey1) in enumerate(profile['ears']):
        sign = -1 if side == 0 else 1
        ear_mid = (ey0+ey1)/2
        bounds = contour(ear_mid)
        base_x = (bounds[side]-center)*scale + sign*.002
        ear_z = chin+(bottom-ear_mid)*scale
        nz, nt = 24, 32
        start = len(vertices)
        for j in range(nz+1):
            phi = math.pi*j/nz
            r = max(.002, math.sin(phi))
            for i in range(nt):
                theta = 2*math.pi*i/nt
                vertices.append((base_x + .014*r*math.sin(theta), .006-.027*r*math.cos(theta), ear_z+.041*math.cos(phi)))
                # Ear detail faces outward along X, where it is visible in profile.
                px = (ex0+ex1)/2 - sign*(ex1-ex0)*.46*r*math.cos(theta)
                py = (ey0+ey1)/2 - (ey1-ey0)*.47*math.cos(phi)
                opaque = np.flatnonzero(pixels[int(py), ex0:ex1, 3] > .92)
                if len(opaque):
                    px = max(ex0+int(opaque[0])+1, min(ex0+int(opaque[-1])-1, px))
                uvs.append((px/w, 1-py/h)); colors.append((1,1,1))
        for j in range(nz):
            for i in range(nt):
                a=start+j*nt+i; b=start+j*nt+(i+1)%nt
                faces.append((b,a,a+nt,b+nt))
                materials.append(0 if sign*math.sin(2*math.pi*(i+.5)/nt) > 0 else 1)
        faces.append(tuple(start+i for i in range(nt))); materials.append(1)
        faces.append(tuple(start+nz*nt+i for i in reversed(range(nt)))); materials.append(1)

    mesh = bpy.data.meshes.new(fid + ' closed fitted head')
    mesh.from_pydata(vertices, [], faces); mesh.update()
    head = bpy.data.objects.new('Integrated likeness head', mesh)
    bpy.context.collection.objects.link(head)
    mesh.materials.append(front); mesh.materials.append(back)
    uv_layer = mesh.uv_layers.new(name='Face atlas UV')
    albedo = mesh.color_attributes.new(name='Head albedo', type='FLOAT_COLOR', domain='CORNER')
    # Creating a custom-data layer invalidates prior RNA layer references.
    uv_layer = mesh.uv_layers['Face atlas UV']
    for poly, material in zip(mesh.polygons, materials):
        poly.use_smooth = True; poly.material_index = material
        for loop in poly.loop_indices:
            idx = mesh.loops[loop].vertex_index
            uv_layer.data[loop].uv = uvs[idx]
            # White on the textured face; sample the same edge color on side seam loops.
            rgb = colors[idx]
            if material == 1 and rgb == (1, 1, 1):
                rgb = linear(sample(uvs[idx][0]*w, (1-uvs[idx][1])*h, 3))
            albedo.data[loop].color = (*rgb, 1)
    head.vertex_groups.new(name='head').add(list(range(len(vertices))), 1, 'REPLACE')
    return head
