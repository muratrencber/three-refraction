export const svoUtilsGLSL = {name: "svoUtils", code: `
#ifdef USE_SVO
#else
#define USE_SVO
#define MAX_DEPTH 23
#define STACK_SZ 8
#include <primitiveIntersections>

uniform vec3 svoMin;
uniform vec3 svoMax;
uniform int svoDepth;
uniform highp ivec2 svoTexSize;
uniform sampler2D svoData;

struct ChildDescriptor
{
    int index;
    int childMask;
    int isLeaf;
    vec3 normal;
    int childOffset;
};

ChildDescriptor get_cd(int index)
{
    vec4 cd = texelFetch(svoData, ivec2(index % svoTexSize.x, index / svoTexSize.x), 0);
    ChildDescriptor res;
    int cdx = floatBitsToInt(cd.x);
    res.index = index;
    res.childMask = cdx & 0xFF;
    res.isLeaf = (cdx >> 8) & 0x1;
    res.childOffset = (cdx >> 9) & 0x7FFFFF;
    float normalX = cd.y;
    float normalY = cd.z;
    float normalZ = cd.w;
    res.normal = vec3(normalX, normalY, normalZ);
    return res;
}

ChildDescriptor get_child_of(ChildDescriptor cd, int childIdx)
{
    int adjustedChildIdx = childIdx;
    for(int i = 0; i < childIdx; i++)
    {
        if((cd.childMask & (1 << i)) == 0)
        {
            adjustedChildIdx--;
        }
    }
    int childIndex = cd.index + cd.childOffset + adjustedChildIdx;
    return get_cd(childIndex);
}

ChildDescriptor get_cd_from(vec3 pos, int scale, int octant_mask)
{
    ChildDescriptor curr = get_cd(0);
    for(int i = MAX_DEPTH - 1; i > scale; i--)
    {
        int chx = floatBitsToInt(pos.x) >> i;
        int chy = floatBitsToInt(pos.y) >> i;
        int chz = floatBitsToInt(pos.z) >> i;
        int ch = ((chx & 1) | ((chy & 1) << 1) | ((chz & 1) << 2)) ^ octant_mask;
        curr = get_child_of(curr, ch);
    }
    return curr;
}

ChildDescriptor get_leaf_cd_from(vec3 pos, int octant_mask)
{
    int scale = MAX_DEPTH - 1 - svoDepth;
    return get_cd_from(pos, scale, octant_mask);
}

float copysignf(float x, float y)
{
    return sign(y) * abs(x);
}

intersectionResult castRay(ray r)
{    
    
    float epsilon = 0.001;
    int iter = 0;

    // Get rid of small ray direction components to avoid division by zero.

    if (abs(r.direction.x) < epsilon) {
        r.direction.x = copysignf(epsilon, r.direction.x);
    }
    if (abs(r.direction.y) < epsilon) {
        r.direction.y = copysignf(epsilon, r.direction.y);
    }
    if (abs(r.direction.z) < epsilon) {
        r.direction.z = copysignf(epsilon, r.direction.z);
    }

    // Precompute the coefficients of tx(x), ty(y), and tz(z).
    // The octree is assumed to reside at coordinates [1, 2].

    float tx_coef = 1.0f / -abs(r.direction.x);
    float ty_coef = 1.0f / -abs(r.direction.y);
    float tz_coef = 1.0f / -abs(r.direction.z);

    float tx_bias = tx_coef * r.origin.x;
    float ty_bias = ty_coef * r.origin.y;
    float tz_bias = tz_coef * r.origin.z;

    // Select octant mask to mirror the coordinate system so
    // that ray direction is negative along each axis.

    int octant_mask = 0;
    if (r.direction.x > 0.0f) octant_mask ^= 1, tx_bias = 3.0f * tx_coef - tx_bias;
    if (r.direction.y > 0.0f) octant_mask ^= 2, ty_bias = 3.0f * ty_coef - ty_bias;
    if (r.direction.z > 0.0f) octant_mask ^= 4, tz_bias = 3.0f * tz_coef - tz_bias;

    // Initialize the active span of t-values.
    intersectionResult res;

    float t_min = max(max(2.0f * tx_coef - tx_bias, 2.0f * ty_coef - ty_bias), 2.0f * tz_coef - tz_bias);
    float t_max = min(min(tx_coef - tx_bias, ty_coef - ty_bias), tz_coef - tz_bias);
    float h = t_max;
    t_min = max(t_min, 0.0f);
    float orig_t_min = t_min;
    //t_max = max(t_max, 1.0f);
    float orig_t_max = t_max;

    // Initialize the current voxel to the first child of the root.

    vec4 cd = texelFetch(svoData, ivec2(0, 0), 0);
    int cd_index = 0;
    int cd_childMask = floatBitsToInt(cd.x) & 0xFF;
    int cd_isLeaf = (floatBitsToInt(cd.x) >> 8) & 0x1;
    int cd_childOffset = (floatBitsToInt(cd.x) >> 9) & 0x7FFFFF;
    int             idx                 = 0;
    vec3            pos                   = vec3(1.0, 1.0, 1.0);
    int             scale               = MAX_DEPTH - 1;
    float           scale_exp2          = 0.5; // exp2f(scale - s_max)

    if ((1.5f * tx_coef - tx_bias) > t_min) idx ^= 1, pos.x = 1.5f;
    if ((1.5f * ty_coef - ty_bias) > t_min) idx ^= 2, pos.y = 1.5f;
    if ((1.5f * tz_coef - tz_bias) > t_min) idx ^= 4, pos.z = 1.5f;

    int fetchCount = 1;
    int pushCount = 0;
    int popCount = 0;

    int masked_idx = idx ^ octant_mask;

    // Traverse voxels along the ray as long as the current voxel
    // stays within the octree.
    res.hit = 0;
    while (scale < MAX_DEPTH && iter < 100)
    {
        iter++;

        if(cd_isLeaf == 1)
        {
            res.hit = 1;
            break;
        }

        // Determine maximum t-value of the cube by evaluating
        // tx(), ty(), and tz() at its corner.

        float tx_corner = pos.x * tx_coef - tx_bias;
        float ty_corner = pos.y * ty_coef - ty_bias;
        float tz_corner = pos.z * tz_coef - tz_bias;
        float tc_max = min(min(tx_corner, ty_corner), tz_corner);

        // Process voxel if the corresponding bit in valid mask is set
        // and the active t-span is non-empty.

        int child_shift = idx ^ octant_mask; // permute child slots based on the mirroring
        int child_masks = cd_childMask >> child_shift;
        if ((child_masks & 0x1) != 0 && t_min <= t_max)
        {
            // Terminate if the voxel is small enough.

            // INTERSECT
            // Intersect active t-span with the cube and evaluate
            // tx(), ty(), and tz() at the center of the voxel.

            float tv_max = min(t_max, tc_max);
            float halfVal = scale_exp2 * 0.5;
            float tx_center = halfVal * tx_coef + tx_corner;
            float ty_center = halfVal * ty_coef + ty_corner;
            float tz_center = halfVal * tz_coef + tz_corner;

            // Intersect with contour if the corresponding bit in contour mask is set.

            // Descend to the first child if the resulting t-span is non-empty.

            if (t_min <= tv_max)
            {
                // Terminate if the corresponding bit in the non-leaf mask is not set.

                // PUSH
                // Write current parent to the stack.
                //stackIndex[scale] = cd_index;
                //stackCMask[scale] = cd_childMask;
                //stackCOffset[scale] = cd_childOffset;
                //stackIsLeaf[scale] = cd_isLeaf;
                //stackTMax[scale] = t_max;
                h = tc_max;

                // Find child descriptor corresponding to the current voxel.

                int adjustedChildIdx = child_shift;
                for(int i = 0; i < child_shift; i++)
                {
                    if((cd_childMask & (1 << i)) == 0)
                    {
                        adjustedChildIdx--;
                    }
                }
                cd_index = cd_index + cd_childOffset + adjustedChildIdx;
                cd = texelFetch(svoData, ivec2(cd_index % svoTexSize.x, cd_index / svoTexSize.x), 0);
                cd_childMask = floatBitsToInt(cd.x) & 0xFF;
                cd_isLeaf = (floatBitsToInt(cd.x) >> 8) & 0x1;
                cd_childOffset = (floatBitsToInt(cd.x) >> 9) & 0x7FFFFF;
                fetchCount++;

                // Select child voxel that the ray enters first.

                idx = 0;
                scale--;
                scale_exp2 = halfVal;

                if (tx_center >= t_min) idx ^= 1, pos.x += scale_exp2;
                if (ty_center >= t_min) idx ^= 2, pos.y += scale_exp2;
                if (tz_center >= t_min) idx ^= 4, pos.z += scale_exp2;

                // Update active t-span and invalidate cached child descriptor.

                t_max = tv_max;
                continue;
            }
        }

        // ADVANCE
        // Step along the ray.

        int step_mask = 0;
        if (tx_corner <= tc_max) step_mask ^= 1, pos.x -= scale_exp2;
        if (ty_corner <= tc_max) step_mask ^= 2, pos.y -= scale_exp2;
        if (tz_corner <= tc_max) step_mask ^= 4, pos.z -= scale_exp2;

        // Update active t-span and flip bits of the child slot index.

        t_min = tc_max;
        idx ^= step_mask;

        // Proceed with pop if the bit flips disagree with the ray direction.

        if ((idx & step_mask) != 0)
        {
            // POP
            // Find the highest differing bit between the two positions.

            int differing_bits = 0;
            if ((step_mask & 1) != 0) differing_bits |= floatBitsToInt(pos.x) ^ floatBitsToInt(pos.x + scale_exp2);
            if ((step_mask & 2) != 0) differing_bits |= floatBitsToInt(pos.y) ^ floatBitsToInt(pos.y + scale_exp2);
            if ((step_mask & 4) != 0) differing_bits |= floatBitsToInt(pos.z) ^ floatBitsToInt(pos.z + scale_exp2);
            scale = ((floatBitsToInt(float(differing_bits)) >> 23) - 127); // position of the highest bit
            scale_exp2 = intBitsToFloat((scale - MAX_DEPTH + 127) << 23); // exp2f(scale - s_max)

            // Restore parent voxel from the stack.
            ChildDescriptor curr = get_cd(0);
            for(int i = MAX_DEPTH - 1; i > max(scale, 0); i--)
            {
                int chx = floatBitsToInt(pos.x) >> i;
                int chy = floatBitsToInt(pos.y) >> i;
                int chz = floatBitsToInt(pos.z) >> i;
                int ch = ((chx & 1) | ((chy & 1) << 1) | ((chz & 1) << 2)) ^ octant_mask;
                curr = get_child_of(curr, ch);
            }
            cd_index = curr.index;
            cd_childMask = curr.childMask;
            cd_isLeaf = curr.isLeaf;
            cd_childOffset = curr.childOffset;

            // Round cube position and extract child slot index.

            int shx = floatBitsToInt(pos.x) >> scale;
            int shy = floatBitsToInt(pos.y) >> scale;
            int shz = floatBitsToInt(pos.z) >> scale;
            pos.x = intBitsToFloat(shx << scale);
            pos.y = intBitsToFloat(shy << scale);
            pos.z = intBitsToFloat(shz << scale);
            idx  = (shx & 1) | ((shy & 1) << 1) | ((shz & 1) << 2);


            float txn_corner = (pos.x - scale_exp2) * tx_coef - tx_bias;
            float tyn_corner = (pos.y - scale_exp2) * ty_coef - ty_bias;
            float tzn_corner = (pos.z - scale_exp2) * tz_coef - tz_bias;
            float tcn_max = min(min(txn_corner, tyn_corner), tzn_corner);
            t_max = orig_t_max;

            // Prevent same parent from being stored again and invalidate cached child descriptor.
            h = 0.0f;
        }
    }

    if (scale >= MAX_DEPTH)
    {
        t_min = 2.0f;
    }

    // Undo mirroring of the coordinate system.

    if ((octant_mask & 1) == 0) pos.x = 3.0f - scale_exp2 - pos.x;
    if ((octant_mask & 2) == 0) pos.y = 3.0f - scale_exp2 - pos.y;
    if ((octant_mask & 4) == 0) pos.z = 3.0f - scale_exp2 - pos.z;

    // Output results.
    res.t = t_min;
    res.point = r.origin + r.direction * t_min;
    res.normal = get_cd(cd_index).normal;
    return res;
}

intersectionResult rayCast(vec3 rayOrigin, vec3 rayDir, float tMin, float tMax)
{
    vec3 svoCenter = (svoMin + svoMax) * 0.5;
    vec3 centerToCam = rayOrigin - svoCenter;
    float scale = svoMax.x - svoMin.x;
    float invScale = 1. / scale;
    ray r;
    r.origin = vec3(1.5, 1.5, 1.5) + (centerToCam * invScale);
    r.direction = rayDir;

    vec3 otherEndStart = r.origin;
    vec3 otherEndMaxes;
    vec3 infdists = vec3(1.,1.,1.) * 3000.;
    vec3 gridMin = vec3(1., 1., 1.);
    vec3 gridMax = vec3(2., 2., 2.);
    for(int i = 0; i < 3; i++)
    {
        int step = r.direction[i] > 0. ? 1 : (r.direction[i] < 0. ? -1 : 0);
        float otherPos = step == -1 ? gridMin[i] : gridMax[i];
        otherEndMaxes[i] = step == -1 ? (r.origin[i] - otherPos) / r.direction[i] : (step == 1 ? (otherPos - r.origin[i]) / r.direction[i] : infdists[i]);
        otherEndMaxes[i] = abs(otherEndMaxes[i]);
    }
    r.origin = otherEndStart + r.direction * (min(otherEndMaxes[0], min(otherEndMaxes[1], otherEndMaxes[2])) - 0.01);
    r.direction = -r.direction;

    intersectionResult insres = castRay(r);
    if(insres.hit == 1)
    {
        insres.point = svoCenter + (insres.point - vec3(1.5, 1.5, 1.5)) * scale;
        insres.t = distance(insres.point, rayOrigin);
    }
    return insres;
}
#endif
`};;