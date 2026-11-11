import { evaluateAutomationRules } from "./engine";
import { getRulesForBusiness } from "./store";
import { validateMetaMessagingWindow } from "./safeguards";
import { getPublishedFlowsForBusiness, matchFlowTrigger, evaluateVisualFlow } from "@/lib/flows/evaluator";

export interface InboundAutomationContext {
  businessId: string;
  connectionId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  messageContent: string;
  messageType: string;
}

/**
 * Evaluates automation rules in background worker context and enqueues permitted replies
 * into wa_processing_jobs with strict idempotency and audit logging.
 */
export async function processInboundAutomation(
  supabase: any,
  ctx: InboundAutomationContext
): Promise<void> {
  if (!supabase || typeof supabase.from !== "function") {
    return;
  }

  let contact: any = null;
  let conversation: any = null;
  let settingsRow: any = null;
  let rules: any[] = [];

  try {
    const fromContacts = supabase.from("wa_contacts");
    if (!fromContacts || typeof fromContacts.select !== "function") {
      return;
    }

    const [cRes, convRes, setRes, rList] = await Promise.all([
      fromContacts.select("*").eq("id", ctx.contactId).single(),
      supabase.from("wa_conversations").select("*").eq("id", ctx.conversationId).single(),
      supabase.from("business_settings").select("business_hours, automation_settings").eq("business_id", ctx.businessId).single(),
      getRulesForBusiness(ctx.businessId),
    ]);
    contact = cRes?.data;
    conversation = convRes?.data;
    settingsRow = setRes?.data;
    rules = rList || [];
  } catch {
    return;
  }

  if (!contact || !conversation) {
    return;
  }

  // 1a. Handle Opt-Out keyword STOP/UNSUBSCRIBE immediately and halt all visual flows & rule processing
  const optOutText = (ctx.messageContent || "").toUpperCase().trim();
  const isOptOutKeyword = ["STOP", "UNSUBSCRIBE", "QUIT", "நிறுத்து"].some(
    (kw) => optOutText === kw || optOutText.includes(kw)
  );

  if (isOptOutKeyword) {
    await supabase
      .from("wa_contacts")
      .update({
        is_opted_out: true,
        consent_status: "opted_out",
        opted_out_at: new Date().toISOString(),
        opted_out_reason: `User sent opt-out keyword: ${ctx.messageContent.trim()}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);

    const idempotencyKey = `reply_default_${ctx.conversationId}_${ctx.messageId}_0`;

    // Enqueue immediate opt-out confirmation reply into durable processing queue
    await supabase.from("wa_processing_jobs").insert({
      business_id: ctx.businessId,
      connection_id: ctx.connectionId,
      job_type: "send_outbound_message",
      payload: {
        connection_id: ctx.connectionId,
        recipient_phone: contact.phone_number,
        content: "You have been unsubscribed from automated messages. Reply START to resubscribe.",
        conversation_id: ctx.conversationId,
        contact_id: ctx.contactId,
        inbound_message_id: ctx.messageId,
      },
      idempotency_key: idempotencyKey,
      scheduled_at: new Date().toISOString(),
      status: "pending",
      attempts: 0,
      max_attempts: 5,
    });

    await supabase.from("wa_automation_execution_logs").insert({
      business_id: ctx.businessId,
      connection_id: ctx.connectionId,
      conversation_id: ctx.conversationId,
      contact_id: ctx.contactId,
      inbound_message_id: ctx.messageId,
      trigger_matched: "opt_out_stop",
      status: "queued",
      skip_reason: "opt_out_stop_keyword_processed",
    });
    return;
  }

  // 1b. Check Published Visual Flows (Precedence over fallback rules)
  try {
      const publishedFlows = await getPublishedFlowsForBusiness(ctx.businessId, "workspace", supabase);
      const matchingFlow = publishedFlows.find((f) => matchFlowTrigger(f, ctx.messageContent));

      if (matchingFlow) {
        // Check human handover before executing flow
        if (conversation.status === "pending_human" || conversation.is_bot_paused) {
          await supabase.from("wa_automation_execution_logs").insert({
            business_id: ctx.businessId,
            connection_id: ctx.connectionId,
            conversation_id: ctx.conversationId,
            contact_id: ctx.contactId,
            inbound_message_id: ctx.messageId,
            trigger_matched: `flow:${matchingFlow.name}`,
            status: "skipped",
            skip_reason: "human_takeover_active",
          });
          return;
        }

        const flowResult = evaluateVisualFlow({
          flow: matchingFlow,
          messageContent: ctx.messageContent,
          contact,
          conversation,
          businessHours: settingsRow?.business_hours,
          now: new Date(),
        });

        if (flowResult.matched) {
          // Apply contact updates
          if (flowResult.contactUpdates && Object.keys(flowResult.contactUpdates).length > 0) {
            await supabase
              .from("wa_contacts")
              .update({
                ...flowResult.contactUpdates,
                updated_at: new Date().toISOString(),
              })
              .eq("id", contact.id);
          }

          // Apply conversation updates
          if (flowResult.conversationUpdates && Object.keys(flowResult.conversationUpdates).length > 0) {
            await supabase
              .from("wa_conversations")
              .update({
                ...flowResult.conversationUpdates,
                updated_at: new Date().toISOString(),
              })
              .eq("id", conversation.id);
          }

          // Enqueue actions into durable queue
          for (let idx = 0; idx < flowResult.actionsToDispatch.length; idx++) {
            const action = flowResult.actionsToDispatch[idx];
            const payload = action.payload || {};
            const actionType = action.action_type;
            const textBody = payload.message_text || "";

            // 24h WhatsApp service window check
            const windowCheck = validateMetaMessagingWindow(contact.last_inbound_at, actionType);
            if (!windowCheck.isValid) {
              await supabase.from("wa_automation_execution_logs").insert({
                business_id: ctx.businessId,
                connection_id: ctx.connectionId,
                conversation_id: ctx.conversationId,
                contact_id: ctx.contactId,
                inbound_message_id: ctx.messageId,
                trigger_matched: `flow:${matchingFlow.name}`,
                status: "skipped",
                skip_reason: windowCheck.reason,
              });
              continue;
            }

            // Idempotency key prevents executing the same flow twice for the same inbound message
            const idempotencyKey = `flow_reply_${matchingFlow.id}_${ctx.conversationId}_${ctx.messageId}_${action.nodeId}_${idx}`;

            const scheduledAt =
              action.delay_seconds > 0
                ? new Date(Date.now() + action.delay_seconds * 1000).toISOString()
                : new Date().toISOString();

            const jobType = action.delay_seconds > 0 ? "scheduled_followup" : "send_outbound_message";

            const { error: queueErr } = await supabase.from("wa_processing_jobs").insert({
              business_id: ctx.businessId,
              connection_id: ctx.connectionId,
              job_type: jobType,
              payload: {
                connection_id: ctx.connectionId,
                recipient_phone: contact.phone_number,
                content: textBody,
                template_name: payload.template_name,
                template_language: payload.template_language || "en",
                flow_id: matchingFlow.id,
                conversation_id: ctx.conversationId,
                contact_id: ctx.contactId,
                inbound_message_id: ctx.messageId,
                action_type: action.action_type,
              },
              idempotency_key: idempotencyKey,
              scheduled_at: scheduledAt,
              status: "pending",
              attempts: 0,
              max_attempts: 5,
            });

            await supabase.from("wa_automation_execution_logs").insert({
              business_id: ctx.businessId,
              connection_id: ctx.connectionId,
              conversation_id: ctx.conversationId,
              contact_id: ctx.contactId,
              inbound_message_id: ctx.messageId,
              trigger_matched: `flow:${matchingFlow.name}`,
              actions_executed: [action],
              status: queueErr ? "failed" : "queued",
              error_message: queueErr ? queueErr.message : undefined,
            });
          }

          return; // Visual flow execution complete
        }
      }
    } catch (flowErr: any) {
      console.warn("[Visual Flow Evaluator Error]:", flowErr?.message || flowErr);
    }

  // 2. Evaluate rules (Fallback when no visual flow matched)
  const evalResult = evaluateAutomationRules({
    message: {
      id: ctx.messageId,
      direction: "inbound",
      content: ctx.messageContent,
      message_type: ctx.messageType,
      created_at: new Date().toISOString(),
    },
    contact,
    conversation,
    businessId: ctx.businessId,
    connectionId: ctx.connectionId,
    rules,
    businessHours: settingsRow?.business_hours,
    automationSettings: settingsRow?.automation_settings,
    now: new Date(),
    isDryRun: false,
  });

  // 3. Apply contact updates if any
  if (evalResult.contactUpdates) {
    await supabase
      .from("wa_contacts")
      .update({
        ...evalResult.contactUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);
  }

  // 4. Apply conversation updates if any
  if (evalResult.conversationUpdates) {
    await supabase
      .from("wa_conversations")
      .update({
        ...evalResult.conversationUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  // If not matched or skipped due to guards, log if applicable
  if (!evalResult.matched) {
    if (evalResult.skipReason && evalResult.skipReason !== "workspace_automation_disabled" && evalResult.skipReason !== "no_matching_rules") {
      await supabase.from("wa_automation_execution_logs").insert({
        business_id: ctx.businessId,
        rule_id: evalResult.ruleId || null,
        connection_id: ctx.connectionId,
        conversation_id: ctx.conversationId,
        contact_id: ctx.contactId,
        inbound_message_id: ctx.messageId,
        trigger_matched: evalResult.triggerType || "inbound_guard",
        conditions_snapshot: evalResult.conditionsSnapshot,
        actions_executed: [],
        status: "skipped",
        skip_reason: evalResult.skipReason,
        execution_time_ms: evalResult.latencyMs,
      });
    }
    return;
  }

  // 5. Enqueue permitted actions into wa_processing_jobs with unique idempotency keys
  for (let idx = 0; idx < evalResult.actionsToDispatch.length; idx++) {
    const action = evalResult.actionsToDispatch[idx];
    const payload = action.payload || {};
    const actionType = action.action_type;
    const textBody = (payload.message_text as string) || (payload.content as string) || "";
    const templateName = payload.template_name as string;

    // Verify Meta 24-hour messaging window compliance
    const windowCheck = validateMetaMessagingWindow(contact.last_inbound_at, actionType);
    if (!windowCheck.isValid) {
      await supabase.from("wa_automation_execution_logs").insert({
        business_id: ctx.businessId,
        rule_id: evalResult.ruleId || null,
        connection_id: ctx.connectionId,
        conversation_id: ctx.conversationId,
        contact_id: ctx.contactId,
        inbound_message_id: ctx.messageId,
        trigger_matched: evalResult.status === "opt_out_handled" ? "opt_out_stop" : (evalResult.triggerType || "rule_matched"),
        conditions_snapshot: evalResult.conditionsSnapshot,
        actions_executed: [action],
        status: "skipped",
        skip_reason: windowCheck.reason,
        execution_time_ms: evalResult.latencyMs,
      });
      continue;
    }

    if (action.delay_seconds === 0) {
      // Immediate Reply -> Enqueue send_outbound_message job for background worker dispatch
      const idempotencyKey = `reply_${evalResult.ruleId || "default"}_${ctx.conversationId}_${ctx.messageId}_${idx}`;

      const { error: queueErr } = await supabase.from("wa_processing_jobs").insert({
        business_id: ctx.businessId,
        connection_id: ctx.connectionId,
        job_type: "send_outbound_message",
        payload: {
          connection_id: ctx.connectionId,
          recipient_phone: contact.phone_number,
          content: textBody,
          template_name: templateName,
          template_language: (payload.template_language as string) || "en",
          rule_id: evalResult.ruleId,
          conversation_id: ctx.conversationId,
          contact_id: ctx.contactId,
          inbound_message_id: ctx.messageId,
        },
        idempotency_key: idempotencyKey,
        scheduled_at: new Date().toISOString(),
        status: "pending",
        attempts: 0,
        max_attempts: 5,
      });

      // Record queued reply intent in execution logs
      await supabase.from("wa_automation_execution_logs").insert({
        business_id: ctx.businessId,
        rule_id: evalResult.ruleId || null,
        connection_id: ctx.connectionId,
        conversation_id: ctx.conversationId,
        contact_id: ctx.contactId,
        inbound_message_id: ctx.messageId,
        trigger_matched: evalResult.status === "opt_out_handled" ? "opt_out_stop" : (evalResult.triggerType || "rule_matched"),
        conditions_snapshot: evalResult.conditionsSnapshot,
        actions_executed: [action],
        status: queueErr ? "failed" : "queued",
        error_message: queueErr ? queueErr.message : undefined,
        execution_time_ms: evalResult.latencyMs,
      });
    } else {
      // Delayed Follow-Up -> Enqueue scheduled_followup job in wa_processing_jobs
      const idempotencyKey = `followup_${evalResult.ruleId || "adhoc"}_${ctx.conversationId}_${ctx.messageId}_${idx}`;

      const { error: queueErr } = await supabase.from("wa_processing_jobs").insert({
        business_id: ctx.businessId,
        connection_id: ctx.connectionId,
        job_type: "scheduled_followup",
        payload: {
          rule_id: evalResult.ruleId,
          conversation_id: ctx.conversationId,
          contact_id: ctx.contactId,
          action_type: action.action_type,
          ...action.payload,
        },
        idempotency_key: idempotencyKey,
        scheduled_at: action.scheduled_at || new Date(Date.now() + action.delay_seconds * 1000).toISOString(),
        status: "pending",
        attempts: 0,
        max_attempts: 5,
      });

      // Record scheduled intent in execution logs
      await supabase.from("wa_automation_execution_logs").insert({
        business_id: ctx.businessId,
        rule_id: evalResult.ruleId || null,
        connection_id: ctx.connectionId,
        conversation_id: ctx.conversationId,
        contact_id: ctx.contactId,
        inbound_message_id: ctx.messageId,
        trigger_matched: evalResult.status === "opt_out_handled" ? "opt_out_stop" : (evalResult.triggerType || "rule_matched"),
        conditions_snapshot: evalResult.conditionsSnapshot,
        actions_executed: [action],
        status: queueErr ? "failed" : "delayed",
        error_message: queueErr ? queueErr.message : undefined,
        execution_time_ms: evalResult.latencyMs,
      });
    }
  }
}
