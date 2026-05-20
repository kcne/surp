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
  SMTP_HOST: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().hostname().required(),
    otherwise: Joi.string().hostname().optional()
  }),
  SMTP_PORT: Joi.number().port().default(465),
  SMTP_SECURE: Joi.boolean().default(true),
  SMTP_USER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().trim().min(1).optional()
  }),
  SMTP_PASSWORD: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().min(1).optional()
  }),
  SMTP_FROM: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().trim().min(1).optional()
  }),
  MARKETING_LEADS_EMAIL_TO: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().optional()
  }),
  SANDBOX_RESET_TOKEN: Joi.string().trim().min(32).optional(),
  SANDBOX_DEMO_PASSWORD: Joi.string().trim().min(8).optional()
});
