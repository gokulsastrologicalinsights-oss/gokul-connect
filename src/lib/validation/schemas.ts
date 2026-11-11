import { z } from "zod";

/**
 * Authentication Input Validation
 */
export const LoginInputSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email cannot be empty.")
    .max(255, "Email cannot exceed 255 characters.")
    .email("Invalid email address format.")
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Password cannot be empty.")
    .max(128, "Password cannot exceed 128 characters."),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * WhatsApp Connection Creation Schema
 */
export const CreateWhatsAppConnectionSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Display name is required.")
    .max(255, "Display name cannot exceed 255 characters."),
  phone_number: z
    .string()
    .trim()
    .min(5, "Phone number is required.")
    .max(30, "Phone number is too long."),
  phone_number_id: z
    .string()
    .trim()
    .min(5, "Phone number ID is required.")
    .max(50, "Phone number ID is too long.")
    .regex(/^[0-9]+$/, "Phone Number ID must contain only digits."),
  waba_id: z
    .string()
    .trim()
    .min(5, "WABA ID is required.")
    .max(50, "WABA ID is too long.")
    .regex(/^[0-9]+$/, "WABA ID must contain only digits."),
  access_token: z
    .string()
    .trim()
    .min(20, "Access token must be at least 20 characters.")
    .max(2048, "Access token is too long."),
  description: z.string().trim().max(500).optional(),
});

export type ValidatedCreateWhatsAppConnection = z.infer<typeof CreateWhatsAppConnectionSchema>;

/**
 * WhatsApp Connection Update Schema
 */
export const UpdateWhatsAppConnectionSchema = z.object({
  display_name: z.string().trim().min(1).max(255).optional(),
  phone_number: z.string().trim().min(5).max(30).optional(),
  description: z.string().trim().max(500).optional(),
  is_enabled: z.boolean().optional(),
});

export type ValidatedUpdateWhatsAppConnection = z.infer<typeof UpdateWhatsAppConnectionSchema>;

/**
 * Outbound WhatsApp Message Dispatch Schema
 */
export const SendWhatsAppMessageInputSchema = z
  .object({
    businessSlug: z
      .string()
      .trim()
      .min(1, "Business slug cannot be empty.")
      .max(100, "Business slug is too long.")
      .regex(/^[a-z0-9-]+$/i, "Business slug must contain only letters, numbers, and hyphens."),
    connectionId: z
      .string()
      .trim()
      .min(1, "Connection ID cannot be empty.")
      .max(100, "Connection ID is too long."),
    recipientPhone: z
      .string()
      .trim()
      .min(5, "Recipient phone number is too short.")
      .max(30, "Recipient phone number is too long.")
      .regex(/^\+?[0-9\s\-()]+$/, "Invalid recipient phone number format."),
    recipientName: z
      .string()
      .trim()
      .max(255, "Recipient name cannot exceed 255 characters.")
      .optional(),
    text: z
      .string()
      .trim()
      .min(1, "Message text cannot be empty.")
      .max(4096, "Message exceeds maximum allowed character length of 4096.")
      .optional(),
    template: z
      .object({
        name: z
          .string()
          .trim()
          .min(1, "Template name cannot be empty.")
          .max(255, "Template name is too long."),
        languageCode: z.string().trim().min(2).max(10).default("en_US").optional(),
        components: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .optional(),
  })
  .refine((data) => data.text !== undefined || data.template !== undefined, {
    message: "Either message text or a valid template must be provided.",
    path: ["text"],
  });

export type ValidatedSendWhatsAppMessageInput = z.infer<typeof SendWhatsAppMessageInputSchema>;

/**
 * Inbox Send Message Action Schema
 */
export const InboxSendMessageInputSchema = z
  .object({
    businessSlug: z
      .string()
      .trim()
      .min(1, "Business slug cannot be empty.")
      .max(100, "Business slug is too long."),
    conversationId: z
      .string()
      .trim()
      .min(1, "Conversation ID cannot be empty.")
      .max(100, "Conversation ID is too long."),
    text: z
      .string()
      .trim()
      .min(1, "Message text cannot be empty.")
      .max(4096, "Message exceeds maximum allowed character length of 4096.")
      .optional(),
    template: z
      .object({
        name: z
          .string()
          .trim()
          .min(1, "Template name cannot be empty.")
          .max(255, "Template name is too long."),
        languageCode: z.string().trim().min(2).max(10).default("en_US").optional(),
        components: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .optional(),
  })
  .refine((data) => data.text !== undefined || data.template !== undefined, {
    message: "Either message text or a valid template must be provided.",
    path: ["text"],
  });

export type ValidatedInboxSendMessageInput = z.infer<typeof InboxSendMessageInputSchema>;

/**
 * Conversation Status Mutation Schema
 */
export const UpdateConversationStatusSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  conversationId: z.string().trim().min(1).max(100),
  status: z.enum(["open", "closed", "archived", "pending_human"]),
});

/**
 * Agent Assignment Mutation Schema
 */
export const AssignConversationAgentSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  conversationId: z.string().trim().min(1).max(100),
  agentId: z.string().trim().nullable(),
  agentName: z.string().trim().max(255).nullable(),
});

/**
 * Business Settings Update Schema
 */
export const UpdateBusinessSettingsSchema = z.object({
  display_name: z.string().trim().min(1).max(255).optional(),
  business_info: z.string().trim().max(1000).optional(),
  logo_placeholder: z.string().trim().max(100).optional(),
  timezone: z.string().trim().max(100).optional(),
  default_language: z.string().trim().max(10).optional(),
  notification_preferences: z
    .object({
      connection_drops: z.boolean().optional(),
      unread_alerts: z.boolean().optional(),
      daily_digest: z.boolean().optional(),
    })
    .optional(),
  whatsapp_preferences: z
    .object({
      default_connection_id: z.string().trim().nullable().optional(),
      webhook_retry_policy: z.enum(["standard", "aggressive", "relaxed"]).optional(),
      opt_out_keywords: z.string().trim().max(500).optional(),
    })
    .optional(),
});

/**
 * ==========================================
 * PHASE 9: CRM & CONTACT MANAGEMENT SCHEMAS
 * ==========================================
 */

export const ContactStatusEnum = z.enum(["lead", "active", "inactive", "customer"]);
export const ContactSourceEnum = z.enum([
  "whatsapp",
  "website",
  "referral",
  "walk_in",
  "csv_import",
  "manual",
  "other",
]);

export const CreateContactSchema = z.object({
  display_name: z.string().trim().min(1, "Contact name is required.").max(255),
  phone_number: z.string().trim().min(5, "Valid WhatsApp phone number is required.").max(30),
  email: z.string().trim().email("Invalid email address").max(255).optional().or(z.literal("")),
  status: ContactStatusEnum.default("lead"),
  category: z.string().trim().max(100).optional().nullable(),
  source: ContactSourceEnum.default("manual"),
  tags: z.array(z.string().trim().max(50)).default([]),
  custom_fields: z.record(z.string(), z.unknown()).default({}),
  note: z.string().trim().max(2000).optional(),
});

export const UpdateContactSchema = z.object({
  display_name: z.string().trim().min(1, "Contact name cannot be empty.").max(255).optional(),
  phone_number: z.string().trim().min(5, "Phone number is too short.").max(30).optional(),
  email: z.string().trim().email("Invalid email address").max(255).optional().nullable().or(z.literal("")),
  status: ContactStatusEnum.optional(),
  category: z.string().trim().max(100).optional().nullable(),
  source: ContactSourceEnum.optional(),
  tags: z.array(z.string().trim().max(50)).optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  is_opted_out: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

export const AddContactNoteSchema = z.object({
  note: z.string().trim().min(1, "Note content cannot be empty.").max(4000),
  author_name: z.string().trim().max(100).default("Staff"),
});

export const CreateCrmCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(100),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  color: z.string().trim().max(50).default("indigo"),
  description: z.string().trim().max(500).optional().nullable(),
  sort_order: z.number().int().default(0),
  is_default: z.boolean().default(false),
});

export const CreateCrmSegmentSchema = z.object({
  name: z.string().trim().min(1, "Segment name is required.").max(100),
  description: z.string().trim().max(500).optional().nullable(),
  filters: z.record(z.string(), z.unknown()).default({}),
});

export const BulkImportContactsSchema = z.object({
  contacts: z.array(
    z.object({
      name: z.string().trim().min(1, "Contact name required"),
      phone: z.string().trim().min(5, "Phone number required"),
      email: z.string().trim().email().optional().or(z.literal("")),
      category: z.string().trim().optional(),
      status: ContactStatusEnum.optional(),
      source: ContactSourceEnum.optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().trim().optional(),
    })
  ).min(1, "At least one contact row is required to import."),
});

/**
 * Phase 12.1 Team Management Schemas
 */
export const BusinessRoleEnum = z.enum(["owner", "admin", "agent", "viewer"]);

export const InviteTeamMemberSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  email: z
    .string()
    .trim()
    .min(1, "Email cannot be empty.")
    .max(255, "Email cannot exceed 255 characters.")
    .email("Invalid email address format.")
    .toLowerCase(),
  role: BusinessRoleEnum,
  fullName: z.string().trim().max(100).optional(),
});

export const UpdateMemberRoleSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  memberId: z.string().trim().min(1).max(100),
  newRole: BusinessRoleEnum,
});

export const ToggleMemberStatusSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  memberId: z.string().trim().min(1).max(100),
  isActive: z.boolean(),
});

export const RemoveMemberSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  memberId: z.string().trim().min(1).max(100),
});

export const RevokeInvitationSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  invitationId: z.string().trim().min(1).max(100),
});

export const ResendInvitationSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  invitationId: z.string().trim().min(1).max(100),
});

/**
 * Phase 12.2: Media Messaging Schemas
 */
export const SupportedMediaTypeSchema = z.enum(["image", "document", "audio", "video"]);

export const SendMediaMessageSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  conversationId: z.string().trim().min(1).max(100),
  mediaType: SupportedMediaTypeSchema,
  filename: z.string().trim().min(1, "Filename cannot be empty.").max(255),
  mimeType: z.string().trim().min(1, "MIME type is required.").max(100),
  fileSize: z
    .number()
    .int()
    .positive("File size must be positive.")
    .max(100 * 1024 * 1024, "File size exceeds absolute maximum limit (100MB)."),
  base64Data: z.string().min(1, "File data is required."),
  caption: z.string().trim().max(1024, "Caption cannot exceed 1024 characters.").optional(),
});

export type ValidatedSendMediaMessage = z.infer<typeof SendMediaMessageSchema>;

export const GetMediaDownloadUrlSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  messageId: z.string().trim().min(1).max(100),
});

export type ValidatedGetMediaDownloadUrl = z.infer<typeof GetMediaDownloadUrlSchema>;

export const RetryMediaMessageSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  messageId: z.string().trim().min(1).max(100),
});

export type ValidatedRetryMediaMessage = z.infer<typeof RetryMediaMessageSchema>;

/**
 * Phase 12.3: Scheduled Messaging Schemas
 */
export const ScheduledMessageStatusSchema = z.enum([
  "draft",
  "scheduled",
  "processing",
  "sent",
  "delivered",
  "read",
  "failed",
  "cancelled",
]);

export const ScheduledMessageTypeSchema = z.enum([
  "text",
  "template",
  "image",
  "document",
  "audio",
  "video",
]);

export const CreateScheduledMessageSchema = z
  .object({
    businessSlug: z.string().trim().min(1).max(100),
    connectionId: z.string().trim().min(1, "Connection ID is required.").max(100),
    recipientPhone: z
      .string()
      .trim()
      .min(5, "Recipient phone number is required.")
      .max(30, "Recipient phone number is too long.")
      .regex(/^\+?[0-9\s\-()]+$/, "Invalid recipient phone number format."),
    recipientName: z.string().trim().max(255).optional(),
    conversationId: z.string().trim().max(100).optional(),
    messageType: ScheduledMessageTypeSchema,
    content: z.string().trim().max(4096, "Message content cannot exceed 4096 characters.").optional(),
    templateName: z.string().trim().max(100).optional(),
    templateLanguage: z.string().trim().max(20).default("en_US"),
    templateVariables: z.record(z.string(), z.string()).optional(),
    media: z
      .object({
        mediaType: SupportedMediaTypeSchema,
        filename: z.string().trim().min(1, "Filename cannot be empty.").max(255),
        mimeType: z.string().trim().min(1, "MIME type is required.").max(100),
        fileSize: z.number().int().positive().max(100 * 1024 * 1024),
        base64Data: z.string().min(1, "Media data is required.").optional(),
        storagePath: z.string().optional(),
        caption: z.string().trim().max(1024).optional(),
      })
      .optional(),
    scheduledAt: z.string().refine(
      (val) => {
        const d = new Date(val);
        return !isNaN(d.getTime());
      },
      { message: "Invalid date format for scheduledAt." }
    ),
    timezone: z.string().trim().max(100).default("Asia/Kolkata"),
    status: z.enum(["draft", "scheduled"]).default("scheduled"),
  })
  .superRefine((data, ctx) => {
    // 1. Text message validation
    if (data.messageType === "text" && (!data.content || data.content.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Message content cannot be empty for text messages.",
      });
    }

    // 2. Template message validation
    if (data.messageType === "template" && (!data.templateName || data.templateName.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateName"],
        message: "Template name is required for template messages.",
      });
    }

    // 3. Media message validation
    if (["image", "document", "audio", "video"].includes(data.messageType)) {
      if (!data.media && !data.content) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["media"],
          message: "Media attachment is required for media messages.",
        });
      }
    }

    // 4. Past date validation for scheduled messages (drafts can have past date)
    if (data.status === "scheduled") {
      const scheduledTime = new Date(data.scheduledAt).getTime();
      // Allow 30 seconds clock skew tolerance
      if (scheduledTime <= Date.now() - 30_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "Scheduled time must be in the future.",
        });
      }
    }
  });

export type ValidatedCreateScheduledMessage = z.infer<typeof CreateScheduledMessageSchema>;

export const UpdateScheduledMessageSchema = z
  .object({
    businessSlug: z.string().trim().min(1).max(100),
    messageId: z.string().trim().min(1).max(100),
    scheduledAt: z
      .string()
      .refine((val) => !isNaN(new Date(val).getTime()), { message: "Invalid date format." })
      .optional(),
    content: z.string().trim().max(4096).optional(),
    templateVariables: z.record(z.string(), z.string()).optional(),
    mediaCaption: z.string().trim().max(1024).optional(),
    status: z.enum(["draft", "scheduled"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduledAt && data.status !== "draft") {
      const scheduledTime = new Date(data.scheduledAt).getTime();
      if (scheduledTime <= Date.now() - 30_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "Scheduled time must be in the future.",
        });
      }
    }
  });

export type ValidatedUpdateScheduledMessage = z.infer<typeof UpdateScheduledMessageSchema>;

export const RescheduleMessageSchema = z
  .object({
    businessSlug: z.string().trim().min(1).max(100),
    messageId: z.string().trim().min(1).max(100),
    newScheduledAt: z.string().refine((val) => !isNaN(new Date(val).getTime()), {
      message: "Invalid date format for newScheduledAt.",
    }),
  })
  .superRefine((data, ctx) => {
    const scheduledTime = new Date(data.newScheduledAt).getTime();
    if (scheduledTime <= Date.now() - 30_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newScheduledAt"],
        message: "New scheduled time must be in the future.",
      });
    }
  });

export type ValidatedRescheduleMessage = z.infer<typeof RescheduleMessageSchema>;

export const CancelScheduledMessageSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  messageId: z.string().trim().min(1).max(100),
  reason: z.string().trim().max(500).optional(),
});

export type ValidatedCancelScheduledMessage = z.infer<typeof CancelScheduledMessageSchema>;

export const RetryScheduledMessageSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  messageId: z.string().trim().min(1).max(100),
});

export type ValidatedRetryScheduledMessage = z.infer<typeof RetryScheduledMessageSchema>;

export const DeleteDraftScheduledMessageSchema = z.object({
  businessSlug: z.string().trim().min(1).max(100),
  messageId: z.string().trim().min(1).max(100),
});

export type ValidatedDeleteDraftScheduledMessage = z.infer<typeof DeleteDraftScheduledMessageSchema>;

/**
 * ==========================================
 * PHASE 12.4: CAMPAIGN MANAGEMENT SCHEMAS
 * ==========================================
 */

export const CampaignMessageTypeEnum = z.enum([
  "template",
  "text",
  "image",
  "document",
  "audio",
  "video",
]);

export const CampaignAudienceTypeEnum = z.enum([
  "all_contacts",
  "segment",
  "category",
  "manual",
]);

export const CampaignStatusEnum = z.enum([
  "draft",
  "scheduled",
  "preparing",
  "queued",
  "sending",
  "paused",
  "completed",
  "cancelled",
  "failed",
]);

export const CampaignAudienceFiltersSchema = z.object({
  segment_id: z.string().trim().nullable().optional(),
  category_slug: z.string().trim().nullable().optional(),
  included_contact_ids: z.array(z.string().trim()).optional(),
  excluded_contact_ids: z.array(z.string().trim()).optional(),
  search_query: z.string().trim().optional(),
  tags: z.array(z.string().trim()).optional(),
});

export const CreateCampaignSchema = z
  .object({
    name: z.string().trim().min(1, "Campaign name is required.").max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    connectionId: z.string().trim().min(1, "WhatsApp connection is required."),
    messageType: CampaignMessageTypeEnum,
    templateId: z.string().trim().optional().nullable(),
    templateName: z.string().trim().optional().nullable(),
    templateLanguage: z.string().trim().default("en_US"),
    templateVariables: z.record(z.string(), z.string()).default({}),
    content: z.string().trim().max(4096).optional().nullable(),
    mediaType: z.enum(["image", "document", "audio", "video"]).optional().nullable(),
    mediaStoragePath: z.string().trim().optional().nullable(),
    mediaFilename: z.string().trim().optional().nullable(),
    mediaFileSize: z.number().int().positive().optional().nullable(),
    mediaMimeType: z.string().trim().optional().nullable(),
    mediaCaption: z.string().trim().max(1024).optional().nullable(),
    mediaMetaId: z.string().trim().optional().nullable(),
    audienceType: CampaignAudienceTypeEnum.default("all_contacts"),
    audienceFilters: CampaignAudienceFiltersSchema.default({}),
    scheduledAt: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || !isNaN(new Date(val).getTime()), {
        message: "Invalid date format for scheduledAt.",
      }),
    timezone: z.string().trim().default("Asia/Kolkata"),
    status: z.enum(["draft", "scheduled"]).default("draft"),
    batchSize: z.number().int().min(1).max(500).default(50),
    dispatchIntervalMs: z.number().int().min(100).max(10000).default(1000),
  })
  .superRefine((data, ctx) => {
    if (data.messageType === "template" && !data.templateName && !data.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateName"],
        message: "Template selection is required for template campaigns.",
      });
    }

    if (data.messageType === "text" && (!data.content || !data.content.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Message content is required for text campaigns.",
      });
    }

    if (
      ["image", "document", "audio", "video"].includes(data.messageType) &&
      !data.mediaStoragePath &&
      !data.mediaMetaId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mediaStoragePath"],
        message: "Media attachment is required for media campaigns.",
      });
    }

    if (data.status === "scheduled" && data.scheduledAt) {
      const scheduledTime = new Date(data.scheduledAt).getTime();
      if (scheduledTime <= Date.now() - 30_000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scheduledAt"],
          message: "Scheduled time must be in the future.",
        });
      }
    }
  });

export type ValidatedCreateCampaign = z.infer<typeof CreateCampaignSchema>;

export const UpdateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  connectionId: z.string().trim().min(1).optional(),
  messageType: CampaignMessageTypeEnum.optional(),
  templateId: z.string().trim().optional().nullable(),
  templateName: z.string().trim().optional().nullable(),
  templateLanguage: z.string().trim().optional(),
  templateVariables: z.record(z.string(), z.string()).optional(),
  content: z.string().trim().max(4096).optional().nullable(),
  mediaCaption: z.string().trim().max(1024).optional().nullable(),
  audienceType: CampaignAudienceTypeEnum.optional(),
  audienceFilters: CampaignAudienceFiltersSchema.optional(),
  scheduledAt: z.string().optional().nullable(),
  batchSize: z.number().int().min(1).max(500).optional(),
  dispatchIntervalMs: z.number().int().min(100).max(10000).optional(),
});

export type ValidatedUpdateCampaign = z.infer<typeof UpdateCampaignSchema>;

export const CampaignAudiencePreviewSchema = z.object({
  businessSlug: z.string().trim().min(1),
  messageType: CampaignMessageTypeEnum.default("template"),
  audienceType: CampaignAudienceTypeEnum.default("all_contacts"),
  audienceFilters: CampaignAudienceFiltersSchema.default({}),
});

export type ValidatedCampaignAudiencePreview = z.infer<typeof CampaignAudiencePreviewSchema>;

/**
 * Phase 12.5: CRM Lifecycle & Follow-up Schemas
 */
export const FollowUpPriorityEnum = z.enum(["low", "normal", "high", "urgent"]);
export type ValidatedFollowUpPriority = z.infer<typeof FollowUpPriorityEnum>;

export const FollowUpStatusEnum = z.enum(["open", "in_progress", "completed", "cancelled"]);
export type ValidatedFollowUpStatus = z.infer<typeof FollowUpStatusEnum>;

export const CreateFollowUpSchema = z.object({
  contactId: z.string().trim().min(1, "Contact ID is required."),
  title: z.string().trim().min(1, "Title is required.").max(255, "Title too long."),
  description: z.string().trim().max(2000, "Description too long.").optional().nullable(),
  priority: FollowUpPriorityEnum.default("normal"),
  dueAt: z.string().datetime({ message: "dueAt must be a valid ISO datetime string." }),
  assignedTo: z.string().trim().optional().nullable(),
  conversationId: z.string().trim().optional().nullable(),
});

export type ValidatedCreateFollowUp = z.infer<typeof CreateFollowUpSchema>;
export type CreateFollowUpInput = z.input<typeof CreateFollowUpSchema>;

export const UpdateFollowUpSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  priority: FollowUpPriorityEnum.optional(),
  dueAt: z.string().datetime().optional(),
  assignedTo: z.string().trim().optional().nullable(),
  status: FollowUpStatusEnum.optional(),
});

export type ValidatedUpdateFollowUp = z.infer<typeof UpdateFollowUpSchema>;

export const CompleteFollowUpSchema = z.object({
  completionNotes: z.string().trim().max(2000).optional().nullable(),
  updateStageSlug: z.string().trim().max(100).optional().nullable(),
});

export type ValidatedCompleteFollowUp = z.infer<typeof CompleteFollowUpSchema>;

export const RescheduleFollowUpSchema = z.object({
  newDueAt: z.string().datetime({ message: "newDueAt must be a valid ISO datetime string." }),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type ValidatedRescheduleFollowUp = z.infer<typeof RescheduleFollowUpSchema>;

export const CancelFollowUpSchema = z.object({
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type ValidatedCancelFollowUp = z.infer<typeof CancelFollowUpSchema>;

export const UpdateContactStageSchema = z.object({
  contactId: z.string().trim().min(1, "Contact ID is required."),
  stageSlug: z.string().trim().min(1, "Stage slug is required.").max(100),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type ValidatedUpdateContactStage = z.infer<typeof UpdateContactStageSchema>;

export const BulkUpdateStageSchema = z.object({
  contactIds: z.array(z.string().trim().min(1)).min(1, "At least one contact ID is required.").max(500, "Cannot bulk update more than 500 contacts."),
  stageSlug: z.string().trim().min(1, "Stage slug is required.").max(100),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type ValidatedBulkUpdateStage = z.infer<typeof BulkUpdateStageSchema>;

export const CreateLifecycleStageSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100),
  slug: z.string().trim().min(1, "Slug is required.").max(100),
  color: z.string().trim().max(50).default("blue"),
  sortOrder: z.number().int().min(0).default(0),
  isDefault: z.boolean().default(false),
  isConverted: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

export type ValidatedCreateLifecycleStage = z.infer<typeof CreateLifecycleStageSchema>;





