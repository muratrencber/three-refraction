#include <stdlib.h>
#include <cstring>
#include "./includes/mathutils.h"
extern "C"
{

    #define N_BUCKETS 12


struct BVHPrimitive
{
    int index;
    Triangle triangle;

    Vec3 centroid() const
    {
        return triangle.centroid();
    }
};

struct LinearBVHNode
{
    int primOrSecondChildOffset;
    int nPrims;
    int splitAxis;
};

struct SAHBucket
{
    int count = 0;
    Bounds bounds;
    bool boundsSet = false;

    void unionWith(const Bounds& b)
    {
        if(!boundsSet)
        {
            bounds = b.clone();
            boundsSet = true;
        }
        else
        {
            bounds.unionWithOther(b);
        }
    }
};

class OrderedPrimitives
{
public:
    int* indexArray;
    int currentSize = 0;
    int maxSize = 0;
    OrderedPrimitives(int primCount)
    {
        indexArray = new int[primCount];
        maxSize = primCount;
        currentSize = 0;
    }

    int alloc(int start, int end, BVHPrimitive* prims)
    {
        int startIndex = currentSize;
        for(int i = start; i < end; i++)
        {
            indexArray[currentSize++] = prims[i].index;
        }
        return startIndex;
    }
};

class BVHNode
{
    friend class BVHConstructor;
    Bounds bounds;
    int nPrims;
    int primOrSecondChildOffset;
    int splitAxis = 0;
    BVHNode* children[2];
public:
    void initLeaf(int offset, int count, Bounds bounds)
    {
        this->bounds = bounds.clone();
        nPrims = count;
        primOrSecondChildOffset = offset;
    }

    void initInterior(int axis, BVHNode* c0, BVHNode* c1)
    {
        splitAxis = axis;
        children[0] = c0;
        children[1] = c1;
        bounds = c0->bounds.clone();
        bounds.unionWithOther(c1->bounds);
    }
};

class BVHConstructor
{
    Triangle* triangles;
    BVHPrimitive* prims;
    OrderedPrimitives orderedPrims;
    int leafChildCount = 1;

public:
    int* linearNodes;
    float* bounds;
    float* orderedTriangles;
    int totalNodes = 0;
    int primCount;
    BVHConstructor(float* primArray, int primCount, int leafChildCount) : orderedPrims(primCount)
    {
        this->primCount = primCount;
        this->leafChildCount = leafChildCount;
        triangles = new Triangle[primCount];
        prims = new BVHPrimitive[primCount];
        for(int i = 0; i < primCount; i++)
        {
            Vec3 p1 = {primArray[i * 9 + 0], primArray[i * 9 + 1], primArray[i * 9 + 2]};
            Vec3 p2 = {primArray[i * 9 + 3], primArray[i * 9 + 4], primArray[i * 9 + 5]};
            Vec3 p3 = {primArray[i * 9 + 6], primArray[i * 9 + 7], primArray[i * 9 + 8]};
            Triangle t = {p1, p2, p3};
            BVHPrimitive p;
            p.index = i;
            p.triangle = t;
            prims[i] = p;
            triangles[i] = t;
        }
    }

    void flatten(BVHNode* root)
    {
        linearNodes = new int[totalNodes * 2];
        bounds = new float[totalNodes * 6];
        orderedTriangles = new float[primCount * 9];
        int offset = 0;
        flattenNode(root, &offset);
        for(int i = 0; i < orderedPrims.currentSize; i++)
        {
            Triangle t = triangles[orderedPrims.indexArray[i]];
            orderedTriangles[i * 9 + 0] = t.p1.x;
            orderedTriangles[i * 9 + 1] = t.p1.y;
            orderedTriangles[i * 9 + 2] = t.p1.z;
            orderedTriangles[i * 9 + 3] = t.p2.x;
            orderedTriangles[i * 9 + 4] = t.p2.y;
            orderedTriangles[i * 9 + 5] = t.p2.z;
            orderedTriangles[i * 9 + 6] = t.p3.x;
            orderedTriangles[i * 9 + 7] = t.p3.y;
            orderedTriangles[i * 9 + 8] = t.p3.z;
        }
    }

    int flattenNode(BVHNode* node, int* offset)
    {
        int thisIndex = *offset;
        (*offset)++;
        int nPrims = node->nPrims << 2;
        int splitAxis = node->splitAxis & 0x3;
        linearNodes[thisIndex * 2 + 1] = nPrims | splitAxis;
        bounds[thisIndex * 6 + 0] = node->bounds.min.x;
        bounds[thisIndex * 6 + 1] = node->bounds.min.y;
        bounds[thisIndex * 6 + 2] = node->bounds.min.z;
        bounds[thisIndex * 6 + 3] = node->bounds.max.x;
        bounds[thisIndex * 6 + 4] = node->bounds.max.y;
        bounds[thisIndex * 6 + 5] = node->bounds.max.z;
        if(node->nPrims > 0)
        {
            linearNodes[thisIndex * 2] = node->primOrSecondChildOffset;
        }
        else
        {
            flattenNode(node->children[0], offset);
            int secondChildIndex = flattenNode(node->children[1], offset);
            linearNodes[thisIndex * 2] = secondChildIndex;
        }
        return thisIndex;
    }

    BVHNode* buildRecursive(int spanStart, int spanEnd)
    {
        BVHNode* node = new BVHNode();
        int thisIndex = totalNodes;
        totalNodes++;
        Bounds b = prims[spanStart].triangle.boundingBox();
        for(int i = spanStart + 1; i < spanEnd; i++)
        {
            b.unionWithOther(prims[i].triangle.boundingBox());
        }
        if(b.surfaceArea() == 0.0f || spanEnd - spanStart < leafChildCount)
        {
            int primOffset = orderedPrims.alloc(spanStart, spanEnd, prims);
            node->initLeaf(primOffset, spanEnd - spanStart, b);
            return node;
        }
        Bounds centroidBounds;
        centroidBounds.min = prims[spanStart].centroid();
        centroidBounds.max = centroidBounds.min;
        for(int i = spanStart + 1; i < spanEnd; i++)
        {
            centroidBounds.unionWithPoint(prims[i].centroid());
        }
        int dim = centroidBounds.maxDimension();
        if(centroidBounds.min[dim] == centroidBounds.max[dim])
        {
            int primOffset = orderedPrims.alloc(spanStart, spanEnd, prims);
            node->initLeaf(primOffset, spanEnd - spanStart, b);
            return node;
        }
        int mid = (spanStart + spanEnd) / 2;
        SAHBucket buckets[N_BUCKETS];
        for(int i = 0; i < N_BUCKETS; i++)
        {
            buckets[i].boundsSet = false;
            buckets[i].count = 0;
        }
        for(int i = spanStart; i < spanEnd; i++)
        {
            BVHPrimitive prim = prims[i];
            int bucketIndex = (int)(N_BUCKETS * centroidBounds.offset(prim.centroid())[dim]);
            if(bucketIndex == N_BUCKETS) bucketIndex = N_BUCKETS - 1;
            buckets[bucketIndex].count++;
            buckets[bucketIndex].unionWith(prim.triangle.boundingBox());
        }
        int nSplits = N_BUCKETS - 1;
        float costs[N_BUCKETS - 1] = {0.0f};
        int countBelow = 0;
        Bounds boundsBelow;
        bool boundsBelowSet = false;
        for(int i = 0; i < nSplits; i++)
        {
            if(buckets[i].boundsSet)
            {
                if(boundsBelowSet)
                {
                    boundsBelow.unionWithOther(buckets[i].bounds);
                }
                else
                {
                    boundsBelow = buckets[i].bounds.clone();
                    boundsBelowSet = true;
                }
            }
            countBelow += buckets[i].count;
            costs[i] = countBelow * boundsBelow.surfaceArea();
        }
        int countAbove = 0;
        Bounds boundsAbove;
        bool boundsAboveSet = false;
        for(int i = nSplits; i > 0; i--)
        {
            if(buckets[i].boundsSet)
            {
                if(boundsAboveSet)
                {
                    boundsAbove.unionWithOther(buckets[i].bounds);
                }
                else
                {
                    boundsAbove = buckets[i].bounds.clone();
                    boundsAboveSet = true;
                }
            }
            countAbove += buckets[i].count;
            costs[i - 1] += countAbove * boundsAbove.surfaceArea();
        }
        int minCostIndex = -1;
        float minCost = 0;
        for(int i = 0; i < nSplits; i++)
        {
            if(costs[i] == 0.0f) continue;
            if(minCostIndex == -1 || costs[i] < minCost)
            {
                minCost = costs[i];
                minCostIndex = i;
            }
        }
        int leafCost = spanEnd - spanStart;
        minCost = 0.5f + (minCost / b.surfaceArea()); 
        if(minCost < leafCost)
        {
            int greaterCount = 0;

            for(int i = spanStart; i < spanEnd - greaterCount; i++)
            {
                BVHPrimitive prim = prims[i];
                int bucketIndex = (int)(N_BUCKETS * centroidBounds.offset(prim.centroid())[dim]);
                if(bucketIndex <= minCostIndex)
                    continue;
                BVHPrimitive temp = prims[i];
                prims[i] = prims[spanEnd - 1 - greaterCount];
                prims[spanEnd - 1 - greaterCount] = temp;
                greaterCount++;
                i--;
            }
            mid = spanEnd - greaterCount;
            BVHNode* c0 = this->buildRecursive(spanStart, mid);
            BVHNode* c1 = this->buildRecursive(mid, spanEnd);
            node->initInterior(dim, c0, c1);
            return node;
        }

        int primOffset = orderedPrims.alloc(spanStart, spanEnd, prims);
        node->initLeaf(primOffset, spanEnd - spanStart, b);
        return node;
    }

    ~BVHConstructor()
    {
        delete[] linearNodes;
        delete[] bounds;
        delete[] orderedTriangles;
        delete[] prims;
    }
};

int* constructLinearBVH(float* primArray, int primCount, int leafChildCount)
{
    BVHConstructor constructor(primArray, primCount, leafChildCount);
    BVHNode* root = constructor.buildRecursive(0, primCount);
    constructor.flatten(root);
    int* finalArray = (int*)malloc(sizeof(int) * (constructor.totalNodes * 2 + 2) + sizeof(float) * (primCount * 9 + constructor.totalNodes * 6));
    finalArray[0] = constructor.totalNodes;
    finalArray[1] = primCount;
    std::memcpy(finalArray + 2, constructor.linearNodes, sizeof(int) * constructor.totalNodes * 2);
    std::memcpy(finalArray + 2 + constructor.totalNodes * 2, constructor.bounds, sizeof(float) * constructor.totalNodes * 6);
    std::memcpy(finalArray + 2 + constructor.totalNodes * 2 + constructor.totalNodes * 6, constructor.orderedTriangles, sizeof(float) * primCount * 9);
    delete[] primArray;
    return finalArray;
}
}
