export const EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';

export const EMBEDDING_DIMENSION = 384;

/** E5 query prefix — required for asymmetric retrieval. */
export const E5_QUERY_PREFIX = 'query: ';

/** E5 document/passage prefix — applied when indexing chunks. */
export const E5_DOCUMENT_PREFIX = 'passage: ';
