import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadToCloudinary(
  fileBase64: string,
  folder: string
): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(fileBase64, {
    folder: `campus-management/${folder}`,
    resource_type: "auto",
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function uploadRawToCloudinary(
  fileBase64: string,
  folder: string
): Promise<{ url: string; publicId: string }> {
  const result = await cloudinary.uploader.upload(fileBase64, {
    folder: `campus-management/${folder}`,
    resource_type: "raw",
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteFromCloudinary(publicId: string) {
  await cloudinary.uploader.destroy(publicId);
}

export async function deleteRawFromCloudinary(publicId: string) {
  await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
}

export default cloudinary;
