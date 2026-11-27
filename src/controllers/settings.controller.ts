import { BaseResponse } from "../utils/responseFormat.js";
import { SettingsService } from "../services/settings.service.js";

export class SettingsController {
  constructor(protected readonly settingsService = new SettingsService()) {}

  /** GET /settings/hours — público: horarios del local (web y mails). */
  async getHours(_req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Horarios", await this.settingsService.getHours()));
    } catch (error) {
      next(error);
    }
  }

  /** PUT /settings/hours — edición desde el panel (content.edit). */
  async saveHours(req: any, res: any, next: any) {
    try {
      res.status(200).json(new BaseResponse(200, "Horarios guardados", await this.settingsService.saveHours(req.body)));
    } catch (error) {
      next(error);
    }
  }
}
