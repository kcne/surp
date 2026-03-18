import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class TicketStorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('AWS_ENDPOINT_URL');
    const region = this.configService.get<string>('AWS_DEFAULT_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET_NAME', '');

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      throw new Error('Storage configuration is incomplete');
    }

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: false,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });
  }

  async createUploadUrl(
    storageKey: string,
    mimeType: string,
    expiresInSeconds: number
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: mimeType
      });

      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch {
      throw new InternalServerErrorException('Unable to generate upload URL');
    }
  }

  async createDownloadUrl(storageKey: string, expiresInSeconds: number): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      });

      return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    } catch {
      throw new InternalServerErrorException('Unable to generate download URL');
    }
  }

  async objectExists(storageKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey
        })
      );

      return true;
    } catch {
      return false;
    }
  }
}
