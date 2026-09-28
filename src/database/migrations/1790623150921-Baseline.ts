import { MigrationInterface, QueryRunner } from "typeorm";

export class Baseline1790623150921 implements MigrationInterface {
    name = 'Baseline1790623150921'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
        await queryRunner.query(`CREATE TABLE "admin_refresh_tokens" ("id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "user_agent" character varying(255) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "admin_id" uuid NOT NULL, CONSTRAINT "PK_341c4a1fa29fa0017ed8ad0791f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_refresh_token_hash" ON "admin_refresh_tokens"  ("token_hash") `);
        await queryRunner.query(`CREATE INDEX "idx_refresh_token_expires_at" ON "admin_refresh_tokens"  ("expires_at") `);
        await queryRunner.query(`CREATE TABLE "posts_chunks" ("id" uuid NOT NULL, "post_id" uuid NOT NULL, "chunk_index" integer NOT NULL, "content" text NOT NULL, "embedding" vector(384) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a4afb00240c0a15cfd21e899404" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_chunks_post_chunk_index" ON "posts_chunks"  ("post_id", "chunk_index") `);
        await queryRunner.query(`CREATE INDEX "idx_chunks_post_id" ON "posts_chunks"  ("post_id") `);
        await queryRunner.query(`CREATE INDEX "idx_chunks_embedding" ON "posts_chunks" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64)`);
        await queryRunner.query(`CREATE TABLE "blog_categories" ("id" uuid NOT NULL, "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_adc3bc773ccf2fb6f073193fcf6" UNIQUE ("name"), CONSTRAINT "UQ_903a6ea496e83ba9bec10af5835" UNIQUE ("slug"), CONSTRAINT "PK_1056d6faca26b9957f5d26e6572" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "post_tags" ("id" uuid NOT NULL, "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_822f68100a07acabf344a77d195" UNIQUE ("name"), CONSTRAINT "UQ_26806ce9e457b28ad82abcbf5e0" UNIQUE ("slug"), CONSTRAINT "PK_0c750579b992a52b24d18ec3431" PRIMARY KEY ("id"))`);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES ($1, $2, $3, $4, $5, $6)`, ["johnish_db","public","posts","GENERATED_COLUMN","search_vector","to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, ''))"]);
        await queryRunner.query(`CREATE TABLE "posts" ("id" uuid NOT NULL, "title" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "content" text NOT NULL, "excerpt" character varying(160) NOT NULL, "meta_title" character varying(255), "meta_description" character varying(255), "og_image_url" character varying(2048), "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, ''))) STORED NOT NULL, "published" boolean NOT NULL DEFAULT false, "published_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "admin_id" uuid NOT NULL, "category_id" uuid NOT NULL, CONSTRAINT "UQ_54ddf9075260407dcfdd7248577" UNIQUE ("slug"), CONSTRAINT "PK_2829ac61eff60fcec60d7274b9e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_post_search" ON "posts" USING gin ("search_vector") `);
        await queryRunner.query(`CREATE INDEX "idx_post_category" ON "posts"  ("category_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_post_slug" ON "posts"  ("slug") `);
        await queryRunner.query(`CREATE TABLE "admin_users" ("id" uuid NOT NULL, "name" character varying(100) NOT NULL, "last_name" character varying(100) NOT NULL, "username" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_2873882c38e8c07d98cb64f962d" UNIQUE ("username"), CONSTRAINT "UQ_dcd0c8a4b10af9c986e510b9ecc" UNIQUE ("email"), CONSTRAINT "PK_06744d221bb6145dc61e5dc441d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "songs" ("id" SERIAL NOT NULL, "track_id" character varying(255) NOT NULL, "track_name" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_e504ce8ad2e291d3a1d8f1ea2f4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "post_tag" ("post_id" uuid NOT NULL, "tag_id" uuid NOT NULL, CONSTRAINT "PK_c6d49aa86322a6f58c39ea25a5d" PRIMARY KEY ("post_id", "tag_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b5ec92f15aaa1e371f2662f681" ON "post_tag"  ("post_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d2fd5340bb68556fe93650fedc" ON "post_tag"  ("tag_id") `);
        await queryRunner.query(`ALTER TABLE "admin_refresh_tokens" ADD CONSTRAINT "FK_1bd01666a593d39ddf07f011405" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts_chunks" ADD CONSTRAINT "FK_4087260027a2104e3d2de071176" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_fbd8e6229f85b117a396e3c1bf9" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts" ADD CONSTRAINT "FK_852f266adc5d67c40405c887b49" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "post_tag" ADD CONSTRAINT "FK_b5ec92f15aaa1e371f2662f6812" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "post_tag" ADD CONSTRAINT "FK_d2fd5340bb68556fe93650fedc1" FOREIGN KEY ("tag_id") REFERENCES "post_tags"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "post_tag" DROP CONSTRAINT "FK_d2fd5340bb68556fe93650fedc1"`);
        await queryRunner.query(`ALTER TABLE "post_tag" DROP CONSTRAINT "FK_b5ec92f15aaa1e371f2662f6812"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_852f266adc5d67c40405c887b49"`);
        await queryRunner.query(`ALTER TABLE "posts" DROP CONSTRAINT "FK_fbd8e6229f85b117a396e3c1bf9"`);
        await queryRunner.query(`ALTER TABLE "posts_chunks" DROP CONSTRAINT "FK_4087260027a2104e3d2de071176"`);
        await queryRunner.query(`ALTER TABLE "admin_refresh_tokens" DROP CONSTRAINT "FK_1bd01666a593d39ddf07f011405"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d2fd5340bb68556fe93650fedc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b5ec92f15aaa1e371f2662f681"`);
        await queryRunner.query(`DROP TABLE "post_tag"`);
        await queryRunner.query(`DROP TABLE "songs"`);
        await queryRunner.query(`DROP TABLE "admin_users"`);
        await queryRunner.query(`DROP INDEX "public"."idx_post_slug"`);
        await queryRunner.query(`DROP INDEX "public"."idx_post_category"`);
        await queryRunner.query(`DROP INDEX "public"."idx_post_search"`);
        await queryRunner.query(`DROP TABLE "posts"`);
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "database" = $3 AND "schema" = $4 AND "table" = $5`, ["GENERATED_COLUMN","search_vector","johnish_db","public","posts"]);
        await queryRunner.query(`DROP TABLE "post_tags"`);
        await queryRunner.query(`DROP TABLE "blog_categories"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chunks_embedding"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chunks_post_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_chunks_post_chunk_index"`);
        await queryRunner.query(`DROP TABLE "posts_chunks"`);
        await queryRunner.query(`DROP INDEX "public"."idx_refresh_token_expires_at"`);
        await queryRunner.query(`DROP INDEX "public"."idx_refresh_token_hash"`);
        await queryRunner.query(`DROP TABLE "admin_refresh_tokens"`);
        await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
    }

}
