import { EMBEDDING_DIMENSION } from '../../src/modules/rag/application/constants/embedding.constants';

/**
 * `posts_chunks.embedding` is vector(384). A zero vector lets indexing and
 * hybrid search run in e2e without loading the multilingual-e5-small model.
 */
export function pipeline(): Promise<() => Promise<{ data: Float32Array }>> {
  return Promise.resolve((): Promise<{ data: Float32Array }> =>
    Promise.resolve({ data: new Float32Array(EMBEDDING_DIMENSION) }),
  );
}
