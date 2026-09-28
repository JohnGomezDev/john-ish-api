import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from '@xenova/transformers';
import { BGE_QUERY_PREFIX } from '../../application/constants/embedding.constants';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private pipelineInstance: FeatureExtractionPipeline | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const cacheDir = this.configService.get<string>('EMBEDDINGS_CACHE_DIR');
    if (cacheDir) {
      env.cacheDir = cacheDir;
    }

    try {
      this.pipelineInstance = await pipeline(
        'feature-extraction',
        'Xenova/bge-m3',
      );
      this.logger.log('Modelo Xenova/bge-m3 cargado correctamente');
    } catch (error) {
      this.logger.error(
        'No se pudo inicializar el modelo de embeddings',
        error,
      );
      this.pipelineInstance = null;
    }
  }

  async embedDocument(text: string): Promise<number[]> {
    if (!this.pipelineInstance) {
      throw new ServiceUnavailableException(
        'El servicio de embeddings no está disponible',
      );
    }

    const output = await this.pipelineInstance(text, {
      pooling: 'cls',
      normalize: true,
    });

    return Array.from(output.data as ArrayLike<number>);
  }

  async embedQuery(query: string): Promise<number[]> {
    return this.embedDocument(BGE_QUERY_PREFIX + query);
  }
}
