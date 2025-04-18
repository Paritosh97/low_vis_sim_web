precision highp float;

// Common uniforms
uniform sampler2D uImage;
uniform vec2 uResolution;
varying vec2 vUv;

struct ColorShift {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 0
    float severity;  // min: 0.0 max: 1.0 default: 0.5
    int cvdType;     // dropdown: (Protanomaly, Deuteranomaly, Tritanomaly)
};

struct ContrastChange {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 1
    float horizontalScale; // min: 0.0 max: 2.0 default: 1.0
    float verticalScale;   // min: 0.0 max: 2.0 default: 1.0
};

struct FovReduction {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 2
    float threshold; // min: 0.0 max: 1.0 default: 0.5
};

struct Infilling {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 3
    float infillX; // min: -1.0 max: 1.0 default: 0.0
    float infillY; // min: 0.0 max: 3.1415 default: 0.0
    float infillSize; // min: 0.001 max: 1.0 default: 0.2
};

struct LightDegradation {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 4
    vec4 kernels[16]; // min: (-1.0, 0.0, 0.0, 0.0) max: (1.0, 3.1415, 0.5, 1.0) default: (0.0, 0.5, 0.05, 0.25)
};

struct RotationDistortion {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 5
    vec2 centers[3]; // min: (-1.0, 0.0) max: (1.0, 3.1415) default: (0.0, 0.0)
    float sigmas[3]; // min: 0.001 max: 1.0 default: 0.5
    float weights[3]; // min: 0.0 max: 1.0 default: 0.5
};

struct SpatialDistortion {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 6
    vec2 centers[3]; // min: (-1.0, 0.0) max: (1.0, 3.1415) default: (0.0, 0.0)
    float sigmas[3]; // min: 0.001 max: 1.0 default: 0.5
    float weights[3]; // min: 0.0 max: 1.0 default: 0.5
};

struct VisualAcuityLoss {
    bool isActive;  // min: false max: true default: false
    int order;  // min: 0 max: 7 default: 7
    vec4 kernels[16]; // min: (-1.0, 0.0, 0.001, 0.0) max: (1.0, 3.1415, 0.5, 1.0) default: (0.0, 0.0, 0.1, 0.1)
};

// Uniform instances
uniform ColorShift colorShift;
uniform ContrastChange contrastChange;
uniform FovReduction fovReduction;
uniform Infilling infilling;
uniform LightDegradation lightDegradation;
uniform RotationDistortion rotationDistortion;
uniform SpatialDistortion spatialDistortion;
uniform VisualAcuityLoss visualAcuityLoss;

// Utility functions
float gaussian(vec2 p, vec2 mu, float sigma) {
    vec2 diff = p - mu;
    float exponent = dot(diff, diff) / (2.0 * sigma * sigma);
    return exp(-exponent);
}

vec2 rotate(vec2 p, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
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

mat3 getProtanomalyMatrix(int level) {
    if (level == 0) return mat3(1.0);
    else if (level == 1) return mat3(0.856167, 0.182038, -0.038205, 0.029342, 0.955115, 0.015544, -0.002880, -0.001563, 1.004443);
    else if (level == 2) return mat3(0.734766, 0.334872, -0.069637, 0.051840, 0.919198, 0.028963, -0.004928, -0.004209, 1.009137);
    else if (level == 3) return mat3(0.630323, 0.465641, -0.095964, 0.069181, 0.890046, 0.040773, -0.006308, -0.006308, 1.012616);
    else if (level == 4) return mat3(0.539009, 0.579343, -0.118352, 0.082546, 0.866121, 0.051332, -0.007136, -0.007870, 1.015006);
    else if (level == 5) return mat3(0.458064, 0.679578, -0.137642, 0.092785, 0.846313, 0.060902, -0.007494, -0.008957, 1.016451);
    else if (level == 6) return mat3(0.385450, 0.769005, -0.154455, 0.100526, 0.829802, 0.069673, -0.007442, -0.009598, 1.017040);
    else if (level == 7) return mat3(0.319627, 0.849633, -0.169261, 0.106241, 0.815969, 0.077790, -0.007025, -0.009930, 1.016954);
    else if (level == 8) return mat3(0.259411, 0.923008, -0.182420, 0.110296, 0.804340, 0.085364, -0.006276, -0.010004, 1.016280);
    else if (level == 9) return mat3(0.203876, 0.990338, -0.194214, 0.112975, 0.794542, 0.092483, -0.005222, -0.009884, 1.015106);
    else return mat3(0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.009383, 1.013264);
}

mat3 getDeuteranomalyMatrix(int level) {
    if (level == 0) return mat3(1.0);
    else if (level == 1) return mat3(0.866435, 0.177704, -0.044139, 0.049567, 0.939063, 0.011370, -0.003453, 0.007233, 0.996220);
    else if (level == 2) return mat3(0.760729, 0.319078, -0.079807, 0.090568, 0.889315, 0.020117, -0.006027, 0.013325, 0.992702);
    else if (level == 3) return mat3(0.675425, 0.433850, -0.109275, 0.125303, 0.847755, 0.026942, -0.007950, 0.018572, 0.989378);
    else if (level == 4) return mat3(0.605511, 0.528560, -0.134071, 0.155318, 0.812366, 0.032316, -0.009376, 0.023176, 0.986200);
    else if (level == 5) return mat3(0.547494, 0.607765, -0.155259, 0.181692, 0.781742, 0.036566, -0.010410, 0.027275, 0.983136);
    else if (level == 6) return mat3(0.498864, 0.674741, -0.173604, 0.205199, 0.754872, 0.039929, -0.011131, 0.030969, 0.980162);
    else if (level == 7) return mat3(0.457771, 0.731899, -0.189670, 0.226409, 0.731012, 0.042579, -0.011595, 0.034333, 0.977261);
    else if (level == 8) return mat3(0.422823, 0.781057, -0.203881, 0.245752, 0.709602, 0.044646, -0.011843, 0.037423, 0.974421);
    else if (level == 9) return mat3(0.392952, 0.823610, -0.216562, 0.263559, 0.690210, 0.046232, -0.011910, 0.040281, 0.971630);
    else return mat3(0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881);
}

mat3 getTritanomalyMatrix(int level) {
    if (level == 0) return mat3(1.0);
    else if (level == 1) return mat3(0.926670, 0.092514, -0.019184, 0.021191, 0.964503, 0.014306, 0.008437, 0.054813, 0.936750);
    else if (level == 2) return mat3(0.895720, 0.133330, -0.029050, 0.029997, 0.945400, 0.024603, 0.013027, 0.104707, 0.882266);
    else if (level == 3) return mat3(0.905871, 0.127791, -0.033662, 0.026856, 0.941251, 0.031893, 0.013410, 0.148296, 0.838294);
    else if (level == 4) return mat3(0.948035, 0.089490, -0.037526, 0.014364, 0.946792, 0.038844, 0.010853, 0.193991, 0.795156);
    else if (level == 5) return mat3(1.017277, 0.027029, -0.044306, -0.006113, 0.958479, 0.047634, 0.006379, 0.248708, 0.744913);
    else if (level == 6) return mat3(1.104996, -0.046633, -0.058363, -0.032137, 0.971635, 0.060502, 0.001336, 0.317922, 0.680742);
    else if (level == 7) return mat3(1.193214, -0.109812, -0.083402, -0.058496, 0.979410, 0.079086, -0.002346, 0.403492, 0.598854);
    else if (level == 8) return mat3(1.257728, -0.139648, -0.118081, -0.078003, 0.975409, 0.102594, -0.003316, 0.501214, 0.502102);
    else if (level == 9) return mat3(1.278864, -0.125333, -0.153531, -0.084748, 0.957674, 0.127074, -0.000989, 0.601151, 0.399838);
    else return mat3(1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900);
}

mat3 getCVDMatrix(int type, int level) {
    if (type == 0) return getProtanomalyMatrix(level);
    else if (type == 1) return getDeuteranomalyMatrix(level);
    else return getTritanomalyMatrix(level);
}

// Effect functions
vec4 applySpatialDistortion(vec4 color, SpatialDistortion sd) {
    if (!sd.isActive) return color;
    vec2 uv = vUv;
    for (int i = 0; i < 3; ++i) {
        vec2 center = sd.centers[i];
        center = perimetricToCartesian(center);
        float sigma = sd.sigmas[i];
        float weight = sd.weights[i];
        float falloff = gaussian(uv, center, sigma);
        uv += weight * falloff * (uv - center);
    }
    return texture2D(uImage, uv);
}

vec4 applyRotationDistortion(vec4 color, RotationDistortion rd) {
    if (!rd.isActive) return color;
    vec2 uv = vUv;
    vec2 p = uv * uResolution;
    vec2 rotatedP = p;
    for (int i = 0; i < 3; ++i) {
        vec2 center = rd.centers[i];
        center = perimetricToCartesian(center);
        float sigma = rd.sigmas[i];
        float weight = rd.weights[i];
        float falloff = gaussian(p, center, sigma);
        float angle = weight * falloff;
        vec2 relativeP = p - center;
        vec2 rotated = rotate(relativeP, angle) + center;
        rotatedP += (rotated - p);
    }
    uv = rotatedP / uResolution;
    return texture2D(uImage, uv);
}

vec4 applyFovReduction(vec4 color, FovReduction fr) {
    if (!fr.isActive) return color;
    vec2 uv = vUv;
    vec2 center = vec2(0.5, 0.5);
    float maxZoom = 4.0;
    float zoom = mix(1.0, maxZoom, fr.threshold);
    uv = mix(center, uv, 1.0 / zoom);
    return texture2D(uImage, uv);
}

vec4 applyInfilling(vec4 color, Infilling inf) {
    if (!inf.isActive) return color;
    vec2 uv = vUv;
    vec2 center = vec2(inf.infillX, inf.infillY);
    center = perimetricToCartesian(center);
    float dist = distance(uv, center);
    if (dist <= inf.infillSize) {
        vec2 texel = vec2(1.0) / uResolution;
        float delta = inf.infillSize * min(uResolution.x, uResolution.y);
        vec2 offset = vec2(delta) * texel;

        vec3 up = texture2D(uImage, center + vec2(0.0, offset.y)).rgb;
        vec3 right = texture2D(uImage, center + vec2(offset.x, 0.0)).rgb;
        vec3 down = texture2D(uImage, center - vec2(0.0, offset.y)).rgb;
        vec3 left = texture2D(uImage, center - vec2(offset.x, 0.0)).rgb;

        float d1 = offset.y, d2 = offset.x, d3 = offset.y, d4 = offset.x;
        float w1 = 1.0 / (d1 * d1 + 1e-6);
        float w2 = 1.0 / (d2 * d2 + 1e-6);
        float w3 = 1.0 / (d3 * d3 + 1e-6);
        float w4 = 1.0 / (d4 * d4 + 1e-6);
        float wSum = w1 + w2 + w3 + w4;

        color.rgb = (up*w1 + right*w2 + down*w3 + left*w4) / wSum;
    }
    return color;
}

vec4 applyVisualAcuityLoss(vec4 color, VisualAcuityLoss val) {
    if (!val.isActive) return color;
    vec2 uv = vUv;
    uv = perimetricToCartesian(uv);
    vec3 blurredColor = vec3(0.0);
    float totalWeight = 0.0;
    for (int i = 0; i < 16; ++i) {
        vec4 kernel = val.kernels[i];
        vec2 mu = vec2(kernel.x, kernel.y);
        float sigma = kernel.z;
        float omega = kernel.w;
        float weight = gaussian(uv, mu, sigma);
        blurredColor += omega * weight * texture2D(uImage, uv + mu).rgb;
        totalWeight += omega * weight;
    }
    if (totalWeight > 0.0) {
        color.rgb = blurredColor / totalWeight;
    }
    return color;
}

vec4 applyColorShift(vec4 color, ColorShift cs) {
    if (!cs.isActive) return color;
    float scaled = cs.severity * 10.0;
    int lowLevel = int(floor(scaled));
    int highLevel = min(lowLevel + 1, 10);
    float t = fract(scaled);
    mat3 lowMat = getCVDMatrix(cs.cvdType, lowLevel);
    mat3 highMat = getCVDMatrix(cs.cvdType, highLevel);
    mat3 cvd = mat3(
        mix(lowMat[0], highMat[0], t),
        mix(lowMat[1], highMat[1], t),
        mix(lowMat[2], highMat[2], t)
    );
    color.rgb = cvd * color.rgb;
    return color;
}

vec4 applyContrastChange(vec4 color, ContrastChange cc) {
    if (!cc.isActive) return color;
    color.rgb *= vec3(cc.horizontalScale, cc.verticalScale, 1.0);
    return color;
}

vec4 applyLightDegradation(vec4 color, LightDegradation ld) {
    if (!ld.isActive) return color;
    vec2 uv = vUv;
    float degradation = 0.0;
    for (int i = 0; i < 16; ++i) {
        vec4 kernel = ld.kernels[i];
        vec2 mu = vec2(kernel.x, kernel.y);
        mu = perimetricToCartesian(mu);
        float sigma = kernel.z;
        float omega = kernel.w;
        degradation += omega * gaussian(uv, mu, sigma);
    }
    color.rgb = mix(color.rgb, vec3(0.0), clamp(degradation, 0.0, 1.0));
    return color;
}

void main() {
    vec2 uv = vUv;
    vec4 color = texture2D(uImage, uv);

    struct Effect {
        int order;
        int type;
    };

    Effect effects[8] = Effect[8](
        Effect(colorShift.order, 0),
        Effect(contrastChange.order, 1),
        Effect(fovReduction.order, 2),
        Effect(infilling.order, 3),
        Effect(lightDegradation.order, 4),
        Effect(rotationDistortion.order, 5),
        Effect(spatialDistortion.order, 6),
        Effect(visualAcuityLoss.order, 7)
    );

    for (int i = 0; i < 8; i++) {
        for (int j = i + 1; j < 8; j++) {
            if (effects[i].order > effects[j].order) {
                Effect temp = effects[i];
                effects[i] = effects[j];
                effects[j] = temp;
            }
        }
    }

    for (int i = 0; i < 8; i++) {
        int effectType = effects[i].type;

        if (effectType == 0) {
            color = applyColorShift(color, colorShift);
        } 
        else if (effectType == 1) {
            color = applyContrastChange(color, contrastChange);
        }
        else if (effectType == 2) {
            color = applyFovReduction(color, fovReduction);
        }
        else if (effectType == 3) {
            color = applyInfilling(color, infilling);
        }
        else if (effectType == 4) {
            color = applyLightDegradation(color, lightDegradation);
        }
        else if (effectType == 5) {
            color = applyRotationDistortion(color, rotationDistortion);
        }
        else if (effectType == 6) {
            color = applySpatialDistortion(color, spatialDistortion);
        }
        else if (effectType == 7) {
            color = applyVisualAcuityLoss(color, visualAcuityLoss);
        }
    }

    gl_FragColor = color;
}
