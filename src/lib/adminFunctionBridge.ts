import { isCloudflareBackend, supabase } from "@/integrations/supabase/client";
import {
  adminGenerateContent,
  adminGenerateCover,
  adminGenerateMastery,
  adminPolishContent,
  adminSubmitIndexNow,
} from "@/lib/adminApi";

let installed = false;

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Admin function failed");
}

/**
 * Keeps the existing admin UI stable while the migration branch is in
 * Cloudflare mode. Only the legacy admin Edge Function names are intercepted;
 * all other callers retain the normal client behavior.
 */
export function installAdminFunctionBridge() {
  if (installed || !isCloudflareBackend) return;
  installed = true;

  const originalInvoke = supabase.functions?.invoke?.bind(supabase.functions);
  if (!supabase.functions) supabase.functions = {};

  supabase.functions.invoke = async (name: string, options: { body?: any } = {}) => {
    const body = options?.body || {};
    try {
      if (name === "indexnow-submit") {
        return { data: await adminSubmitIndexNow(Array.isArray(body.urls) ? body.urls : []), error: null };
      }
      if (name === "generate-book-cover") {
        return { data: await adminGenerateCover(String(body.book_id || "")), error: null };
      }
      if (name === "generate-book-content") {
        return {
          data: await adminGenerateContent(String(body.book_id || ""), body.language === "hi" ? "hi" : "en"),
          error: null,
        };
      }
      if (name === "polish-book-content") {
        return { data: await adminPolishContent(String(body.book_id || "")), error: null };
      }
      if (name === "generate-mastery-assets") {
        return { data: await adminGenerateMastery(body), error: null };
      }
      if (originalInvoke) return originalInvoke(name, options);
      return { data: null, error: { message: `Unsupported function: ${name}` } };
    } catch (error) {
      return { data: null, error: { message: message(error) } };
    }
  };
}
