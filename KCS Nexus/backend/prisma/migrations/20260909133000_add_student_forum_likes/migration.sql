CREATE TABLE "StudentForumLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentForumLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentForumLike_postId_userId_key" ON "StudentForumLike"("postId", "userId");
CREATE INDEX "StudentForumLike_postId_idx" ON "StudentForumLike"("postId");
CREATE INDEX "StudentForumLike_userId_idx" ON "StudentForumLike"("userId");

ALTER TABLE "StudentForumLike" ADD CONSTRAINT "StudentForumLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "StudentForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentForumLike" ADD CONSTRAINT "StudentForumLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
