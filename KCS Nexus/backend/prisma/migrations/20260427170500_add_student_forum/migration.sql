-- CreateTable
CREATE TABLE "StudentForumPost" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentForumComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentForumComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIStudentForumReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "keyTopics" TEXT[],
    "recommendations" TEXT[],
    "actionItems" TEXT[],
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIStudentForumReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentForumPost_category_idx" ON "StudentForumPost"("category");

-- CreateIndex
CREATE INDEX "StudentForumPost_createdAt_idx" ON "StudentForumPost"("createdAt");

-- CreateIndex
CREATE INDEX "StudentForumComment_postId_idx" ON "StudentForumComment"("postId");

-- AddForeignKey
ALTER TABLE "StudentForumPost" ADD CONSTRAINT "StudentForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentForumComment" ADD CONSTRAINT "StudentForumComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "StudentForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentForumComment" ADD CONSTRAINT "StudentForumComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIStudentForumReport" ADD CONSTRAINT "AIStudentForumReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
