export const voxelGridUtilsGLSL = {name: "voxelGridUtils", code: `
#ifdef USE_VOXEL_GRID
#else
#define USE_VOXEL_GRID
#endif
#include <primitiveIntersections>

uniform highp sampler3D grid;
uniform vec3 gridMin;
uniform ivec3 gridDimensions;
uniform float voxelSize;

const ivec3 edgeNeighbours1[12] = ivec3[12](
    ivec3(0,0,0), 
    ivec3(0,1,0), 
    ivec3(1,0,0), 
    ivec3(1,1,0), 
    ivec3(0,0,0), 
    ivec3(0,1,0), 
    ivec3(0,0,1), 
    ivec3(0,1,1), 
    ivec3(0,0,-1),
    ivec3(1,0,-1),
    ivec3(0,0,0), 
    ivec3(1,0,0));

const ivec3 edgeNeighbours2[12] = ivec3[12](
    ivec3(-1,0,0),
    ivec3(-1,1,0),
    ivec3(0,0,0 ) ,
    ivec3(0,1,0 ) ,
    ivec3(0,0,-1),
    ivec3(0,1,-1),
    ivec3(0,0,0 ) ,
    ivec3(0,1,0 ) ,
    ivec3(0,0,0 ) ,
    ivec3(1,0,0 ) ,
    ivec3(0,0,1 ) ,
    ivec3(1,0,1 ) );

const ivec3 edgeNeighbours3[12] = ivec3[12](
    ivec3(-1,-1,0), 
    ivec3(-1,0,0 ), 
    ivec3(0,-1,0 ), 
    ivec3(0,0,0  ), 
    ivec3(0,-1,-1), 
    ivec3(0,0,-1 ), 
    ivec3(0,-1,0 ), 
    ivec3(0,0,0  ), 
    ivec3(-1,0,0 ),
    ivec3(0,0,0  ),
    ivec3(-1,0,1 ), 
    ivec3(0,0,1  ));

const ivec3 edgeNeighbours4[12] = ivec3[12](
    ivec3(0,0,0) , 
    ivec3(0,1,0) , 
    ivec3(1,0,0) , 
    ivec3(1,1,0) , 
    ivec3(0,0,0) , 
    ivec3(0,1,0) , 
    ivec3(0,0,1) , 
    ivec3(0,1,1) , 
    ivec3(0,0,-1),
    ivec3(1,0,-1),
    ivec3(0,0,0 ), 
    ivec3(1,0,0 ));

const ivec3 edgeNeighbours5[12] = ivec3[12](
    ivec3(0,-1,0) , 
    ivec3(0,0,0)  , 
    ivec3(1,-1,0) , 
    ivec3(1,0,0)  , 
    ivec3(0,-1,0) , 
    ivec3(0,0,0)  , 
    ivec3(0,-1,1) , 
    ivec3(0,0,1)  , 
    ivec3(-1,0,-1),
    ivec3(0,0,-1 ),
    ivec3(-1,0,0) , 
    ivec3(0,0,0)  );

const ivec3 edgeNeighbours6[12] = ivec3[12](
    ivec3(-1,-1,0),
    ivec3(-1,0,0),
    ivec3(0,-1,0),
    ivec3(0,0,0),
    ivec3(0,-1,-1),
    ivec3(0,0,-1),
    ivec3(0,-1,0),
    ivec3(0,0,0),
    ivec3(-1,0,0),
    ivec3(0,0,0),
    ivec3(-1,0,1),
    ivec3(0,0,1));

struct voxel {
    ivec3 coords;
    int isFilled;
    vec3 normalOrDualContouringPos;
    vec3 center;
    int edgeMask;
};

voxel getVoxelFromIndices(ivec3 indices)
{
    vec4 data = texelFetch(grid, indices, 0);
    vec3 center = vec3(indices) * voxelSize + gridMin + vec3(voxelSize) * 0.5;
    int wAsInt = floatBitsToInt(data.w);
    return voxel(indices, wAsInt & 0x01, data.xyz, center, (wAsInt >> 1));
}

voxel getVoxel(vec3 pos)
{
    vec3 toPos = (pos - gridMin) / voxelSize;
    ivec3 voxelCoords = ivec3(floor(toPos));
    return getVoxelFromIndices(voxelCoords);
}

vec3 getVoxelDualContourPos(int x, int y, int z)
{
    vec4 data = texelFetch(grid, ivec3(x,y,z), 0);
    return data.xyz;
}

intersectionResult dualContouringIntersect(vec3 rayOrigin, vec3 rayDir, int edgeMask, ivec3 coords, float tMin, float tMax)
{
    intersectionResult closestRes;
    intersectionResult res;
    ray r = ray(rayOrigin, rayDir);
    for(int i = 0; i < 12; i++)
    {
        int bitmask = 1 << i;
        int anded = edgeMask & bitmask;
        if(anded == 0) continue;
        ivec3 iset11 = edgeNeighbours1[i];
        ivec3 iset12 = edgeNeighbours2[i];
        ivec3 iset13 = edgeNeighbours3[i];
        ivec3 iset21 = edgeNeighbours4[i];
        ivec3 iset22 = edgeNeighbours5[i];
        ivec3 iset23 = edgeNeighbours6[i];
        
        vec3 c11 = getVoxelDualContourPos(coords.x+iset11[0], coords.y+iset11[1], coords.z+iset11[2]);
        vec3 c12 = getVoxelDualContourPos(coords.x+iset12[0], coords.y+iset12[1], coords.z+iset12[2]);
        vec3 c13 = getVoxelDualContourPos(coords.x+iset13[0], coords.y+iset13[1], coords.z+iset13[2]);
        vec3 c21 = getVoxelDualContourPos(coords.x+iset21[0], coords.y+iset21[1], coords.z+iset21[2]);
        vec3 c22 = getVoxelDualContourPos(coords.x+iset22[0], coords.y+iset22[1], coords.z+iset22[2]);
        vec3 c23 = getVoxelDualContourPos(coords.x+iset23[0], coords.y+iset23[1], coords.z+iset23[2]);

        triangle t1 = triangle(c11,c12,c13);
        res = intersectTriangle(r, t1);
        if(res.t < tMin || res.t > tMax) res.hit = 0;
        if(res.hit == 1 && (closestRes.hit == 0 || res.t < closestRes.t)) closestRes = res;
        t1.v0 = c21;
        t1.v1 = c23;
        t1.v2 = c22;
        res = intersectTriangle(r, t1);
        if(res.t < tMin || res.t > tMax) res.hit = 0;
        if(res.hit == 1 && (closestRes.hit == 0 || res.t < closestRes.t)) closestRes = res;
    }
    float dot1 = dot(rayDir, closestRes.normal);
    float dot2 = dot(rayDir, -closestRes.normal);
    return closestRes;
}

intersectionResult rayCast(vec3 rayOrigin, vec3 rayDir, float tMin, float tMax) {
    rayDir = normalize(rayDir);
    vec3 otherEndStart = rayOrigin;
    vec3 otherEndMaxes;
    vec3 infdists = vec3(1.,1.,1.) * 3000.;
    for(int i = 0; i < 3; i++)
    {
        int step = rayDir[i] > 0. ? 1 : (rayDir[i] < 0. ? -1 : 0);
        float otherPos = step == -1 ? gridMin[i] : gridMin[i] + float(gridDimensions[i]) * voxelSize;
        otherEndMaxes[i] = step == -1 ? (rayOrigin[i] - otherPos) / rayDir[i] : (step == 1 ? (otherPos - rayOrigin[i]) / rayDir[i] : infdists[i]);
        otherEndMaxes[i] = abs(otherEndMaxes[i]);
    }
    vec3 origRayOrig = rayOrigin;
    tMax = min(otherEndMaxes[0], min(otherEndMaxes[1], otherEndMaxes[2])) - 0.01;
    rayOrigin = otherEndStart + rayDir * tMax;
    tMax = distance(origRayOrig, rayOrigin);
    rayDir = -rayDir;
    vec3 invDir = 1.0 / rayDir;
    vec3 tMaxes = vec3(0.,0.,0.);
    vec3 tDeltas= vec3(0.,0.,0.);
    ivec3 steps = ivec3(0,0,0);
    voxel previous = getVoxel(rayOrigin);
    ivec3 indices = previous.coords;
    if(indices[0] >= gridDimensions.x || indices[1] >= gridDimensions.y || indices[2] >= gridDimensions.z || indices[0] < 0 || indices[1] < 0 || indices[2] < 0)
    {
        intersectionResult res;
        res.hit = 0;
        return res;
    }
    int iterCount = 0;
    for(int i = 0; i < 3; i++)
    {
        steps[i] = rayDir[i] > 0. ? 1 : (rayDir[i] < 0. ? -1 : 0);
        ivec3 advancedIndices = indices;
        advancedIndices[i] += 1;
        vec3 otherPos = steps[i] > 0 ? gridMin + vec3(advancedIndices) * voxelSize : gridMin + vec3(indices) * voxelSize;
        tMaxes[i] = steps[i] == 1 ? (otherPos[i] - rayOrigin[i]) * invDir[i] : steps[i] == -1 ? (rayOrigin[i] - otherPos[i]) * invDir[i] : infdists[i];
        tMaxes[i] = abs(tMaxes[i]);
        tDeltas[i] = steps[i] != 0 ? abs(voxelSize * invDir[i]) : infdists[i];
    }
    int lastSelection = -1;
    vec3 savedMaxes = tMaxes;
    intersectionResult lastValidResult;
    while(iterCount < 1000 && indices[0] < gridDimensions.x && indices[1] < gridDimensions.y && indices[2] < gridDimensions.z && indices[0] >= 0 && indices[1] >= 0 && indices[2] >= 0)
    {
        iterCount++;
        voxel current = getVoxelFromIndices(indices);
        if(current.isFilled == 1)
        {
#ifdef CONTOURING_AVERAGE_NORMALS
            intersectionResult res;
            res.hit = 1;
            res.point = rayOrigin + rayDir * min(savedMaxes[0], min(savedMaxes[1], savedMaxes[2]));
            res.normal = -current.normalOrDualContouringPos;
            res.t = distance(origRayOrig, res.point);
#elif defined(CONTOURING_DUAL_CONTOURING)
            float thisVoxelT = min(savedMaxes[0], min(savedMaxes[1], savedMaxes[2]));
            float nextVoxelT = min(tMaxes[0], min(tMaxes[1], tMaxes[2]));
            intersectionResult res = dualContouringIntersect(rayOrigin, rayDir, current.edgeMask, indices, 0., 2000.);
            res.t = distance(origRayOrig, res.point);
#endif
#ifdef IS_CONVEX
            if(res.hit == 1)
                return res;
#endif
            float thisT = distance(rayOrigin, res.point);
            if(res.hit == 1 && thisT >= tMax - 0.01)
            {
                return lastValidResult;
            }
            if(res.hit == 1) lastValidResult = res;
        }
        savedMaxes = tMaxes;
        if(tMaxes[0] < tMaxes[1] && tMaxes[0] < tMaxes[2])
        {
            indices[0] += steps[0];
            tMaxes[0] += tDeltas[0];
            lastSelection = 0;
        }
        else if(tMaxes[1] < tMaxes[2])
        {
            indices[1] += steps[1];
            tMaxes[1] += tDeltas[1];
            lastSelection = 1;
        }
        else
        {
            indices[2] += steps[2];
            tMaxes[2] += tDeltas[2];
            lastSelection = 2;
        }
        if(current.coords != previous.coords)
            previous = current;
    }
    intersectionResult res;
    res.hit = 0;
    return lastValidResult;
}
`};;