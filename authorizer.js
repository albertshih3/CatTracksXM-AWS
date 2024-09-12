const jwt = require('jsonwebtoken');
const jwkPem = require('jwk-to-pem');

const key = {
    "kid": "51482e35-592c-4cc2-9d7f-5ad94e39bb04",
    "kty": "RSA",
    "n": "1lCVdTRNZE0iLV4WYC5k3g_leVCSIevl87z2ciRuGGIOhX2_UnGVcVcivwnKhf37z43R337lUY0eu_A_EXWGh5v3Iezjh0EZANM4Jc_B4ynVfzfh19ypVgSB8BsPmOtQlrfhedwkDsm3P92rWwJZ_7Yb_rZyG_Y0v5-1U1R3Kp1BVebYMDhljDpbpTIVA_6Yxocay26j-4meHvqtWW0R3VPGftadGSur7-lf6RNlS11DKAZFFb-jbYpwnW8FkFqp-DdqRs67ra8X0hTeAoTwQYTBGTl3O6QzrLe6BmhkeUuFW6RQvLYpfCXTc4bex4mous1YPcdboCDnrCtCQMFNyw",
    "e": "AQAB"
};

function getPayload(headerVal) {
    let payload = null;
    payload = jwt.verify(headerVal.replace("Bearer ", ""), jwkPem(key));
    return payload;
}

module.exports.getPayload = getPayload;