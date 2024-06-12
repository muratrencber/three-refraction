#include "../includes/mathutils.h"
#include "../includes/triangleIntersects.h"
#include "../includes/svo.h"
#include <cmath>
#include <cstring>
#include <queue>
#include <iostream>

template <typename T>
T tripleMin(T a, T b, T c)
{
    return (a < b) ? ((a < c) ? a : c) : ((b < c) ? b : c);
}

template <typename T>
T tripleMax(T a, T b, T c)
{
    return (a > b) ? ((a > c) ? a : c) : ((b > c) ? b : c);
}

struct Voxel
{
    int childCount = 0;
    Vec3 normalSum = Vec3(0, 0, 0);
};

Voxel getVoxel(Voxel* grid, int xIndex, int yIndex, int zIndex, int gridSize[3])
{
    return grid[xIndex * gridSize[1] * gridSize[2] + yIndex * gridSize[2] + zIndex];
}

struct indexTriplet
{
    int x, y, z;
};

indexTriplet getIndices(Vec3 point, Vec3 minPoint, float voxelSize)
{
    Vec3 offset = point - minPoint;
    return {(int)std::floor(offset.x / voxelSize), (int)std::floor(offset.y / voxelSize), (int)std::floor(offset.z / voxelSize)};
}

struct GridProperties
{
    Vec3 min;
    int* gridSize;
    float voxelSize;
};

Voxel* initGrid(float* prims, int primCount, GridProperties props)
{
    int gridSize[3] = {props.gridSize[0], props.gridSize[1], props.gridSize[2]};
    float voxelSize = props.voxelSize;
    Vec3 min = props.min;
    Voxel* grid = new Voxel[gridSize[0] * gridSize[1] * gridSize[2]];
    int yMultiplier = gridSize[2];
    int xMultiplier = gridSize[1] * gridSize[2];
    Vec3 halfVxExtents = Vec3(voxelSize / 2.f, voxelSize / 2.f, voxelSize / 2.f);

    for(int i = 0; i < primCount; i++)
    {
        Vec3 p1 = Vec3(prims[i * 9 + 0], prims[i * 9 + 1], prims[i * 9 + 2]);
        Vec3 p2 = Vec3(prims[i * 9 + 3], prims[i * 9 + 4], prims[i * 9 + 5]);
        Vec3 p3 = Vec3(prims[i * 9 + 6], prims[i * 9 + 7], prims[i * 9 + 8]);

        Triangle tri = {p1, p2, p3};

        indexTriplet p1Index = getIndices(p1, min, voxelSize);
        indexTriplet p2Index = getIndices(p2, min, voxelSize);
        indexTriplet p3Index = getIndices(p3, min, voxelSize);

        int pminx = tripleMin(p1Index.x, p2Index.x, p3Index.x);
        int pminy = tripleMin(p1Index.y, p2Index.y, p3Index.y);
        int pminz = tripleMin(p1Index.z, p2Index.z, p3Index.z);

        int pmaxx = tripleMax(p1Index.x, p2Index.x, p3Index.x);
        int pmaxy = tripleMax(p1Index.y, p2Index.y, p3Index.y);
        int pmaxz = tripleMax(p1Index.z, p2Index.z, p3Index.z);

        for(int x = pminx; x <= pmaxx; x++)
        {
            for(int y = pminy; y <= pmaxy; y++)
            {
                for(int z = pminz; z <= pmaxz; z++)
                {
                    Vec3 vxCenter = min + Vec3((x + 0.5f) * voxelSize, (y + 0.5f) * voxelSize, (z + 0.5f) * voxelSize);
                    Vec3 testp1 = p1;
                    Vec3 testp2 = p2;
                    Vec3 testp3 = p3;
                    Vec3 testHalfSize = halfVxExtents;
                    bool intersects = threeyd::moeller::TriangleIntersects<Vec3>::box(testp1, testp2, testp3, vxCenter, testHalfSize);
                    if(intersects)
                    {
                        Voxel& vx = grid[x * xMultiplier + y * yMultiplier + z];
                        vx.childCount++;
                        Vec3 normal = (p3 - p1).cross(p2 - p1).normalized();
                        vx.normalSum.add(normal);
                    }
                }
            }
        }
    }
    return grid;
}

extern "C"
{
float* constructVoxelGrid(float* prims, int primCount, int size)
{
    Vec3 min(prims[0], prims[1], prims[2]);
    Vec3 max = min;
    for(int i = 1; i < primCount * 3; i++)
    {
        min.min(prims[i * 3 + 0], prims[i * 3 + 1], prims[i * 3 + 2]);
        max.max(prims[i * 3 + 0], prims[i * 3 + 1], prims[i * 3 + 2]);
    }
    Vec3 extents = max - min;
    float maxExtent = extents.maxComponent();
    float voxelSize = maxExtent / (float)(size - 1);
    min.sub(voxelSize / 2);
    max.add(voxelSize / 2);
    extents = max - min;
    maxExtent = extents.maxComponent();
    voxelSize = maxExtent / (float)(size);
    int gridSize[3] = {(int)std::ceil(extents.x / voxelSize), (int)std::ceil(extents.y / voxelSize), (int)std::ceil(extents.z / voxelSize)};
    max = min + Vec3(gridSize[0] * voxelSize, gridSize[1] * voxelSize, gridSize[2] * voxelSize);
    Voxel* grid = initGrid(prims, primCount, {min, gridSize, voxelSize});
    int totalGridSize = gridSize[0] * gridSize[1] * gridSize[2];
    float* result = new float[(totalGridSize * 4) + 7];
    result[0] = min.x;
    result[1] = min.y;
    result[2] = min.z;
    memcpy(result + 3, gridSize, 3 * sizeof(int));
    result[6] = voxelSize;
    int offset = 7;
    int xMultiplier = gridSize[1] * gridSize[2];
    int yMultiplier = gridSize[2];
    for(int z = 0; z < gridSize[2]; z++)
    {
        for(int y = 0; y < gridSize[1]; y++)
        {
            for(int x = 0; x < gridSize[0]; x++)
            {
                Voxel vx = grid[x * xMultiplier + y * yMultiplier + z];
                int index = offset + (z * gridSize[0] * gridSize[1] + y * gridSize[0] + x) * 4;
                int isFilled = vx.childCount > 0 ? 1 : 0;
                Vec3 avgNormal = vx.childCount > 0 ? vx.normalSum / (float)vx.childCount : vx.normalSum;
                result[index] = avgNormal.x;
                result[index+1] = avgNormal.y;
                result[index+2] = avgNormal.z;
                memcpy(result + index + 3, &isFilled, sizeof(int));
            }
        }
    }
    delete[] grid;
    return result;
}

struct NodeStackElement
{
    SVO* node;
    int parentIndex;
};

indexTriplet getSVOIndex(Vec3 point, Vec3 minPoint, float voxelSize)
{
    Vec3 offset = point - minPoint;
    return {(int)std::floor(offset.x / voxelSize), (int)std::floor(offset.y / voxelSize), (int)std::floor(offset.z / voxelSize)};
}

float* constructSVO(float* prims, int primCount, int depth)
{
    Vec3 min(prims[0], prims[1], prims[2]);
    Vec3 max = min;
    for(int i = 1; i < primCount * 3; i++)
    {
        min.min(prims[i * 3 + 0], prims[i * 3 + 1], prims[i * 3 + 2]);
        max.max(prims[i * 3 + 0], prims[i * 3 + 1], prims[i * 3 + 2]);
    }
    Vec3 extents = max - min;
    float maxExtent = extents.maxComponent();
    float svoSize = maxExtent;
    for(int i = 0; i < depth; i++) svoSize /= 2.f;
    min.sub(svoSize / 2);
    max.add(svoSize / 2);
    extents = max - min;
    maxExtent = extents.maxComponent();
    svoSize = maxExtent;
    for(int i = 0; i < depth; i++) svoSize /= 2.f;
    int size = std::round(maxExtent / svoSize);
    max = min;
    max.add(maxExtent);
    Voxel* voxels = initGrid(prims, primCount, {min, new int[3]{size, size, size}, svoSize});
    SVO root = SVO(min, max, depth);
    int nodeCount = 1;
    for(int x = 0; x < size; x++)
    {
        for(int y = 0; y < size; y++)
        {
            for(int z = 0; z < size; z++)
            {
                Voxel& vx = voxels[x * size * size + y * size + z];
                if(vx.childCount == 0) continue;
                Vec3 averageNormal = vx.normalSum / (float)vx.childCount;
                Vec3 center = min + Vec3((x + 0.5f) * svoSize, (y + 0.5f) * svoSize, (z + 0.5f) * svoSize);
                root.insertVoxel(center, averageNormal, &nodeCount);
            }
        }
    }
    delete[] voxels;
    int offset = 8;
    int resultSize = nodeCount * 4 + offset;
    float* result = new float[resultSize];
    result[0] = min.x;
    result[1] = min.y;
    result[2] = min.z;
    result[3] = max.x;
    result[4] = max.y;
    result[5] = max.z;
    memcpy(result + 6, &size, sizeof(int));
    int currentNodeIndex = 0;
    std::queue<NodeStackElement> nodeStack;
    nodeStack.push({&root, -1});
    while(!nodeStack.empty())
    {
        NodeStackElement stackElem = nodeStack.front();
        nodeStack.pop();
        int parentIndex = stackElem.parentIndex;
        SVO* node = stackElem.node;
        int childMask = 0;
        for(int i = 0; i < 8; i++)
        {
            if(node->children[i] != nullptr)
            {
                childMask |= 1 << i;
                nodeStack.push({node->children[i], currentNodeIndex});
            }
        }
        int isLeaf = node->isLeaf ? (1 << 8) : 0;
        Vec3 averageNormal = node->normal;
        if(parentIndex != -1)
        {
            int childOffset = currentNodeIndex - parentIndex;
            int shiftedIndex = (childOffset << 9);
            int* parent = (int*)(result + parentIndex * 4 + offset);
            int parentValue = *parent;
            int parentChildOffset = parentValue >> 9;
            if(parentChildOffset == 0)
            {
                parentValue |= shiftedIndex;
                (*parent) = parentValue;
            }
        }
        int packedBits = (childMask) | isLeaf;
        memcpy(result + currentNodeIndex * 4 + offset, &packedBits, sizeof(int));
        result[currentNodeIndex * 4 + 1 + offset] = averageNormal.x;
        result[currentNodeIndex * 4 + 2 + offset] = averageNormal.y;
        result[currentNodeIndex * 4 + 3 + offset] = averageNormal.z;
        currentNodeIndex++;
    }
    memcpy(result + 7, &currentNodeIndex, sizeof(int));
    return result;
}
}