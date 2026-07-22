import type { Company, PrismaClient, Tag } from '@prisma/client';
import type { ITaxonomyRepository } from '../interfaces/problem.interfaces.js';

/**
 * Tags + Companies share identical persistence semantics, so one
 * repository owns the vocabulary. Upserts key on slug: re-creating an
 * existing tag renames it instead of erroring — the admin UX we want.
 */
export class TaxonomyRepository implements ITaxonomyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listTags(): Promise<Tag[]> {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  listCompanies(): Promise<Company[]> {
    return this.prisma.company.findMany({ orderBy: { name: 'asc' } });
  }

  upsertTag(name: string, slug: string): Promise<Tag> {
    return this.prisma.tag.upsert({ where: { slug }, create: { name, slug }, update: { name } });
  }

  upsertCompany(name: string, slug: string, logoUrl?: string): Promise<Company> {
    return this.prisma.company.upsert({
      where: { slug },
      create: { name, slug, logoUrl: logoUrl ?? null },
      update: { name, ...(logoUrl !== undefined ? { logoUrl } : {}) },
    });
  }

  async deleteTag(id: string): Promise<boolean> {
    const result = await this.prisma.tag.deleteMany({ where: { id } });
    return result.count > 0;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await this.prisma.company.deleteMany({ where: { id } });
    return result.count > 0;
  }

  async resolveTagIds(slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const rows = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async resolveCompanyIds(slugs: string[]): Promise<string[]> {
    if (slugs.length === 0) return [];
    const rows = await this.prisma.company.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
