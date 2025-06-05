precision highp float;

// Common uniforms
uniform sampler2D uImage;
uniform vec2 uResolution;
varying vec2 vUv;

uniform bool showCircles;
uniform int circleEccStep;

struct ColorShift {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 2 default: 0
    float severity;  // min: 0.0 max: 100.0 default: 50.0
    int cvdType;     // dropdown: (Protanomaly, Deuteranomaly, Tritanomaly)
};

struct LightEffect {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 2 default: 1
    bool autoDayNight; // min: false max: true default: false
    bool isNight; // min: false max: true default: false
    float sigmaS; // min: 0.0 max: 10.0 default: 1.0
    float sigmaL; // min: 0.0 max: 10.0 default: 1.0
    float threshold; // min: 0.0 max: 1.0 default: 0.5
    float haloSize; // min: 0.0 max: 1.0 default: 0.1
    float intensity; // min: 0.0 max: 5.0 default: 1.0
};

struct TunnelVision {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 2 default: 2
    float size; // min: 0.0 max: 110.0 default: 10.0
    float edge_smoothness; // min: 0.0 max:0.05 default: 0.02
};

// Uniform instances
uniform ColorShift colorShift;
uniform LightEffect lightEffect;
uniform TunnelVision tunnelVision;

// Utility functions
float gaussian(vec2 p, vec2 mu, float sigma) {
    vec2 diff = p - mu;
    float exponent = dot(diff, diff) / (2.0 * sigma * sigma);
    return exp(-exponent);
}

float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

bool isNight(vec3 color, LightEffect le) {
    if (!le.autoDayNight) return le.isNight;

    float l = luminance(color);
    if (l < le.threshold) {
        return true;
    } else {
        return false;
    }
}

vec2 perimetricToCartesian(vec2 perimetric) {
    float eccentricity = perimetric.x;
    float halfMeridian = perimetric.y;

    // Convert to Cartesian coordinates
    vec2 cartesian = vec2(cos(halfMeridian), sin(halfMeridian)) * (eccentricity * 0.5);

    // Rescale to [0, 1] range and center around (0.5, 0.5)
    cartesian = cartesian + 0.5;

    return cartesian;
}


vec3 applyGaussianBlur(vec2 uv, float sigma, bool mipMapping) {
    float weightSum = 0.0;
    vec3 blurredSum = vec3(0.0);

    const int LOD = 2; // Adjust as needed
    int radius = int(ceil(sigma));

    vec2 texelSize = 1.0 / uResolution.xy;
    
    for (int y = -radius; y <= radius; ++y) {
        for (int x = -radius; x <= radius; ++x) {
            vec2 offset = vec2(x, y);
            float g = gaussian(offset, vec2(0.0), sigma);
            vec2 sampleUV = clamp(uv + offset * texelSize, texelSize, 1.0 - texelSize);

            vec3 sampledColor = mipMapping
                ? textureLod(uImage, sampleUV, float(LOD)).rgb
                : texture(uImage, sampleUV).rgb;

            blurredSum += sampledColor * g;
            weightSum += g;
        }
    }

    return (weightSum > 0.0) ? blurredSum / weightSum : vec3(0.0);
}


vec3 bilateralFilter(inout vec2 uv, vec3 color, float sigma_S, float sigma_L) {
    float sigS = max(sigma_S, 1e-5);
    float sigL = max(sigma_L, 1e-5);

    float facS = -1.0 / (2.0 * sigS * sigS);
    float facL = -1.0 / (2.0 * sigL * sigL);

    float sumW = 0.0;
    vec4 sumC = vec4(0.0);
    float halfSize = 4.0;
    vec2 textureSize = 1.0 / uResolution.xy;

    float l = luminance(color.rgb);

    for (float j = -halfSize; j <= halfSize; j++) {
        for (float k = -halfSize; k <= halfSize; k++) {
            vec2 pos = vec2(j, k);
            vec4 offsetColor = textureLod(uImage, uv + pos * textureSize, 2.0);

            float distS = length(pos);
            float distL = luminance(offsetColor.rgb) - l;

            float wS = exp(facS * distS * distS);
            float wL = exp(facL * distL * distL);
            float w = wS * wL;

            sumW += w;
            sumC += offsetColor * w;
        }
    }

    return sumC.rgb / sumW;
}

// Effect functions
void applyColorShift(inout vec2 uv, inout vec4 color, ColorShift cs) {
    if (!cs.isActive) return ;

       mat3[33] matrices = mat3[33](
        // Protanomaly (type 0)
        mat3(1.000000, 0.000000, -0.000000, 0.000000, 1.000000, 0.000000, -0.000000, -0.000000, 1.000000),
        mat3(0.856167, 0.182038, -0.038205, 0.029342, 0.955115, 0.015544, -0.002880, -0.001563, 1.004443),
        mat3(0.734766, 0.334872, -0.069637, 0.051840, 0.919198, 0.028963, -0.004928, -0.004209, 1.009137),
        mat3(0.630323, 0.465641, -0.095964, 0.069181, 0.890046, 0.040773, -0.006308, -0.007724, 1.014032),
        mat3(0.539009, 0.579343, -0.118352, 0.082546, 0.866121, 0.051332, -0.007136, -0.011959, 1.019095),
        mat3(0.458064, 0.679578, -0.137642, 0.092785, 0.846313, 0.060902, -0.007494, -0.016807, 1.024301),
        mat3(0.385450, 0.769005, -0.154455, 0.100526, 0.829802, 0.069673, -0.007442, -0.022190, 1.029632),
        mat3(0.319627, 0.849633, -0.169261, 0.106241, 0.815969, 0.077790, -0.007025, -0.028051, 1.035076),
        mat3(0.259411, 0.923008, -0.182420, 0.110296, 0.804340, 0.085364, -0.006276, -0.034346, 1.040622),
        mat3(0.203876, 0.990338, -0.194214, 0.112975, 0.794542, 0.092483, -0.005222, -0.041043, 1.046265),
        mat3(0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998),
        
        // Deuteranomaly (type 1)
        mat3(1.000000, 0.000000, -0.000000, 0.000000, 1.000000, 0.000000, -0.000000, -0.000000, 1.000000),
        mat3(0.866435, 0.177704, -0.044139, 0.049567, 0.939063, 0.011370, -0.003453, 0.007233, 0.996220),
        mat3(0.760729, 0.319078, -0.079807, 0.090568, 0.889315, 0.020117, -0.006027, 0.013325, 0.992702),
        mat3(0.675425, 0.433850, -0.109275, 0.125303, 0.847755, 0.026942, -0.007950, 0.018572, 0.989378),
        mat3(0.605511, 0.528560, -0.134071, 0.155318, 0.812366, 0.032316, -0.009376, 0.023176, 0.986200),
        mat3(0.547494, 0.607765, -0.155259, 0.181692, 0.781742, 0.036566, -0.010410, 0.027275, 0.983136),
        mat3(0.498864, 0.674741, -0.173604, 0.205199, 0.754872, 0.039929, -0.011131, 0.030969, 0.980162),
        mat3(0.457771, 0.731899, -0.189670, 0.226409, 0.731012, 0.042579, -0.011595, 0.034333, 0.977261),
        mat3(0.422823, 0.781057, -0.203881, 0.245752, 0.709602, 0.044646, -0.011843, 0.037423, 0.974421),
        mat3(0.392952, 0.823610, -0.216562, 0.263559, 0.690210, 0.046232, -0.011910, 0.040281, 0.971630),
        mat3(0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881),
        
        // Tritanomaly (type 2)
        mat3(1.000000, 0.000000, -0.000000, 0.000000, 1.000000, 0.000000, -0.000000, -0.000000, 1.000000),
        mat3(0.926670, 0.092514, -0.019184, 0.021191, 0.964503, 0.014306, 0.008437, 0.054813, 0.936750),
        mat3(0.895720, 0.133330, -0.029050, 0.029997, 0.945400, 0.024603, 0.013027, 0.104707, 0.882266),
        mat3(0.905871, 0.127791, -0.033662, 0.026856, 0.941251, 0.031893, 0.013410, 0.148296, 0.838294),
        mat3(0.948035, 0.089490, -0.037526, 0.014364, 0.946792, 0.038844, 0.010853, 0.193991, 0.795156),
        mat3(1.017277, 0.027029, -0.044306, -0.006113, 0.958479, 0.047634, 0.006379, 0.248708, 0.744913),
        mat3(1.104996, -0.046633, -0.058363, -0.032137, 0.971635, 0.060503, 0.001336, 0.317922, 0.680742),
        mat3(1.193214, -0.109812, -0.083402, -0.058496, 0.979410, 0.079086, -0.002346, 0.403492, 0.598854),
        mat3(1.257728, -0.139648, -0.118081, -0.078003, 0.975409, 0.102594, -0.003316, 0.501214, 0.502102),
        mat3(1.278864, -0.125333, -0.153531, -0.084748, 0.957674, 0.127074, -0.000989, 0.601151, 0.399838),
        mat3(1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900)
    );
    
    // Linearize sRGB
    vec3 lin = color.rgb / 255.0;
    lin = mix(lin / 12.92, pow((lin + 0.055) / 1.055, vec3(2.4)), step(0.04045, lin));
    
    int type_offset = cs.cvdType * 11;
    if (cs.severity == 100.0) {
        mat3 m = matrices[type_offset + 10];
        lin = m * lin;
    } else {
        int step = int(cs.severity / 10.0);
        int nextstep = min(10, step + 1);
        float weight = mod(cs.severity, 10.0) / 10.0;
        
        mat3 m1 = matrices[type_offset + step];
        mat3 m2 = matrices[type_offset + nextstep];
        mat3 m = m1 * (1.0 - weight) + m2 * weight;
        lin = m * lin;
    }
    
    // Gamma correction
    lin = mix(lin * 12.92, pow(lin, vec3(1.0/2.4)) * 1.055 - 0.055, step(0.0031308, lin));
    
    // Return color in 0-255 range
    color.rgb =  clamp(lin, 0.0, 1.0) * 255.0;
}

vec3 dayEffect(inout vec2 uv, vec3 color, LightEffect le) {
    vec3 baseColor = color.rgb;
    float l = luminance(baseColor);

    // Extract bright areas
    vec3 highlight = l > le.threshold ? baseColor : vec3(0.0);

    // Apply Gaussian blur to the bright areas to create a halo
    vec3 halo = applyGaussianBlur(uv, le.haloSize, true) * highlight;

    // Sample from lower MIP levels to simulate blur
    vec3 mip1 = textureLod(uImage, uv, 1.0).rgb;
    vec3 mip2 = textureLod(uImage, uv, 2.0).rgb;
    vec3 mip3 = textureLod(uImage, uv, 3.0).rgb;

    // Combine halo with mip levels
    vec3 bloom = halo * 0.4 + mip1 * 0.3 + mip2 * 0.2 + mip3 * 0.1;

    // Add bloom to final color
    return baseColor + bloom * le.intensity;
}

float applyThreshold(float value, float threshold) {
    return value > threshold ? 1.0 : 0.0;
}

vec3 nightEffect(vec2 uv, vec3 color, LightEffect le) {
    // Convert to grayscale
    float gray = luminance(color);

    // Apply threshold to identify bright areas
    float lightAreas = applyThreshold(gray, le.threshold);

    vec3 halo = vec3(lightAreas);
    vec3 blurredHalo = applyGaussianBlur(uv, le.haloSize, false);

    // Weighted addition of the original image and the halo
    vec3 darkened = mix(color * 0.3, blurredHalo, 1.0);

    // Apply final Gaussian blur to the entire image
    vec3 finalBlur = applyGaussianBlur(uv, 3.0, false);

    return finalBlur;
}

void applyLightEffect(inout vec2 uv, inout vec4 color, LightEffect le) {
     if (!le.isActive) return;

     bool isNight = isNight(color.rgb, le);

    if (isNight) {
        color.rgb = nightEffect(uv, color.rgb, le);
    } else {
        color.rgb = dayEffect(uv, color.rgb, le);
    }

    // Apply bilateral filter to smooth the image while preserving edges
    vec3 flat_color = bilateralFilter(uv, color.rgb, le.sigmaS, le.sigmaL);

    // add two colors
    color.rgb = mix(color.rgb, flat_color, 0.5);
}

// Function to get the average color of the screen
vec3 getScreenAverageColor(vec2 texelSize, sampler2D tex) {
    vec3 sum = vec3(0.0);
    int sampleCount = 0;

    const int gridSize = 4;

    for (int y = 0; y < gridSize; ++y) {
        for (int x = 0; x < gridSize; ++x) {
            vec2 uv = vec2((float(x) + 0.5) / float(gridSize), (float(y) + 0.5) / float(gridSize));
            sum += textureLod(tex, uv, 1.0).rgb;
            sampleCount++;
        }
    }

    return sum / float(sampleCount);
}

// Helper function to generate random noise
float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void applyTunnelVision(inout vec2 uv, inout vec4 color, TunnelVision tv) {
    if (!tv.isActive) return;

    vec3 originalColor = color.rgb;
    vec2 center = vec2(0.5, 0.5);

    // Compute screen-space radius from center corresponding to `tv.size` degrees
    float angleInRadians = radians(tv.size);
    vec2 boundaryPoint = perimetricToCartesian(vec2(angleInRadians, 0.0));
    float tunnelRadius = distance(center, boundaryPoint);

    vec2 aspectCorrectedUV = uv - 0.5;
    aspectCorrectedUV.x *= uResolution.x / uResolution.y;
    aspectCorrectedUV += 0.5;

    // Get current fragment’s distance from center (no aspect correction)
    float dist = distance(aspectCorrectedUV, center);

    // Smooth blend from visible to static outside radius
    float edgeStart = tunnelRadius - tv.edge_smoothness * 0.5;
    float edgeEnd = tunnelRadius + tv.edge_smoothness * 0.5;
    float staticFactor = smoothstep(edgeStart, edgeEnd, dist);

    // Static effect based on average center color + noise
    vec3 centerColor = getScreenAverageColor(1.0 / uResolution, uImage);
    float noise = rand(uv * 10.0);
    vec3 staticColor = centerColor * noise;

    // Blend
    color = vec4(mix(originalColor, staticColor, staticFactor), 1.0);
}

void main() {

    struct Effect {
        int order;
        int type;
    };

    Effect effects[3] = Effect[3](
        Effect(colorShift.order, 0),
        Effect(lightEffect.order, 1),
        Effect(tunnelVision.order, 2)
    );

    for (int i = 0; i < 3; i++) {
        for (int j = i + 1; j < 3; j++) {
            if (effects[i].order > effects[j].order) {
                Effect temp = effects[i];
                effects[i] = effects[j];
                effects[j] = temp;
            }
        }
    }

    vec2 uv = vUv;
    vec4 color = texture2D(uImage, uv);


    for (int i = 0; i <= 2; i++) {
        int effectType = effects[i].type;

        if (effectType == 0) {    
            applyColorShift(uv, color, colorShift);            
        }
        else if (effectType == 1) {
            applyLightEffect(uv, color, lightEffect);
        }
        else if (effectType == 2) {
            applyTunnelVision(uv, color, tunnelVision);
        }
    }

    if (showCircles) {
        // Define the center of the screen in normalized UV coordinates
        vec2 center = vec2(0.5, 0.5);
        int circleAngleStep = 1;

        // Loop through desired eccentricities (in degrees)
        for (int eccDeg = 0; eccDeg <= 110; eccDeg += circleEccStep) {
            float ecc = radians(float(eccDeg)); // convert eccentricity to radians

            // Loop around the circle (0 to 360 degrees)
            for (int angle = 0; angle < 360; angle += circleAngleStep) {
                float radiansAngle = radians(float(angle));

                // Convert polar coords (eccentricity, angle) to Cartesian
                vec2 perimetricCoords = vec2(ecc, radiansAngle);
                vec2 point = perimetricToCartesian(perimetricCoords);

                // Correct the UV for the aspect ratio dynamically
                vec2 aspectCorrectedUV = uv - 0.5;
                aspectCorrectedUV.x *= uResolution.x / uResolution.y;
                aspectCorrectedUV += 0.5;

                // Calculate the distance from the current fragment to the circle point
                float dist = distance(aspectCorrectedUV, point);

                // Thickness of the circle outline
                float thickness = 0.002;

                // Draw the circle line if within thickness
                if (dist < thickness) {
                    color.rgb = vec3(0.0, 0.0, 0.0); // black
                }
            }
        }
    }

    gl_FragColor = color;
}
