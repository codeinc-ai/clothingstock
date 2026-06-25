import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set for Backblaze B2 object storage.`);
  }
  return value;
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: getEnv("B2_REGION"),
    endpoint: getEnv("B2_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: getEnv("B2_KEY_ID"),
      secretAccessKey: getEnv("B2_APP_KEY"),
    },
  });
  return client;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100) || "file";
}

function buildPublicUrl(bucket: string, key: string): string {
  const base = process.env.B2_PUBLIC_BASE_URL;
  if (base) {
    return `${base.replace(/\/+$/, "")}/${key}`;
  }
  const endpoint = getEnv("B2_ENDPOINT").replace(/\/+$/, "");
  return `${endpoint}/${bucket}/${key}`;
}

export interface UploadTarget {
  /** Presigned PUT URL the client uploads the file to. */
  uploadURL: string;
  /** Public URL where the uploaded file is served from (stored as imageUrl). */
  publicUrl: string;
  key: string;
}

/**
 * Generate a presigned PUT URL for a new object plus the public URL it will be
 * served from. The bucket must be public for the returned URL to be readable.
 */
export async function createUploadTarget(name: string): Promise<UploadTarget> {
  const bucket = getEnv("B2_BUCKET");
  const key = `uploads/${randomUUID()}-${sanitizeName(name)}`;

  // Content-Type is intentionally not part of the signed command so the browser
  // can send its own Content-Type header without breaking the signature.
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  const uploadURL = await getSignedUrl(getClient(), command, { expiresIn: 900 });

  return {
    uploadURL,
    publicUrl: buildPublicUrl(bucket, key),
    key,
  };
}
