const axios = require('axios');
const FormData = require('form-data');
const dotenv = require('dotenv')

dotenv.config()

const pinataConfig = {
    pinataJWT: process.env.PINATA_JWT,
    pinataGatewayUrl: 'https://gateway.pinata.cloud/ipfs/',
    groupId: process.env.PINATA_GROUP_ID
};

// Validate configuration
function validatePinataConfig() {
    if (!pinataConfig.pinataJWT) {
        throw new Error('Pinata JWT token is not configured');
    }
    if (!pinataConfig.groupId) {
        throw new Error('Pinata group ID is not configured');
    }
}

async function uploadToPinata(fileBuffer, fileName) {
    try {
        validatePinataConfig();

        const formData = new FormData();
        formData.append('file', fileBuffer, {
            filename: fileName
        });

        // Add metadata for private group
        const metadata = JSON.stringify({
            name: fileName,
            keyvalues: {
                app: "mingle-chat",
                type: "chat-file",
                uploadDate: new Date().toISOString()
            },
            pinataGroup: pinataConfig.groupId
        });
        formData.append('pinataMetadata', metadata);

        // Configure private options
        const options = JSON.stringify({
            cidVersion: 1,
            wrapWithDirectory: false,
            pinataGroup: pinataConfig.groupId
        });
        formData.append('pinataOptions', options);

        const response = await axios.post(
            'https://api.pinata.cloud/pinning/pinFileToIPFS',
            formData,
            {
                maxBodyLength: Infinity,
                headers: {
                    'Authorization': `Bearer ${pinataConfig.pinataJWT}`
                }
            }
        );

        return {
            success: true,
            ipfsHash: response.data.IpfsHash,
            url: `${pinataConfig.pinataGatewayUrl}${response.data.IpfsHash}?pinataGateway=true`
        };
    } catch (error) {
        console.error('Pinata upload error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    pinataConfig,
    uploadToPinata
}; 