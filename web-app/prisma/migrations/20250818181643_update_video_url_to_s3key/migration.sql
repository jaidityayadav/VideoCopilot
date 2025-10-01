/*
  Warnings:

  - You are about to drop the column `url` on the `Video` table. All the data in the column will be lost.
  - Added the required column `s3Key` to the `Video` table without a default value. This is not possible if the table is not empty.

*/

-- First, add the s3Key column as optional
ALTER TABLE "public"."Video" ADD COLUMN "s3Key" TEXT;

-- Extract S3 key from existing URLs and update the s3Key column
-- This assumes URLs are in format: https://bucket.s3.region.amazonaws.com/key
UPDATE "public"."Video" 
SET "s3Key" = SUBSTRING("url" FROM 'amazonaws\.com/(.*)') 
WHERE "url" IS NOT NULL;

-- Handle case where URL might not match expected pattern - set a default key
UPDATE "public"."Video" 
SET "s3Key" = 'legacy/' || "id" || '.mp4'
WHERE "s3Key" IS NULL OR "s3Key" = '';

-- Now make s3Key required
ALTER TABLE "public"."Video" ALTER COLUMN "s3Key" SET NOT NULL;

-- Finally, drop the url column
ALTER TABLE "public"."Video" DROP COLUMN "url";
