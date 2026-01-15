import {
  Controller,
  Post,
  Get,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { ImportService } from './import.service';
import { MultiSheetImportService } from './multi-sheet-import.service';
import { ImportDataDto } from './dto/import-data.dto';
import { multerConfig } from '../../common/multer.config';

// Multer File Type
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('import')
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly multiSheetImportService: MultiSheetImportService,
  ) {}

  @Post('excel')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async importExcel(
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ) {
    console.log('Excel Import Request:', {
      hasFile: !!file,
      fileName: file?.originalname,
      fileSize: file?.size,
      mimetype: file?.mimetype,
      body: req.body,
      bodyKeys: req.body ? Object.keys(req.body) : [],
    });
    console.log('[ImportController] *** CALLING importService.importExcel ***');

    if (!file) {
      console.error('Import error: No file uploaded');
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    if (!file.buffer || file.buffer.length === 0) {
      console.error('Import error: File buffer is empty');
      throw new BadRequestException('Datei ist leer');
    }

    // Extrahiere Body-Parameter aus multipart/form-data
    // Multer parst multipart/form-data und setzt die Felder in req.body
    const financialStatementId = req.body?.financialStatementId;
    const fileType = req.body?.fileType || 'excel';
    const sheetName = req.body?.sheetName;

    console.log('Extracted parameters:', {
      financialStatementId,
      fileType,
      sheetName,
    });

    if (!financialStatementId) {
      console.error('Import error: financialStatementId missing');
      throw new BadRequestException('financialStatementId ist erforderlich');
    }

    if (fileType !== 'excel') {
      console.error('Import error: Wrong file type', fileType);
      throw new BadRequestException(`Falscher Dateityp für Excel-Import. Erhalten: ${fileType}, erwartet: excel`);
    }

    const importDataDto: ImportDataDto = {
      financialStatementId,
      fileType: 'excel',
      sheetName,
    };

    return this.importService.importExcel(file, importDataDto);
  }

  @Post('csv')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async importCsv(
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ) {
    console.log('CSV Import Request:', {
      hasFile: !!file,
      fileName: file?.originalname,
      body: req.body,
    });

    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    // Extrahiere Body-Parameter aus multipart/form-data
    const financialStatementId = req.body?.financialStatementId;
    const fileType = req.body?.fileType || 'csv';

    console.log('Extracted parameters:', { financialStatementId, fileType });

    if (!financialStatementId) {
      throw new BadRequestException('financialStatementId ist erforderlich');
    }

    if (fileType !== 'csv') {
      throw new BadRequestException('Falscher Dateityp für CSV-Import');
    }

    const importDataDto: ImportDataDto = {
      financialStatementId,
      fileType: 'csv',
    };

    return this.importService.importCsv(file, importDataDto);
  }

  @Post('excel-mapped')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async importExcelMapped(
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ) {
    console.log('Mapped Excel Import Request:', {
      hasFile: !!file,
      fileName: file?.originalname,
      body: req.body,
    });

    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    const financialStatementId = req.body?.financialStatementId;
    const sheetName = req.body?.sheetName;
    const columnMappingStr = req.body?.columnMapping;

    if (!financialStatementId) {
      throw new BadRequestException('financialStatementId ist erforderlich');
    }

    let columnMapping: Record<string, string> = {};
    try {
      if (columnMappingStr) {
        columnMapping = JSON.parse(columnMappingStr);
      }
    } catch (e) {
      throw new BadRequestException('Ungültiges columnMapping Format');
    }

    return this.importService.importExcelWithMapping(file, {
      financialStatementId,
      sheetName,
      columnMapping,
    });
  }

  @Post('excel-multi-sheet')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async importExcelMultiSheet(
    @UploadedFile() file: MulterFile,
    @Req() req: Request,
  ) {
    console.log('Multi-Sheet Excel Import Request:', {
      hasFile: !!file,
      fileName: file?.originalname,
      fileSize: file?.size,
      body: req.body,
    });

    if (!file) {
      throw new BadRequestException('Keine Datei hochgeladen');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Datei ist leer');
    }

    const fiscalYear = parseInt(req.body?.fiscalYear || new Date().getFullYear().toString());
    const periodStart = req.body?.periodStart;
    const periodEnd = req.body?.periodEnd;

    return this.multiSheetImportService.importMultiSheet(file, {
      fiscalYear,
      periodStart,
      periodEnd,
    });
  }

  @Get('template')
  async getTemplate(@Res() res: Response, @Query('v') version?: string, @Query('t') timestamp?: string) {
    try {
      console.log(`Template download requested (version: ${version || 'unknown'}, timestamp: ${timestamp || 'none'})`);
      
      // Timeout für Template-Laden (10 Sekunden)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Template loading timeout after 10 seconds')), 10000);
      });

      const templatePromise = this.importService.getImportTemplate();
      const template = await Promise.race([templatePromise, timeoutPromise]) as Buffer;
      
      console.log('Template loaded, size:', template.length);
      
      // Aggressive cache-busting headers to prevent any caching
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.setHeader('ETag', `"${Date.now()}-${template.length}"`);
      
      // Add version to filename if provided
      const filename = version 
        ? `Konsolidierung_Muster_v${version}.xlsx`
        : `Konsolidierung_Muster_v3.0.xlsx`;
      
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.send(template);
    } catch (error: any) {
      console.error('Error loading template:', error);
      if (error.message?.includes('timeout')) {
        res.status(504).json({ 
          error: 'Template konnte nicht geladen werden - Timeout. Bitte versuchen Sie es erneut.' 
        });
      } else {
        res.status(500).json({ 
          error: error.message || 'Fehler beim Laden der Vorlage' 
        });
      }
    }
  }
}
