export type RateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type Bindings = {
  ALBUM_ACCESS_SECRET: string;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET: string;
  DB: D1Database;
  ENVIRONMENT: "development" | "preview" | "production";
  PHOTOS: R2Bucket;
  PILOT_INVITE_CODE: string;
  PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  UNLOCK_RATE_LIMITER: RateLimiter;
  UPLOAD_RATE_LIMITER: RateLimiter;
};
