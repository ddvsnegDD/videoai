import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'https://storage.yandexcloud.net';
const S3_REGION = process.env.S3_REGION || 'ru-central1';
const S3_BUCKET = process.env.S3_BUCKET || 'videoai-media';

let client = null;

function getClient() {
  if (client) return client;

  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3_ACCESS_KEY and S3_SECRET_KEY must be set');
  }

  client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return client;
}

export async function uploadBuffer({ buffer, key, contentType }) {
  const s3 = getClient();

  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return `https://${S3_BUCKET}.storage.yandexcloud.net/${key}`;
}

export async function deleteByPrefix(prefix) {
  const s3 = getClient();

  const listed = await s3.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
  }));

  if (!listed.Contents || listed.Contents.length === 0) return;

  await s3.send(new DeleteObjectsCommand({
    Bucket: S3_BUCKET,
    Delete: {
      Objects: listed.Contents.map(obj => ({ Key: obj.Key })),
    },
  }));
}
