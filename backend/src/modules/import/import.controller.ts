import {
  Controller,
  Post,
  Get,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { ImportService } from './import.service';
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
  constructor(private readonly importService: ImportService) {}

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

  @Get('template')
  async getTemplate(@Res() res: Response) {
    try {
      console.log('Template download requested');
      
      // Timeout für Template-Laden (10 Sekunden)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Template loading timeout after 10 seconds')), 10000);
      });

      const templatePromise = this.importService.getImportTemplate();
      const template = await Promise.race([templatePromise, timeoutPromise]) as Buffer;
      
      console.log('Template loaded, size:', template.length);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=Konsolidierung_Muster.xlsx',
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
