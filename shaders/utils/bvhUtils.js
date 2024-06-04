export const bvhUtilsGLSL = {name: "bvhUtils", code: `
#ifdef USE_BVH
#else
#define USE_BVH
#include <primitiveIntersections>
#define EPSILON 0.0001

uniform highp isampler2D lbvh;
uniform sampler2D primitives;
uniform sampler2D bounds;

struct bvhNode {
    vec3 min;
    vec3 max;
    int primsOrSecondChild;
    int nPrims;
    int axis;
};

bvhNode getNode(int index) {
    highp ivec2 data = texelFetch(lbvh, ivec2(index, 0), 0).xy;
    vec3 min = texelFetch(bounds, ivec2(index * 2, 0), 0).xyz;
    vec3 max = texelFetch(bounds, ivec2(index * 2 + 1, 0), 0).xyz;
    int primOrSecondChild = data.x;
    int nPrims = data.y >> 2;
    int axis = data.y & 0x3;
    return bvhNode(min, max, primOrSecondChild, nPrims, axis);
}

triangle getTriangle(int index) {
    vec3 p1 = texelFetch(primitives, ivec2(index * 3, 0), 0).xyz;
    vec3 p2 = texelFetch(primitives, ivec2(index * 3 + 1, 0), 0).xyz;
    vec3 p3 = texelFetch(primitives, ivec2(index * 3 + 2, 0), 0).xyz;
    return triangle(p1, p2, p3);
}

int boundsIntersect(vec3 rayOrigin, vec3 invDir, vec3 min, vec3 max, float tmin, float tmax) 
{
    vec3 corners[2] = vec3[2](min, max);

    for (int d = 0; d < 3; ++d) {
        int sign = invDir[d] < 0. ? 1 : 0;
        float bmin = corners[sign][d];
        float bmax = corners[1 - sign][d];

        float dmin = (bmin - rayOrigin[d]) * invDir[d];
        float dmax = (bmax - rayOrigin[d]) * invDir[d];

        tmin = dmin > tmin ? dmin : tmin;
        tmax = dmax < tmax ? dmax : tmax;
    }

    return tmin <= tmax ? 1 : 0;
}

intersectionResult primIntersect(int primIndex, vec3 rayOrigin, vec3 rayDir, float tMin, float tMax)
{
    triangle t = getTriangle(primIndex);
    intersectionResult result = intersectTriangle(ray(rayOrigin, rayDir), t);
    if(result.t < tMin || result.t > tMax)
        result.hit = 0;
    return result;
}

intersectionResult rayCast(vec3 rayOrigin, vec3 rayDir, float tMin, float tMax) {
    intersectionResult res;
    res.t = tMax;
    res.hit = 0;
    vec3 invDir = 1.0 / rayDir;
    int negDir[3] = int[3](invDir.x < 0.0 ? 1 : 0, invDir.y < 0.0 ? 1 : 0, invDir.z < 0.0 ? 1 : 0);
    int stack[32];
    int visitOffset = 0;
    int currentIndex = 0;
    int iterationIndex = 0;

    while(true)
    {
        iterationIndex++;
        bvhNode n = getNode(currentIndex);
        int nodeIntersects = boundsIntersect(rayOrigin, invDir, n.min, n.max, tMin, tMax);
        if(nodeIntersects == 1)
        {

            if(n.nPrims > 0)
            {
                for(int i = 0; i < n.nPrims; i++)
                {
                    int pIndex = n.primsOrSecondChild + i;
                    intersectionResult primRes = primIntersect(pIndex, rayOrigin, rayDir, tMin, tMax);
                    if(primRes.hit == 1 && (res.hit == 0 || primRes.t < res.t))
                        res = primRes;
                }
                if(visitOffset == 0) break;
                currentIndex = stack[visitOffset - 1];
                visitOffset--;
            }
            else
            {
                if (negDir[n.axis] == 1) {
                    stack[visitOffset++] = currentIndex + 1;
                    currentIndex = n.primsOrSecondChild;
                 } else {
                    stack[visitOffset++] = n.primsOrSecondChild;
                    currentIndex = currentIndex + 1;
                 }
            }
        }
        else
        {
            if(visitOffset == 0) break;
            currentIndex = stack[visitOffset - 1];
            visitOffset--;
        }
    }
    return res;
}

#endif
`};;