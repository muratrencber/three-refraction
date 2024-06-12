#ifndef SVO_H
#define SVO_H
#include "mathutils.h"

#define SIMPLIFY_THRESHOLD 5

struct SVO
{
public:
    Vec3 min, max;
    int depth;
    SVO* children[8];
    Vec3 normal;
    bool isLeaf;

    SVO(Vec3 min, Vec3 max, int depth)
    {
        this->min = min;
        this->max = max;
        this->depth = depth;
        for(int i = 0; i < 8; i++)
        {
            children[i] = nullptr;
        }
        this->normal.zero();
        this->isLeaf = depth == 0;
    }

    int pointIndex(const Vec3 point) const
    {
        int index = 0;
        if(point.x > (min.x + max.x) / 2) index |= 1;
        if(point.y > (min.y + max.y) / 2) index |= 2;
        if(point.z > (min.z + max.z) / 2) index |= 4;
        return index;
    }

    void simpifyVoxel(int parentDepth, int* removeCount)
    {
        if(isLeaf) return;
        bool fullChild = true;
        for(int i = 0; i < 8; i++)
        {
            if(children[i] != nullptr)
            {
                children[i]->simpifyVoxel(parentDepth, removeCount);
            }
            else
            {
                fullChild = false;
            }
        }
        fullChild = parentDepth - depth >= SIMPLIFY_THRESHOLD || fullChild;
        if(!fullChild) return;
        bool hasNormal = false;
        bool allSimilar = true;
        Vec3 averageNormal;
        for(int i = 0; i < 8; i++)
        {
            SVO* child = children[i];
            if(child == nullptr) continue;
            if(!child->isLeaf)
            {
                allSimilar = false;
                break;
            }
            if(!hasNormal)
            {
                averageNormal = child->normal;
                hasNormal = true;
                continue;
            }
            float dot = averageNormal.dot(child->normal);
            if(dot < 0.9f)
            {
                allSimilar = false;
                break;
            }
        }
        if(!allSimilar) return;
        for(int i = 0; i < 8; i++)
        {
            if(children[i] != nullptr)
            {
                delete children[i];
                children[i] = nullptr;
                (*removeCount)++;
            }
        }
        this->isLeaf = true;
        this->normal = averageNormal;
    }

    void createChild(int index)
    {
        Vec3 newMin, newMax;
        newMin.zero();
        newMax.zero();
        Vec3 mid = (min + max) / 2;
        for(int i = 0; i < 3; i++)
        {
            bool shifted = (index & (1 << i)) != 0;
            newMin[i] = shifted ? mid[i] : min[i];
            newMax[i] = shifted ? max[i] : mid[i];
        }
        SVO* child = new SVO(newMin, newMax, depth - 1);
        children[index] = child;
    }

    void insertVoxel(Vec3 center, Vec3 averageNormal, int* nodeCount)
    {
        if(depth == 0)
        {
            normal = averageNormal;
            return;
        }
        int index = pointIndex(center);
        if(children[index] == nullptr)
        {
            createChild(index);
            (*nodeCount)++;
        }
        children[index]->insertVoxel(center, averageNormal, nodeCount);
    }

    ~SVO()
    {
        for(int i = 0; i < 8; i++)
        {
            if(children[i] != nullptr)
                delete children[i];
        }
    }
};
#endif