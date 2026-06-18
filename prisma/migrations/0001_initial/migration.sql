CREATE TABLE "bootstrap_state" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bootstrap_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bootstrap_state_key_key" ON "bootstrap_state"("key");
