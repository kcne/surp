import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  CORS_ALLOWED_ORIGINS: Joi.string().optional(),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  JWT_ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().positive().default(900),
  JWT_REFRESH_TOKEN_TTL_SECONDS: Joi.number().integer().positive().default(1209600),
  AWS_ENDPOINT_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  AWS_DEFAULT_REGION: Joi.string().default('us-east-1'),
  AWS_S3_BUCKET_NAME: Joi.string().min(1).required(),
  AWS_ACCESS_KEY_ID: Joi.string().min(1).required(),
  AWS_SECRET_ACCESS_KEY: Joi.string().min(1).required(),
  TICKETS_MAX_IMAGE_BYTES: Joi.number().integer().positive().default(5242880),
  TICKETS_UPLOAD_URL_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(600),
  TICKETS_DOWNLOAD_URL_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(600),
  STOREFRONT_MAX_IMAGE_BYTES: Joi.number().integer().positive().default(1048576),
  STOREFRONT_UPLOAD_URL_TTL_SECONDS: Joi.number().integer().min(60).max(3600).default(600),
  RESEND_API_KEY: Joi.string().trim().min(1).optional(),
  RESEND_FROM: Joi.string().trim().min(1).optional(),
  EMAIL_TIMEOUT_MS: Joi.number().integer().min(1000).max(60000).default(10000),
  INVARIANT_SCHEDULE_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  BACKUP_FRESHNESS_CHECK_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  // Backup storage only exists in production. Elsewhere these variables are
  // absent or, when a Railway reference points at a removed service, empty, and
  // both mean "not configured"; the freshness check reports that at runtime.
  // The backup key travels on every signed GetObject, so production must not
  // reach the bucket over plain HTTP. Local stacks (MinIO, LocalStack) still can.
  BACKUP_S3_ENDPOINT: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().empty('').uri({ scheme: ['https'] }).optional(),
    otherwise: Joi.string().empty('').uri({ scheme: ['http', 'https'] }).optional()
  }),
  BACKUP_S3_REGION: Joi.string().trim().empty('').default('auto'),
  BACKUP_S3_BUCKET: Joi.string().trim().empty('').optional(),
  BACKUP_S3_ACCESS_KEY_ID: Joi.string().trim().empty('').optional(),
  BACKUP_S3_SECRET_ACCESS_KEY: Joi.string().trim().empty('').optional(),
  MARKETING_EMAIL_LOGO_URL: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
  MARKETING_LEADS_EMAIL_TO: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().optional()
  }),
  // Set by Railway at deploy time; empty or absent locally and in tests.
  RAILWAY_GIT_COMMIT_SHA: Joi.string().trim().empty('').optional(),
  SANDBOX_RESET_TOKEN: Joi.string().trim().min(32).optional(),
  SANDBOX_DEMO_PASSWORD: Joi.string().trim().min(8).optional()
});
