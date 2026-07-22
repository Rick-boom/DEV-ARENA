import type { Company, Tag } from '@prisma/client';
import { NotFoundError } from '../../../errors/app-error.js';
import type { ICacheService } from '../../../lib/cache.js';
import { PROBLEM_CONSTANTS } from '../constants/problem.constants.js';
import type { IAuditLogRepository, ITaxonomyRepository } from '../interfaces/problem.interfaces.js';
import { slugify } from './problem-admin.service.js';
import type { AuthUser } from '../../../middlewares/auth.middleware.js';

const { CACHE } = PROBLEM_CONSTANTS;

/** Tag/Company vocabulary management with read-through caching. */
export class TaxonomyService {
  constructor(
    private readonly taxonomy: ITaxonomyRepository,
    private readonly audit: IAuditLogRepository,
    private readonly cache: ICacheService,
  ) {}

  async listTags(): Promise<Tag[]> {
    const cached = await this.cache.getJson<Tag[]>(CACHE.KEYS.tags);
    if (cached) return cached;
    const tags = await this.taxonomy.listTags();
    await this.cache.setJson(CACHE.KEYS.tags, tags, CACHE.TTL_TAXONOMY_SECONDS);
    return tags;
  }

  async listCompanies(): Promise<Company[]> {
    const cached = await this.cache.getJson<Company[]>(CACHE.KEYS.companies);
    if (cached) return cached;
    const companies = await this.taxonomy.listCompanies();
    await this.cache.setJson(CACHE.KEYS.companies, companies, CACHE.TTL_TAXONOMY_SECONDS);
    return companies;
  }

  async upsertTag(name: string, actor: AuthUser): Promise<Tag> {
    const tag = await this.taxonomy.upsertTag(name, slugify(name));
    await this.cache.del(CACHE.KEYS.tags);
    await this.audit.record({
      actorId: actor.id,
      action: 'tag.upsert',
      targetType: 'tag',
      targetId: tag.id,
      metadata: { name },
    });
    return tag;
  }

  async upsertCompany(
    name: string,
    logoUrl: string | undefined,
    actor: AuthUser,
  ): Promise<Company> {
    const company = await this.taxonomy.upsertCompany(name, slugify(name), logoUrl);
    await this.cache.del(CACHE.KEYS.companies);
    await this.audit.record({
      actorId: actor.id,
      action: 'company.upsert',
      targetType: 'company',
      targetId: company.id,
      metadata: { name },
    });
    return company;
  }

  async deleteTag(id: string, actor: AuthUser): Promise<void> {
    const removed = await this.taxonomy.deleteTag(id);
    if (!removed) throw new NotFoundError('Tag');
    await this.cache.del(CACHE.KEYS.tags);
    await this.audit.record({
      actorId: actor.id,
      action: 'tag.delete',
      targetType: 'tag',
      targetId: id,
    });
  }

  async deleteCompany(id: string, actor: AuthUser): Promise<void> {
    const removed = await this.taxonomy.deleteCompany(id);
    if (!removed) throw new NotFoundError('Company');
    await this.cache.del(CACHE.KEYS.companies);
    await this.audit.record({
      actorId: actor.id,
      action: 'company.delete',
      targetType: 'company',
      targetId: id,
    });
  }
}
