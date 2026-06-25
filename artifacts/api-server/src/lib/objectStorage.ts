import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
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

export interface UploadTarget {
  /** Presigned PUT URL the client uploads the file to. */
  uploadURL: string;
  /** Stable object key stored with the article (e.g. uploads/<uuid>-name.jpg). */
  key: string;
}

/**
 * Generate a presigned PUT URL for a new object plus the stable object key.
 * Works with a PRIVATE bucket — reads are served later via presigned GET URLs.
 */
export async function createUploadTarget(name: string): Promise<UploadTarget> {
  const bucket = getEnv("B2_BUCKET");
  const key = `uploads/${randomUUID()}-${sanitizeName(name)}`;

  // Content-Type is intentionally not part of the signed command so the browser
  // can send its own Content-Type header without breaking the signature.
  const command = new PutObjectCommand({ Bucket: bucket, Key: key });
  const uploadURL = await getSignedUrl(getClient(), command, { expiresIn: 900 });

  return { uploadURL, key };
}

/**
 * Generate a short-lived presigned GET URL to read a private object.
 */
export async function createDownloadUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  const bucket = getEnv("B2_BUCKET");
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getClient(), command, { expiresIn });
}
