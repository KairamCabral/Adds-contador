-- CreateTable
CREATE TABLE "tiny_produto_cache" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "produto_id" BIGINT NOT NULL,
    "sku" TEXT,
    "descricao" TEXT NOT NULL,
    "categoria_nome" TEXT,
    "categoria_caminho_completo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiny_produto_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tiny_produto_cache_companyId_idx" ON "tiny_produto_cache"("companyId");

-- CreateIndex
CREATE INDEX "tiny_produto_cache_updated_at_idx" ON "tiny_produto_cache"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "tiny_produto_cache_companyId_produto_id_key" ON "tiny_produto_cache"("companyId", "produto_id");

-- AddForeignKey
ALTER TABLE "tiny_produto_cache" ADD CONSTRAINT "tiny_produto_cache_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
