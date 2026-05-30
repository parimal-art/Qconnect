const fs = require('fs/promises');
const cloudinary = require('cloudinary').v2;
const env = require('./env');

const hasCloudinaryCredentials = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

if (hasCloudinaryCredentials) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret
  });
}

const isCloudinaryEnabled = hasCloudinaryCredentials;

const uploadBuffer = (buffer, options) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });

    stream.end(buffer);
  });

const cleanupLocalFile = async filePath => {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => {});
};

const uploadToCloudinary = async (file, folder = 'crm-employee-tracker/employee-documents') => {
  if (!file) return null;

  if (!isCloudinaryEnabled) {
    if (file.filename) {
      return {
        secureUrl: `/uploads/${file.filename}`,
        publicId: null,
        resourceType: 'local',
        bytes: file.size || 0,
        format: file.mimetype
      };
    }

    throw new Error('Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in server/.env.');
  }

  const options = {
    folder,
    resource_type: 'auto',
    use_filename: true,
    unique_filename: true,
    overwrite: false
  };

  let result;

  if (file.path) {
    result = await cloudinary.uploader.upload(file.path, options);
    await cleanupLocalFile(file.path);
  } else if (file.buffer) {
    result = await uploadBuffer(file.buffer, options);
  } else {
    throw new Error('Uploaded file is missing both path and buffer.');
  }

  return {
    secureUrl: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    bytes: result.bytes,
    format: result.format
  };
};

module.exports = {
  cloudinary,
  isCloudinaryEnabled,
  uploadToCloudinary
};
