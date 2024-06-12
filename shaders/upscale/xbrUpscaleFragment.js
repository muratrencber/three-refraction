export const xbrUpscaleFragmentGLSL = {name:"xbrUpscaleFragmentGLSL", code:`
precision highp float;

layout(location=0) out vec4 out1;
uniform sampler2D lowResTexture1;
#if XBR_TARGET_COUNT > 1
uniform sampler2D lowResTexture2;
layout(location=1) out vec4 out2;
#endif
#if XBR_TARGET_COUNT > 2
uniform sampler2D lowResTexture3;
layout(location=2) out vec4 out3;
#endif
#if XBR_TARGET_COUNT > 3
uniform sampler2D lowResTexture4;
layout(location=3) out vec4 out4;
#endif
#if XBR_TARGET_COUNT > 4
uniform sampler2D lowResTexture5;
layout(location=4) out vec4 out5;
#endif
#if XBR_TARGET_COUNT > 5
uniform sampler2D lowResTexture6;
layout(location=5) out vec4 out6;
#endif
#if XBR_TARGET_COUNT > 6
uniform sampler2D lowResTexture7;
layout(location=6) out vec4 out7;
#endif


uniform ivec2 lowResTextureSize;
uniform ivec2 targetTextureSize;
uniform ivec2 fullSize;

const vec3 yVec = vec3(.299000, .587000, .114000);
const vec3 uVec = vec3(-.168736, -.331264, .500000);
const vec3 vVec = vec3(.500000, -.418688, -.081312);
const vec3 weights = vec3(48.0, 7.0, 6.0);

float vecsum(vec3 v)
{
    return v.r + v.g + v.b;
}

float d(vec3 pA, vec3 pB)
{
    float rdist = abs(pA.r - pB.r);
    float gdist = abs(pA.g - pB.g);
    float bdist = abs(pA.b - pB.b);
    vec3 rgbdist = vec3(rdist, gdist, bdist);
    float y = vecsum(rgbdist * yVec);
    float u = vecsum(rgbdist * uVec);
    float v = vecsum(rgbdist * vVec);
    vec3 yuvDist = vec3(y, u, v);
    return vecsum(yuvDist * weights);
}

vec4 sampleXBR(in sampler2D lowResTexture, vec2 normalizedUvCoord)
{
    vec2 uvCoord = normalizedUvCoord * vec2(lowResTextureSize);
    ivec2 uv = ivec2(uvCoord);
    vec2 dist = uvCoord - vec2(uv);
    int index = 0;
    if (dist.x > 0.5)
        index |= 1;
    if (dist.y > 0.5)
        index |= 2;
    vec4 result;

    //0 => x < half, y < half: BOTTOM LEFT
    //1 => x > half, y < half: BOTTOM RIGHT
    //2 => x < half, y > half: TOP LEFT
    //3 => x > half, y > half: TOP RIGHT

    if(index == 2)
    {
        vec4 color_0 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 2))  ) , 0);
        vec4 color_1 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, 2) )  ) , 0);
        vec4 color_3 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-2, 1))  ) , 0);
        vec4 color_4 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 1))  ) , 0);
        vec4 color_5 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, 1) )  ) , 0);
        vec4 color_6 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 1) )  ) , 0);
        vec4 color_8 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-2, 0) ) ) , 0);
        vec4 color_9 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 0) ) ) , 0);
        vec4 color_10 = texelFetch(lowResTexture, ivec2(vec2(        uv        ) ) , 0);
        vec4 color_11 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 0)  ) ) , 0);
        vec4 color_14 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, -1) )) , 0);
        vec4 color_15 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, -1)  )) , 0);

        float d_4_1 	= d(color_4.rgb,  color_1.rgb);
        float d_4_8 	= d(color_4.rgb,  color_8.rgb);
        float d_5_0 	= d(color_5.rgb,  color_0.rgb);
        float d_5_11 	= d(color_5.rgb,  color_11.rgb);
        float d_9_3 	= d(color_9.rgb,  color_3.rgb);
        float d_9_5 	= d(color_9.rgb,  color_5.rgb);
        float d_9_15 	= d(color_9.rgb,  color_15.rgb);
        float d_10_4 	= d(color_10.rgb, color_4.rgb);
        float d_10_6 	= d(color_10.rgb, color_6.rgb);
        float d_10_14 	= d(color_10.rgb, color_14.rgb);
        float d_10_5 	= d(color_10.rgb, color_5.rgb);
        float d_10_9 	= d(color_10.rgb, color_9.rgb);

        // Top Left Edge Detection Rule
        float a1 = (d_10_14 + d_10_6 + d_4_8  + d_4_1 + (4.0 * d_9_5));
        float b1 = ( d_9_15 +  d_9_3 + d_5_11 + d_5_0 + (4.0 * d_10_4));
        if (a1 < b1)
        {
            vec4 new_pixel= (d_10_9 <= d_10_5) ? color_9 : color_5;
            vec4 blended_pixel = mix(new_pixel, color_10, .5);
            result = blended_pixel;
        }
        else
        {
            result = color_10;
        }
    }
    else if(index == 3)
    {
        vec4 color_1 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, 2) )  ) , 0);
        vec4 color_2 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 2) )  ) , 0);
        vec4 color_4 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 1))  ) , 0);
        vec4 color_5 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, 1) )  ) , 0);
        vec4 color_6 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 1) )  ) , 0);
        vec4 color_7 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(2, 1) )  ) , 0);
        vec4 color_9 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 0) ) ) , 0);
        vec4 color_10 = texelFetch(lowResTexture, ivec2(vec2(        uv        ) ) , 0);
        vec4 color_11 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 0)  ) ) , 0);
        vec4 color_12 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(2, 0)  ) ) , 0);
        vec4 color_15 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, -1)  )) , 0);
        vec4 color_16 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, -1)  )) , 0);
        
        float d_10_6 	= d(color_10.rgb, color_6.rgb);
        float d_9_5 	= d(color_9.rgb,  color_5.rgb);
        float d_10_4 	= d(color_10.rgb, color_4.rgb);
        float d_10_16 	= d(color_10.rgb, color_16.rgb);
        float d_6_12 	= d(color_6.rgb,  color_12.rgb);
        float d_6_1	    = d(color_6.rgb,  color_1.rgb);
        float d_5_11 	= d(color_5.rgb,  color_11.rgb);
        float d_11_15 	= d(color_11.rgb, color_15.rgb);
        float d_11_7 	= d(color_11.rgb, color_7.rgb);
        float d_5_2 	= d(color_5.rgb,  color_2.rgb);
        float d_10_5 	= d(color_10.rgb, color_5.rgb);
        float d_10_11  	= d(color_10.rgb, color_11.rgb);

        // Top Right Edge Detection Rule
        float a2 = (d_10_16 + d_10_4 + d_6_12 + d_6_1 + (4.0 * d_5_11));
        float b2 = (d_11_15 + d_11_7 +  d_9_5 + d_5_2 + (4.0 * d_10_6));
        if (a2 < b2)
        {
            vec4 new_pixel= (d_10_5 <= d_10_11) ? color_5 : color_11;
            vec4 blended_pixel = mix(new_pixel, color_10, .5);
            result = blended_pixel;
        }
        else
        {
            result = color_10;
        }
    }
    else if(index == 0)
    {
        vec4 color_4 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 1))  ) , 0);
        vec4 color_5 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, 1) )  ) , 0);
        vec4 color_8 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-2, 0) ) ) , 0);
        vec4 color_9 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 0) ) ) , 0);
        vec4 color_10 = texelFetch(lowResTexture, ivec2(vec2(        uv        ) ) , 0);
        vec4 color_11 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 0)  ) ) , 0);
        vec4 color_13 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-2, -1) )) , 0);
        vec4 color_14 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, -1) )) , 0);
        vec4 color_15 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, -1)  )) , 0);
        vec4 color_16 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, -1)  )) , 0);
        vec4 color_18 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, -2) )) , 0);
        vec4 color_19 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, -2)  )) , 0);

        float d_10_9 	= d(color_10.rgb, color_9.rgb);
        float d_10_15 	= d(color_10.rgb, color_15.rgb);
        float d_10_14 	= d(color_10.rgb, color_14.rgb);
        float d_9_5 	= d(color_9.rgb,  color_5.rgb);
        float d_10_4 	= d(color_10.rgb, color_4.rgb);
        float d_10_16 	= d(color_10.rgb, color_16.rgb);
        float d_11_15 	= d(color_11.rgb, color_15.rgb);
        float d_14_8 	= d(color_14.rgb, color_8.rgb);
        float d_14_19 	= d(color_14.rgb, color_19.rgb);
        float d_9_15 	= d(color_9.rgb,  color_15.rgb);
        float d_15_18 	= d(color_15.rgb, color_18.rgb);
        float d_9_13 	= d(color_9.rgb,  color_13.rgb);

        // Bottom Left Edge Detection Rule
        float a3 = (d_10_4 + d_10_16 +  d_14_8 + d_14_19 + (4.0 * d_9_15));
        float b3 = ( d_9_5 +  d_9_13 + d_11_15 + d_15_18 + (4.0 * d_10_14));
        if (a3 < b3)
        {
            vec4 new_pixel= (d_10_9 <= d_10_15) ? color_9 : color_15;
            vec4 blended_pixel = mix(new_pixel, color_10, .5);
            result = blended_pixel;
        }
        else
        {
            result = color_10;
        }
    }
    else
    {
        vec4 color_5 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, 1) )  ) , 0);
        vec4 color_6 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 1) )  ) , 0);
        vec4 color_9 =  texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, 0) ) ) , 0);
        vec4 color_10 = texelFetch(lowResTexture, ivec2(vec2(        uv        ) ) , 0);
        vec4 color_11 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, 0)  ) ) , 0);
        vec4 color_12 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(2, 0)  ) ) , 0);
        vec4 color_14 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(-1, -1) )) , 0);
        vec4 color_15 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, -1)  )) , 0);
        vec4 color_16 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, -1)  )) , 0);
        vec4 color_17 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(2, -1)  )) , 0);
        vec4 color_19 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(0, -2)  )) , 0);
        vec4 color_20 = texelFetch(lowResTexture, ivec2(vec2(uv + ivec2(1, -2)  )) , 0);

        float d_10_11  	= d(color_10.rgb, color_11.rgb);
        float d_10_15 	= d(color_10.rgb, color_15.rgb);
        float d_10_14 	= d(color_10.rgb, color_14.rgb);
        float d_9_15 	= d(color_9.rgb,  color_15.rgb);
        float d_10_6 	= d(color_10.rgb, color_6.rgb);
        float d_5_11 	= d(color_5.rgb,  color_11.rgb);
        float d_10_16 	= d(color_10.rgb, color_16.rgb);
        float d_11_15 	= d(color_11.rgb, color_15.rgb);
        float d_16_12 	= d(color_16.rgb, color_12.rgb);
        float d_16_19 	= d(color_16.rgb, color_19.rgb);
        float d_15_20 	= d(color_15.rgb, color_20.rgb);
        float d_15_17 	= d(color_15.rgb, color_17.rgb);

        // Bottom Right Edge Detection Rule
        float a4 = (d_10_6 + d_10_14 + d_16_12 + d_16_19 + (4.0 * d_11_15));
        float b4 = (d_9_15 + d_15_20 + d_15_17 +  d_5_11 + (4.0 * d_10_16));
        if (a4 < b4)
        {
            vec4 new_pixel= (d_10_11 <= d_10_15) ? color_11 : color_15;
            vec4 blended_pixel = mix(new_pixel, color_10, .5);
            result = blended_pixel;
        }
        else
        {
            result = color_10;
        }
    }
    return result;
}


void main()
{
    highp vec2 uv = gl_FragCoord.xy / vec2(targetTextureSize);
    highp vec2 texelSize = 1.0 / vec2(fullSize);
    highp vec2 mappedUV = uv * vec2(lowResTextureSize) / vec2(fullSize);
    vec4 p1 = texture(lowResTexture1, mappedUV);
    vec4 p2 = texture(lowResTexture1, mappedUV + vec2(0.5) * texelSize);
    vec4 p3 = texture(lowResTexture1, mappedUV - vec2(0.5) * texelSize);
    vec4 p4 = texture(lowResTexture1, mappedUV + vec2(0.5, -0.5) * texelSize);
    vec4 p5 = texture(lowResTexture1, mappedUV + vec2(-0.5, 0.5) * texelSize);
    bool useXBR = p1.a != 0.0 || p2.a != 0.0 || p3.a != 0.0 || p4.a != 0.0 || p5.a != 0.0;
    out1 = useXBR ? sampleXBR(lowResTexture1, uv) : vec4(1.);
    #if XBR_TARGET_COUNT > 1
    out2 = useXBR ? sampleXBR(lowResTexture2, uv) : texture(lowResTexture2, mappedUV);
    #endif
    #if XBR_TARGET_COUNT > 2
    out3 = useXBR ? sampleXBR(lowResTexture3, uv) : texture(lowResTexture3, mappedUV);
    #endif
    #if XBR_TARGET_COUNT > 3
    out4 = useXBR ? sampleXBR(lowResTexture4, uv) : texture(lowResTexture4, mappedUV);
    #endif
    #if XBR_TARGET_COUNT > 4
    out5 = useXBR ? sampleXBR(lowResTexture5, uv) : texture(lowResTexture5, mappedUV);
    #endif
    #if XBR_TARGET_COUNT > 5
    out6 = useXBR ? sampleXBR(lowResTexture6, uv) : texture(lowResTexture6, mappedUV);
    #endif
    #if XBR_TARGET_COUNT > 6
    out7 = useXBR ? sampleXBR(lowResTexture7, uv) : texture(lowResTexture7, mappedUV);
    #endif
}
`};