-- ==============================================================================
-- GOKUL CONNECT — DATABASE MIGRATION 011: QUEUE RPC PRIVILEGE HARDENING
-- ==============================================================================
-- Migration Identifier: 20261107_011_phase7_5_queue_rpc_privilege_hardening.sql
-- Status: PREPARED FOR PHASE 7.5.2 (NOT YET APPLIED TO LIVE DATABASE)
--
-- PURPOSE:
-- Remediates security findings SEC-01 from Phase 7.5.1 Review:
-- Explicitly revokes EXECUTE privileges on queue management RPCs
-- (claim_next_wa_jobs and reclaim_stuck_wa_jobs) from PUBLIC, anon, and authenticated roles.
-- Grants EXECUTE strictly to the service_role, ensuring only authorized background
-- workers and trusted server-side cron jobs can claim or reclaim processing tasks.
--
-- AFFECTED FUNCTIONS:
-- 1. public.claim_next_wa_jobs(INTEGER, TEXT)
-- 2. public.reclaim_stuck_wa_jobs(INTEGER)
--
-- BEHAVIOR PRESERVATION:
-- Function definitions, search_path (public, pg_temp), and FOR UPDATE SKIP LOCKED logic
-- remain exactly as defined in migration 20261106_009_phase5_automation_engine_schema.sql.
-- Only role execution grants are modified.
-- ==============================================================================

-- 1. Correct privileges for claim_next_wa_jobs
REVOKE ALL ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) TO service_role;

-- 2. Correct privileges for reclaim_stuck_wa_jobs
REVOKE ALL ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) TO service_role;

-- 3. Audit and verification comments
COMMENT ON FUNCTION public.claim_next_wa_jobs(INTEGER, TEXT) IS 
  'Claims next batch of pending processing jobs using FOR UPDATE SKIP LOCKED. Restricted to service_role.';

COMMENT ON FUNCTION public.reclaim_stuck_wa_jobs(INTEGER) IS 
  'Reclaims abandoned processing jobs locked longer than timeout threshold. Restricted to service_role.';
