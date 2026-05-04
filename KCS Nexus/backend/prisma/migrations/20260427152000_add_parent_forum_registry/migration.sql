-- CreateTable
CREATE TABLE "ParentForumPost" (
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

    CONSTRAINT "ParentForumPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentForumComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentForumComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIForumReport" (
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

    CONSTRAINT "AIForumReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentForumPost_category_idx" ON "ParentForumPost"("category");

-- CreateIndex
CREATE INDEX "ParentForumPost_createdAt_idx" ON "ParentForumPost"("createdAt");

-- CreateIndex
CREATE INDEX "ParentForumComment_postId_idx" ON "ParentForumComment"("postId");

-- AddForeignKey
ALTER TABLE "ParentForumPost" ADD CONSTRAINT "ParentForumPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentForumComment" ADD CONSTRAINT "ParentForumComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "ParentForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentForumComment" ADD CONSTRAINT "ParentForumComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIForumReport" ADD CONSTRAINT "AIForumReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
