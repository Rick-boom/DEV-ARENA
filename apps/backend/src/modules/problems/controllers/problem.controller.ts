import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middlewares/auth.middleware.js';
import { getValidated } from '../../../middlewares/validate.middleware.js';
import type { ListProblemsQueryDto, SearchProblemsQueryDto } from '../dto/problem-request.dto.js';
import type { BookmarkService } from '../services/bookmark.service.js';
import type { ProblemService } from '../services/problem.service.js';
import type { TaxonomyService } from '../services/taxonomy.service.js';

/**
 * HTTP adapters for the public/user surface. Controllers are
 * intentionally thin: unwrap validated input → call one service
 * method → wrap in the success envelope. Zero business rules here.
 */
export class ProblemController {
  constructor(
    private readonly problemService: ProblemService,
    private readonly bookmarkService: BookmarkService,
    private readonly taxonomyService: TaxonomyService,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = getValidated<ListProblemsQueryDto>(req, 'query');
      const data = await this.problemService.list(query, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  search = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = getValidated<SearchProblemsQueryDto>(req, 'query');
      const data = await this.problemService.list(query, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  trending = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.problemService.trending(req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  recentlySolved = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.problemService.recentlySolved(req.user!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getOne = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      const data = await this.problemService.getByIdOrSlug(id, req.user);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  listBookmarks = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = getValidated<ListProblemsQueryDto>(req, 'query');
      const data = await this.bookmarkService.listMine(req.user!, query.page, query.pageSize);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  addBookmark = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      await this.bookmarkService.add(id, req.user!);
      res.status(201).json({ success: true, data: { bookmarked: true } });
    } catch (err) {
      next(err);
    }
  };

  removeBookmark = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      await this.bookmarkService.remove(id, req.user!);
      res.json({ success: true, data: { bookmarked: false } });
    } catch (err) {
      next(err);
    }
  };

  listTags = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      res.json({ success: true, data: await this.taxonomyService.listTags() });
    } catch (err) {
      next(err);
    }
  };

  listCompanies = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      res.json({ success: true, data: await this.taxonomyService.listCompanies() });
    } catch (err) {
      next(err);
    }
  };
}
