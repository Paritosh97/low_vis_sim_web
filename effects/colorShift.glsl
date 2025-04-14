precision highp float;

uniform sampler2D uImage;
uniform float uSeverity;  // min: 0.0 max: 1.0 default: 0.5
uniform int uCVDType;     // dropdown: (Protanomaly, Deuteranomaly, Tritanomaly)

varying vec2 vUv;

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

mat3 interpolate(mat3 a, mat3 b, float t) {
    return mat3(
        mix(a[0][0], b[0][0], t), mix(a[0][1], b[0][1], t), mix(a[0][2], b[0][2], t),
        mix(a[1][0], b[1][0], t), mix(a[1][1], b[1][1], t), mix(a[1][2], b[1][2], t),
        mix(a[2][0], b[2][0], t), mix(a[2][1], b[2][1], t), mix(a[2][2], b[2][2], t)
    );
}


void main() {
    vec4 color = texture2D(uImage, vUv);
    
    float scaled = uSeverity * 10.0;
    int lowLevel = int(floor(scaled));
    int highLevel = min(lowLevel + 1, 10);
    float t = fract(scaled);

    mat3 lowMat = getCVDMatrix(uCVDType, lowLevel);
    mat3 highMat = getCVDMatrix(uCVDType, highLevel);
    
    mat3 cvd = interpolate(lowMat, highMat, t);

    gl_FragColor = vec4(cvd * color.rgb, color.a);
}