import {
  TemplateCategory,
  TemplateStatus,
  TemplateComponentType,
  TemplateHeaderFormat,
  TemplateButtonType,
  TemplateButton,
  TemplateComponent,
  WhatsAppMessageTemplate,
} from "@/types/database";

export type {
  TemplateCategory,
  TemplateStatus,
  TemplateComponentType,
  TemplateHeaderFormat,
  TemplateButtonType,
  TemplateButton,
  TemplateComponent,
  WhatsAppMessageTemplate,
};

export interface TemplateDraftInput {
  template_name: string;
  category: TemplateCategory;
  language: string;
  connection_id?: string | null;
  header_format?: TemplateHeaderFormat | "NONE";
  header_text?: string;
  body_text: string;
  footer_text?: string;
  buttons?: TemplateButton[];
}

export interface TemplateVariableExtraction {
  headerVariables: string[];
  bodyVariables: string[];
  allVariables: string[];
  totalCount: number;
}

export interface TemplateMetaSyncResult {
  success: boolean;
  count: number;
  added: number;
  updated: number;
  error?: string;
  requiresConnection?: boolean;
}

export interface TemplateListFilterOptions {
  category?: TemplateCategory | "ALL";
  status?: TemplateStatus | "ALL";
  language?: string | "ALL";
  search?: string;
  includeArchived?: boolean;
  connectionId?: string | "ALL";
}
