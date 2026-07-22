import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../../middlewares/auth.middleware.js';
import { getValidated } from '../../../middlewares/validate.middleware.js';
import type {
  CreateProblemDto,
  UpdateProblemDto,
  UploadTestCasesDto,
  UpsertCompanyDto,
  UpsertEditorialDto,
  UpsertHintsDto,
  UpsertTagDto,
} from '../dto/problem-request.dto.js';
import type { ProblemAdminService } from '../services/problem-admin.service.js';
import type { TaxonomyService } from '../services/taxonomy.service.js';

/** HTTP adapters for the admin surface. Same thin-controller rule. */
export class ProblemAdminController {
  constructor(
    private readonly adminService: ProblemAdminService,
    private readonly taxonomyService: TaxonomyService,
  ) {}

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = getValidated<CreateProblemDto>(req, 'body');
      const data = await this.adminService.create(body, req.user!);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getOne = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      res.json({ success: true, data: await this.adminService.getAdminDetail(id) });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      const body = getValidated<UpdateProblemDto>(req, 'body');
      res.json({ success: true, data: await this.adminService.update(id, body, req.user!) });
    } catch (err) {
      next(err);
    }
  };

  remove = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      await this.adminService.softDelete(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  publish = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      res.json({ success: true, data: await this.adminService.publish(id, req.user!) });
    } catch (err) {
      next(err);
    }
  };

  archive = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      res.json({ success: true, data: await this.adminService.archive(id, req.user!) });
    } catch (err) {
      next(err);
    }
  };

  uploadTestCases = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      const body = getValidated<UploadTestCasesDto>(req, 'body');
      const count = await this.adminService.uploadTestCases(id, body, req.user!);
      res.status(201).json({ success: true, data: { replaced: true, count } });
    } catch (err) {
      next(err);
    }
  };

  upsertEditorial = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      const body = getValidated<UpsertEditorialDto>(req, 'body');
      res.json({
        success: true,
        data: await this.adminService.upsertEditorial(id, body, req.user!),
      });
    } catch (err) {
      next(err);
    }
  };

  upsertHints = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      const body = getValidated<UpsertHintsDto>(req, 'body');
      res.json({ success: true, data: await this.adminService.upsertHints(id, body, req.user!) });
    } catch (err) {
      next(err);
    }
  };

  listVersions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      res.json({ success: true, data: await this.adminService.listVersions(id) });
    } catch (err) {
      next(err);
    }
  };

  getVersion = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id, version } = getValidated<{ id: string; version: number }>(req, 'params');
      res.json({ success: true, data: await this.adminService.getVersion(id, version) });
    } catch (err) {
      next(err);
    }
  };

  upsertTag = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = getValidated<UpsertTagDto>(req, 'body');
      res
        .status(201)
        .json({ success: true, data: await this.taxonomyService.upsertTag(body.name, req.user!) });
    } catch (err) {
      next(err);
    }
  };

  deleteTag = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      await this.taxonomyService.deleteTag(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };

  upsertCompany = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = getValidated<UpsertCompanyDto>(req, 'body');
      res
        .status(201)
        .json({
          success: true,
          data: await this.taxonomyService.upsertCompany(body.name, body.logoUrl, req.user!),
        });
    } catch (err) {
      next(err);
    }
  };

  deleteCompany = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = getValidated<{ id: string }>(req, 'params');
      await this.taxonomyService.deleteCompany(id, req.user!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  };
}
