declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [key: string]: WorkSheet };
  }

  export interface WorkSheet {
    [key: string]: any;
  }

  export interface ParsingOptions {
    type?: 'buffer' | 'binary' | 'base64' | 'array' | 'file' | 'string';
    raw?: boolean;
    header?: 1 | 'A' | string[];
    defval?: any;
  }

  export interface WritingOptions {
    type?: 'buffer' | 'binary' | 'base64' | 'array' | 'file' | 'string';
    bookType?: 'xlsx' | 'xlsm' | 'xlsb' | 'xls' | 'csv' | 'txt' | 'html' | 'ods' | 'dif' | 'sylk' | 'prn' | 'rtf' | 'slk' | 'fods';
  }

  export function read(data: any, opts?: ParsingOptions): WorkBook;
  export function write(wb: WorkBook, opts?: WritingOptions): any;

  export namespace utils {
    export function sheet_to_json<T = any>(
      worksheet: WorkSheet,
      opts?: {
        header?: 1 | 'A' | string[];
        defval?: any;
        blankrows?: boolean;
        raw?: boolean;
        dateNF?: string;
      }
    ): T[];
    export function book_new(): WorkBook;
    export function book_append_sheet(wb: WorkBook, ws: WorkSheet, name?: string): void;
    export function aoa_to_sheet(data: any[][], opts?: any): WorkSheet;
    export function json_to_sheet(data: any[], opts?: any): WorkSheet;
  }
}
