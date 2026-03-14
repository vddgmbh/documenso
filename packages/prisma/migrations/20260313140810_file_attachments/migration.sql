-- AlterTable
ALTER TABLE "EnvelopeAttachment" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "hash" TEXT;
