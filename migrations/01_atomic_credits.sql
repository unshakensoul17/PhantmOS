-- Ghost Protocol v3.0 Migration
-- Phase 1: Atomic Credit Deduction Postgres RPC
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION decrement_user_credits(user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_credits INT;
BEGIN
    -- Select current credits and lock the row to prevent race conditions
    SELECT credits INTO current_credits
    FROM user_profiles
    WHERE id = user_id_param
    FOR UPDATE;

    -- If the user doesn't exist or has 0 credits, return false
    IF current_credits IS NULL OR current_credits <= 0 THEN
        RETURN FALSE;
    END IF;

    -- Decrement credits by 1
    UPDATE user_profiles
    SET credits = credits - 1
    WHERE id = user_id_param;

    RETURN TRUE;
END;
$$;
